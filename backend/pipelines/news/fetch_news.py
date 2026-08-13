"""
League of Legals — news collector.

Fetches RSS from reviewed sources, normalizes and deduplicates the items, keeps
the raw feed for the audit trail, and writes a JSON snapshot the frontend reads
at build time.

Runs on your machine. Nothing here is deployed; the only thing that reaches
Vercel is the JSON it produces.

    python backend/pipelines/news/fetch_news.py

What it deliberately does NOT do:

  * It never stores or emits article body text. Only the headline, a short
    extract capped at EXCERPT_LIMIT characters, the author, the date, and the
    canonical link — the aggregator pattern. Republishing the body would be
    infringement, and in the EU even long snippets engage the press publishers'
    right.
  * It never fetches a source whose permitted_use is not "feed". The registry in
    sources.json is the gate, and it is set by a human reading robots.txt.

Mirrors `news_ingest` -> `news_articles` in backend/supabase/migrations. When the
database is live, this writes through ingest_news_item() instead of to a file;
the parsing and dedupe logic stays as-is.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import feedparser

ROOT = Path(__file__).resolve().parents[2]          # backend/
REPO = ROOT.parent                                   # project root
SOURCES_FILE = Path(__file__).resolve().parent / "sources.json"
RAW_DIR = ROOT / "data" / "raw"
STATE_FILE = ROOT / "data" / "ingest_state.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "news.json"

USER_AGENT = "LeagueOfLegalsBot/0.1 (+https://leagueoflegals.com/about; news aggregation)"
EXCERPT_LIMIT = 320          # matches the CHECK constraint on news_articles.excerpt
MAX_ITEMS_PER_SOURCE = 12
MAX_OUTPUT_ITEMS = 400
REQUEST_TIMEOUT = 25

# Rolling window. Each run merges into the existing snapshot instead of
# replacing it, then drops anything older than this.
#
# This is the single most important number for clustering. A one-day snapshot
# of legal news contains no event covered by three outlets, so no cluster can
# form; coverage of the same story accumulates over days. The vaccine pipeline
# reached the same conclusion from the other direction — it crawls N days of
# archive up front and clusters over `days=3`.
RETENTION_DAYS = 14

# Tracking parameters stripped before hashing, so the same article arriving from
# two places collapses to one row.
TRACKING_PARAMS = re.compile(
    r"^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source|__twitter|igshid)", re.I
)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def canonicalize(url: str) -> str:
    """Lowercase scheme/host, drop tracking params and fragments, trim slash."""
    parts = urllib.parse.urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=False)
        if not TRACKING_PARAMS.match(k)
    ]
    path = parts.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit(
        (
            parts.scheme.lower(),
            parts.netloc.lower(),
            path,
            urllib.parse.urlencode(query),
            "",
        )
    )


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def strip_html(value: str) -> str:
    return WS_RE.sub(" ", html.unescape(TAG_RE.sub(" ", value or ""))).strip()


def truncate(text: str, limit: int = EXCERPT_LIMIT) -> str:
    """Cut at a word boundary so the extract reads as a sentence fragment."""
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,.;:") + "…"


def to_iso(entry) -> str | None:
    parsed = getattr(entry, "published_parsed", None) or getattr(
        entry, "updated_parsed", None
    )
    if not parsed:
        return None
    return datetime(*parsed[:6], tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text("utf-8"))
    return {}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), "utf-8")


def fetch(url: str, etag: str | None, modified: str | None) -> tuple[int, bytes, dict]:
    """Conditional GET: an unchanged feed costs one 304 and nothing else."""
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    if etag:
        request.add_header("If-None-Match", etag)
    if modified:
        request.add_header("If-Modified-Since", modified)

    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            return response.status, response.read(), dict(response.headers)
    except urllib.error.HTTPError as error:
        if error.code == 304:
            return 304, b"", dict(error.headers)
        raise


def collect() -> int:
    registry = json.loads(SOURCES_FILE.read_text("utf-8"))
    state = load_state()
    run_started = datetime.now(timezone.utc)

    # Seed from the existing snapshot so a run adds to the corpus rather than
    # replacing it. The dedupe sets are seeded too, so an article already on
    # file is skipped exactly like a within-run duplicate.
    articles: list[dict] = []
    if OUTPUT_FILE.exists():
        try:
            previous = json.loads(OUTPUT_FILE.read_text("utf-8"))
            articles = previous.get("articles", [])
        except (json.JSONDecodeError, OSError) as error:
            log(f"could not read existing snapshot ({error}); starting fresh")

    seen_urls: set[str] = {sha256(canonicalize(a["canonicalUrl"])) for a in articles}
    seen_content: set[str] = set()
    stats = {
        "fetched": 0,
        "not_modified": 0,
        "items": 0,
        "duplicates": 0,
        "failed": 0,
        "carried_over": len(articles),
    }

    for source in registry["sources"]:
        if not source.get("enabled"):
            log(f"skip {source['slug']}: disabled")
            continue
        if source.get("permitted_use") != "feed":
            # The compliance gate. Also enforced in the database by
            # ingest_news_item(), so a misconfigured run cannot land data.
            log(f"skip {source['slug']}: permitted_use={source.get('permitted_use')}")
            continue

        slug = source["slug"]
        prior = state.get(slug, {})

        try:
            status, body, headers = fetch(
                source["feed_url"], prior.get("etag"), prior.get("last_modified")
            )
        except Exception as error:  # noqa: BLE001 - one bad source must not stop the run
            stats["failed"] += 1
            log(f"FAIL {slug}: {error}")
            continue

        if status == 304:
            stats["not_modified"] += 1
            log(f"{slug}: 304 not modified")
            continue

        stats["fetched"] += 1

        # Keep the bytes we actually read. This is the evidence trail: it lets us
        # re-parse after a bug without re-fetching, and shows what was published
        # at the moment we read it.
        raw_path = RAW_DIR / slug / f"{run_started:%Y%m%dT%H%M%SZ}.xml"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_bytes(body)

        feed = feedparser.parse(body)
        kept = 0

        for entry in feed.entries[:MAX_ITEMS_PER_SOURCE]:
            link = getattr(entry, "link", "") or ""
            title = strip_html(getattr(entry, "title", ""))
            if not link or not title:
                continue

            canonical = canonicalize(link)
            url_hash = sha256(canonical)
            if url_hash in seen_urls:
                stats["duplicates"] += 1
                continue

            summary_source = (
                getattr(entry, "summary", "")
                or (entry.content[0].value if getattr(entry, "content", None) else "")
            )
            excerpt = truncate(strip_html(summary_source))

            content_hash = sha256(f"{title}|{excerpt}".lower())
            if content_hash in seen_content:
                # Same story syndicated to another outlet.
                stats["duplicates"] += 1
                continue

            author = strip_html(getattr(entry, "author", "")) or None
            published = to_iso(entry)

            seen_urls.add(url_hash)
            seen_content.add(content_hash)
            kept += 1
            stats["items"] += 1

            articles.append(
                {
                    "id": url_hash[:16],
                    "title": title,
                    "excerpt": excerpt or None,
                    "summary": None,  # written by the LLM pass; not run without a key
                    "author": author,
                    "publishedAt": published or run_started.isoformat().replace("+00:00", "Z"),
                    "sourceName": source["name"],
                    "sourceSlug": slug,
                    "canonicalUrl": canonical,
                    "jurisdictionIso": source.get("jurisdiction_iso"),
                    "language": source.get("language", "en"),
                    "entities": [],  # filled by entity resolution once firms are real
                    "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
                }
            )

        log(f"{slug}: {kept} items kept from {len(feed.entries)} in feed")

        state[slug] = {
            "etag": headers.get("ETag"),
            "last_modified": headers.get("Last-Modified"),
            "last_fetched_at": run_started.isoformat().replace("+00:00", "Z"),
        }

        time.sleep(source.get("crawl_delay_seconds", 5))

    # Prune the rolling window, then sort and cap.
    cutoff = run_started.timestamp() - RETENTION_DAYS * 86400
    kept = []
    for article in articles:
        try:
            published = datetime.fromisoformat(
                article["publishedAt"].replace("Z", "+00:00")
            ).timestamp()
        except (ValueError, KeyError):
            published = run_started.timestamp()   # undated: keep this cycle
        if published >= cutoff:
            kept.append(article)

    stats["expired"] = len(articles) - len(kept)
    articles = sorted(kept, key=lambda a: a["publishedAt"], reverse=True)
    articles = articles[:MAX_OUTPUT_ITEMS]

    oldest = min((a["publishedAt"] for a in articles), default=None)

    payload = {
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "sourceCount": len({a["sourceSlug"] for a in articles}),
        "windowDays": RETENTION_DAYS,
        "oldestArticle": oldest,
        "articles": articles,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")
    save_state(state)

    print()
    print(f"  fetched={stats['fetched']} not_modified={stats['not_modified']} "
          f"new={stats['items']} duplicates={stats['duplicates']} failed={stats['failed']}")
    print(f"  carried over={stats['carried_over']} expired={stats['expired']} "
          f"(rolling {RETENTION_DAYS}-day window)")
    print(f"  wrote {len(articles)} articles -> {OUTPUT_FILE.relative_to(REPO)}")
    print(f"  raw feeds kept in {RAW_DIR.relative_to(REPO)}")

    return 0 if articles else 1


if __name__ == "__main__":
    print("League of Legals news collector")
    sys.exit(collect())
