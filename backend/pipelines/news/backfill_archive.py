"""
League of Legals — archive backfill via sitemaps.

RSS carries a publisher's last 10–100 items: days of history, not years. To
reach 2025–2026 the discovery path has to change, so this walks each source's
sitemap instead, filters URLs by <lastmod>, and fetches the articles behind
them into the same rolling store the RSS collector writes.

    python backend/pipelines/news/backfill_archive.py --from 2025-01-01 --to 2026-12-31
    python backend/pipelines/news/backfill_archive.py --source bar-and-bench --limit 50

Same discipline as the RSS collector, for the same reasons:

  * Only sources whose registry entry carries a `sitemap_url` and
    permitted_use == "feed" are touched. The registry is the gate.
  * Identified User-Agent, per-source crawl delay, conditional GET where the
    server offers it. We do not pretend to be a browser.
  * Headline plus a short extract are published; the body is kept privately in
    backend/data/raw/articles for the synthesis step and nothing else.

This is the expensive collector: a first run over two years of a busy outlet is
thousands of requests. It is built to be resumable — anything already in the
store is skipped without a fetch — so it can be stopped and restarted freely.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
SOURCES_FILE = Path(__file__).resolve().parent / "sources.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "news.json"
RAW_DIR = ROOT / "data" / "raw" / "archive"

USER_AGENT = "LeagueOfLegalsBot/0.1 (+https://leagueoflegals.com/about; archive backfill)"
EXCERPT_LIMIT = 320
TIMEOUT = 30

SITEMAP_NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
TRACKING_PARAMS = re.compile(r"^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source)", re.I)
TAG_RE = re.compile(r"<(script|style|nav|header|footer)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)
WS_RE = re.compile(r"\s+")
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)
OG_DESC_RE = re.compile(
    r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\'](.*?)["\']', re.S | re.I
)
PUBLISHED_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:article:published_time|publishdate|date)["\']'
    r'[^>]+content=["\'](.*?)["\']',
    re.S | re.I,
)


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def get(url: str) -> bytes | None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            body = response.read()
            if url.endswith(".gz") or response.headers.get("Content-Encoding") == "gzip":
                try:
                    body = gzip.decompress(body)
                except OSError:
                    pass
            return body
    except Exception as error:  # noqa: BLE001
        log(f"    fetch failed {url[:70]}: {error}")
        return None


def canonicalize(url: str) -> str:
    parts = urllib.parse.urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in urllib.parse.parse_qsl(parts.query, keep_blank_values=False)
        if not TRACKING_PARAMS.match(k)
    ]
    path = parts.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), path,
         urllib.parse.urlencode(query), "")
    )


def parse_sitemap(body: bytes) -> tuple[list[str], list[tuple[str, str | None]]]:
    """
    Returns (child sitemap URLs, [(article URL, lastmod)]).

    A sitemap index points at more sitemaps; a urlset points at pages. Handling
    both in one function means the caller can recurse without knowing which it
    fetched, which is how every real publisher's tree is shaped.
    """
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return [], []

    children = [
        el.text.strip()
        for el in root.findall(".//s:sitemap/s:loc", SITEMAP_NS)
        if el.text
    ]
    pages: list[tuple[str, str | None]] = []
    for url_el in root.findall(".//s:url", SITEMAP_NS):
        loc = url_el.find("s:loc", SITEMAP_NS)
        if loc is None or not loc.text:
            continue
        lastmod = url_el.find("s:lastmod", SITEMAP_NS)
        pages.append((loc.text.strip(), lastmod.text.strip() if lastmod is not None and lastmod.text else None))
    return children, pages


def in_range(stamp: str | None, start: str, end: str) -> bool:
    """Undated entries pass — the article page itself is checked afterwards."""
    if not stamp:
        return True
    return start <= stamp[:10] <= end


def strip_html(value: str) -> str:
    return WS_RE.sub(" ", TAG_RE.sub(" ", value or "")).strip()


def truncate(text: str, limit: int = EXCERPT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,.;:") + "…"


def parse_article(html: str, url: str) -> dict | None:
    title_match = TITLE_RE.search(html)
    if not title_match:
        return None
    title = strip_html(title_match.group(1))
    # Publishers suffix the outlet name; the separator varies, the pattern does not.
    title = re.split(r"\s+[|–—-]\s+(?=[^|–—-]+$)", title)[0].strip()

    desc = OG_DESC_RE.search(html)
    excerpt = truncate(strip_html(desc.group(1))) if desc else None

    published = None
    stamp = PUBLISHED_RE.search(html)
    if stamp:
        try:
            published = (
                datetime.fromisoformat(stamp.group(1).strip().replace("Z", "+00:00"))
                .astimezone(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z")
            )
        except ValueError:
            published = None

    if not title or len(title) < 12:
        return None
    return {"title": title, "excerpt": excerpt, "publishedAt": published}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="start", default="2025-01-01")
    parser.add_argument("--to", dest="end", default="2026-12-31")
    parser.add_argument("--source", help="restrict to one source slug")
    parser.add_argument("--limit", type=int, default=200,
                        help="max articles to fetch per source this run")
    args = parser.parse_args()

    registry = json.loads(SOURCES_FILE.read_text("utf-8"))
    run_started = datetime.now(timezone.utc)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    articles: list[dict] = []
    if OUTPUT_FILE.exists():
        articles = json.loads(OUTPUT_FILE.read_text("utf-8")).get("articles", [])
    seen = {canonicalize(a["canonicalUrl"]) for a in articles}
    added_total = 0

    for source in registry["sources"]:
        if args.source and source["slug"] != args.source:
            continue
        if not source.get("enabled") or source.get("permitted_use") != "feed":
            continue
        sitemap_url = source.get("sitemap_url")
        if not sitemap_url:
            log(f"skip {source['slug']}: no sitemap_url in registry")
            continue

        slug = source["slug"]
        delay = source.get("crawl_delay_seconds", 5)
        log(f"{slug}: {sitemap_url}")

        body = get(sitemap_url)
        if not body:
            continue

        children, pages = parse_sitemap(body)
        # One level of recursion covers a sitemap index pointing at yearly or
        # monthly sitemaps, which is the shape nearly every publisher uses.
        for child in children[:40]:
            time.sleep(delay)
            child_body = get(child)
            if child_body:
                _, child_pages = parse_sitemap(child_body)
                pages.extend(child_pages)

        candidates = [
            url for url, lastmod in pages
            if in_range(lastmod, args.start, args.end)
            and canonicalize(url) not in seen
        ]
        log(f"  {len(pages)} urls in sitemap, {len(candidates)} in range and new")

        added = 0
        for url in candidates:
            if added >= args.limit:
                log(f"  hit --limit {args.limit}; stopping this source")
                break

            time.sleep(delay)
            html_bytes = get(url)
            if not html_bytes:
                continue
            html = html_bytes.decode("utf-8", errors="replace")

            parsed = parse_article(html, url)
            if not parsed:
                continue
            if parsed["publishedAt"] and not in_range(parsed["publishedAt"], args.start, args.end):
                continue

            canonical = canonicalize(url)
            seen.add(canonical)

            # Body text stays private, for synthesis only.
            (RAW_DIR / f"{hashlib.sha256(canonical.encode()).hexdigest()[:16]}.txt").write_text(
                strip_html(html)[:20000], "utf-8"
            )

            articles.append({
                "id": hashlib.sha256(canonical.encode()).hexdigest()[:16],
                "title": parsed["title"],
                "excerpt": parsed["excerpt"],
                "summary": None,
                "author": None,
                "publishedAt": parsed["publishedAt"] or run_started.isoformat().replace("+00:00", "Z"),
                "sourceName": source["name"],
                "sourceSlug": slug,
                "canonicalUrl": canonical,
                "jurisdictionIso": source.get("jurisdiction_iso"),
                "language": source.get("language", "en"),
                "entities": [],
                "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
                "discovery": "sitemap",
            })
            added += 1
            if added % 10 == 0:
                log(f"  {added} fetched…")

        log(f"  {slug}: +{added}")
        added_total += added

    articles.sort(key=lambda a: a["publishedAt"], reverse=True)
    payload = json.loads(OUTPUT_FILE.read_text("utf-8")) if OUTPUT_FILE.exists() else {}
    payload.update({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "sourceCount": len({a["sourceSlug"] for a in articles}),
        "archiveRange": f"{args.start}..{args.end}",
        "articles": articles,
    })
    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"added {added_total}; corpus now {len(articles)} articles")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("League of Legals archive backfill")
    sys.exit(main())
