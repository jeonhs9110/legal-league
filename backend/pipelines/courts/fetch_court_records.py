"""
Legal League — court and justice-ministry record collection.

    python backend/pipelines/courts/fetch_court_records.py --probe
    python backend/pipelines/courts/fetch_court_records.py
    python backend/pipelines/courts/fetch_court_records.py --jurisdiction south-korea

The fourth pillar, and the only one built entirely on primary sources. A
judgment handed down by a court and a notice published by a justice ministry
are public acts. In most of these jurisdictions they sit outside copyright by
statute — §5 UrhG in Germany, art. 13 in Japan, s.52(1)(q) in India, art. 24-2
in Korea — and in the United Kingdom the National Archives publishes them under
the Open Justice Licence specifically so that they can be reused.

That matters commercially, not just legally. Every other pillar of this site
depends on somebody else's reporting. This one does not depend on Chambers,
Legal 500, Law.asia or any trade publisher, because none of them owns a word of
it. It is the part of the directory that cannot be taken away.

Two rules:

  * Full judgment text is never republished, whatever the licence permits. The
    site carries case name, court, date, citation and a link to the official
    record. That is what a reader needs, it is a fact set rather than an
    authored work, and it keeps us clear of every database right in every one
    of these jurisdictions without having to litigate the differences.

  * --probe verifies before anything is collected. Every entry in the registry
    starts 'unverified'; the probe records what actually came back — status
    code, content type, item count, whether robots.txt permits us — and writes
    that back. A source is only used once it has proved it works, because the
    firm crawl showed how many plausible-looking endpoints simply do not.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
REGISTRY = Path(__file__).resolve().parent / "court_sources.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "court_records.json"
RAW_DIR = ROOT / "data" / "raw" / "courts"

USER_AGENT = "LegalLeagueBot/0.1 (+https://legalleague.org/about; public court records)"
TIMEOUT = 30
CRAWL_DELAY = 5
MAX_PER_SOURCE = 40
RETENTION_DAYS = 180

TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>", re.S | re.I)
STRIP_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
LINK_RE = re.compile(r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', re.S | re.I)

# A judgment link looks like a judgment link in every one of these systems:
# either the path says so, or the label carries a case citation.
JUDGMENT_PATH_RE = re.compile(
    r"(judgment|judgement|judgments|decision|decisions|opinion|ruling|"
    r"jurisprudence|hanrei|banan|putusan|entscheidung|arret|case)", re.I)
CITATION_RE = re.compile(
    r"\[\d{4}\]\s*[A-Z]{2,6}|\b\d{4}\s*(?:SCC|HCA|UKSC|EWCA|EWHC|ZACC|SGCA|SGHC)\b|"
    r"\bNo\.\s*\d+[-/]\d+|\b\d{4}[가-힣]{1,3}\d+", re.I)
DATE_RE = re.compile(
    r"(\d{4})[-/.년]\s*(\d{1,2})[-/.월]\s*(\d{1,2})|"
    r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|"
    r"October|November|December)\s+(\d{4})", re.I)
MONTHS = {m.lower(): i for i, m in enumerate(
    ["January", "February", "March", "April", "May", "June", "July", "August",
     "September", "October", "November", "December"], 1)}


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def clean(html: str) -> str:
    return WS_RE.sub(" ", STRIP_RE.sub(" ", TAG_RE.sub(" ", html))).strip()


def robots_allows(url: str, cache: dict) -> bool:
    host = urllib.parse.urlsplit(url).netloc
    if host not in cache:
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(f"https://{host}/robots.txt")
        try:
            parser.read()
            cache[host] = parser
        except Exception:  # noqa: BLE001
            cache[host] = None
    parser = cache[host]
    if parser is None:
        return True
    try:
        return parser.can_fetch(USER_AGENT, url)
    except Exception:  # noqa: BLE001
        return True


def fetch(url: str) -> tuple[bytes | None, str, str]:
    """Returns (body, content_type, note). Note is empty on success."""
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/atom+xml,application/rss+xml,application/json,text/html;q=0.9",
        "Accept-Language": "en,*;q=0.5",
    })
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            return (response.read(3_000_000),
                    response.headers.get("Content-Type", ""), "")
    except urllib.error.HTTPError as error:
        return None, "", f"HTTP {error.code}"
    except urllib.error.URLError as error:
        text = str(error.reason)
        if "CERTIFICATE_VERIFY_FAILED" in text:
            return None, "", "TLS certificate did not match this hostname"
        if "getaddrinfo" in text or "Name or service not known" in text:
            return None, "", "domain does not exist in DNS"
        return None, "", f"connection failed ({text[:50]})"
    except Exception as error:  # noqa: BLE001
        return None, "", type(error).__name__


def parse_date(text: str) -> str | None:
    match = DATE_RE.search(text)
    if not match:
        return None
    try:
        if match.group(1):
            y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
        else:
            d, m, y = (int(match.group(4)),
                       MONTHS[match.group(5).lower()], int(match.group(6)))
        if not (1990 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31):
            return None
        return f"{y:04d}-{m:02d}-{d:02d}"
    except (ValueError, KeyError):
        return None


def parse_feed(body: bytes, base: str) -> list[dict]:
    """Atom and RSS in one pass; both are used by the judiciary feeds."""
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    items: list[dict] = []

    for entry in root.findall(".//a:entry", ns):
        title = entry.find("a:title", ns)
        link = entry.find("a:link", ns)
        updated = entry.find("a:updated", ns) or entry.find("a:published", ns)
        href = link.get("href") if link is not None else None
        if title is None or not href:
            continue
        items.append({
            "title": clean(title.text or ""),
            "url": urllib.parse.urljoin(base, href),
            "date": (updated.text or "")[:10] if updated is not None else None,
        })

    for item in root.findall(".//item"):
        title = item.findtext("title")
        link = item.findtext("link")
        if not title or not link:
            continue
        items.append({
            "title": clean(title),
            "url": urllib.parse.urljoin(base, link.strip()),
            "date": parse_date(item.findtext("pubDate") or ""),
        })
    return items


def parse_json_api(body: bytes, base: str) -> list[dict]:
    """CourtListener's shape; tolerant of the common REST envelope."""
    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return []
    rows = payload.get("results") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return []
    items = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        title = (row.get("case_name") or row.get("caseName")
                 or row.get("title") or row.get("cluster") or "")
        url = row.get("absolute_url") or row.get("download_url") or row.get("url") or ""
        if not title or not url:
            continue
        items.append({
            "title": clean(str(title))[:300],
            "url": urllib.parse.urljoin(base, str(url)),
            "date": (row.get("date_filed") or row.get("date_created") or "")[:10] or None,
        })
    return items


def parse_index(body: bytes, base: str) -> list[dict]:
    """
    Judgment links out of an HTML index page.

    Deliberately conservative. A court index is mostly navigation, and a loose
    match turns 'Contact Us' into a judgment. A link qualifies only if its path
    or its label reads like a decision, and either it carries a citation or a
    date sits next to it.
    """
    html = body.decode("utf-8", errors="replace")
    host = urllib.parse.urlsplit(base).netloc
    items: list[dict] = []
    seen: set[str] = set()

    for href, anchor in LINK_RE.findall(html):
        label = clean(anchor)
        if len(label) < 12 or len(label) > 300:
            continue
        target = urllib.parse.urljoin(base, href.strip())
        parts = urllib.parse.urlsplit(target)
        if parts.scheme not in ("http", "https") or parts.netloc != host:
            continue
        if target in seen:
            continue
        looks_like = bool(JUDGMENT_PATH_RE.search(parts.path)
                          or JUDGMENT_PATH_RE.search(label))
        has_marker = bool(CITATION_RE.search(label) or parse_date(label))
        if not (looks_like and has_marker):
            continue
        seen.add(target)
        items.append({"title": label, "url": target, "date": parse_date(label)})
    return items


PARSERS = {
    "atom": parse_feed, "rss": parse_feed,
    "json-api": parse_json_api, "html-index": parse_index,
}


def probe(source: dict, robots_cache: dict) -> dict:
    """Fetch once, report exactly what came back, change nothing else."""
    url = source["url"]
    if not robots_allows(url, robots_cache):
        return {"status": "blocked", "note": "robots.txt disallows this crawler",
                "items": 0}
    body, content_type, note = fetch(url)
    if body is None:
        return {"status": "unreachable", "note": note, "items": 0}
    items = PARSERS.get(source["kind"], parse_index)(body, url)
    if not items:
        return {"status": "no-items",
                "note": f"fetched {len(body)} bytes ({content_type.split(';')[0]}) "
                        "but no records could be parsed",
                "items": 0}
    return {"status": "ok", "note": f"{content_type.split(';')[0]}",
            "items": len(items)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--probe", action="store_true",
                        help="verify sources and record status; collect nothing")
    parser.add_argument("--jurisdiction")
    parser.add_argument("--limit", type=int, default=MAX_PER_SOURCE)
    args = parser.parse_args()

    registry = json.loads(REGISTRY.read_text("utf-8"))
    sources = registry["sources"]
    robots_cache: dict = {}
    run_started = datetime.now(timezone.utc)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    selected = [s for s in sources
                if not args.jurisdiction or s["jurisdiction"] == args.jurisdiction]

    if args.probe:
        ok = 0
        for source in selected:
            time.sleep(CRAWL_DELAY)
            result = probe(source, robots_cache)
            source["status"] = result["status"]
            source["lastProbe"] = run_started.isoformat().replace("+00:00", "Z")
            source["probeNote"] = result["note"]
            source["probeItems"] = result["items"]
            mark = "ok  " if result["status"] == "ok" else "    "
            log(f"{mark}[{source['jurisdiction']}] {source['name']}: "
                f"{result['status']} — {result['note']} ({result['items']} items)")
            ok += result["status"] == "ok"
        REGISTRY.write_text(json.dumps(registry, indent=2, ensure_ascii=False), "utf-8")
        print()
        log(f"{ok} of {len(selected)} sources verified; registry updated")
        return 0

    records: list[dict] = []
    if OUTPUT_FILE.exists():
        records = json.loads(OUTPUT_FILE.read_text("utf-8")).get("records", [])
    seen = {r["id"] for r in records}
    added = 0

    for source in selected:
        if source.get("status") != "ok":
            log(f"skip {source['name']}: status is "
                f"'{source.get('status', 'unverified')}' — run --probe first")
            continue
        time.sleep(CRAWL_DELAY)
        if not robots_allows(source["url"], robots_cache):
            continue
        body, _, note = fetch(source["url"])
        if body is None:
            log(f"{source['name']}: {note}")
            continue

        items = PARSERS.get(source["kind"], parse_index)(body, source["url"])[: args.limit]
        fresh = 0
        for item in items:
            key = hashlib.sha256(item["url"].encode()).hexdigest()[:16]
            if key in seen:
                continue
            seen.add(key)
            records.append({
                "id": key,
                "jurisdiction": source["jurisdiction"],
                "court": source["organisation"],
                "sourceName": source["name"],
                # Title and link only. Full text is never stored or published,
                # whatever the licence permits.
                "title": item["title"][:300],
                "decidedOn": item["date"],
                "url": item["url"],
                "language": source["language"],
                "licence": source["licence"],
                "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
            })
            fresh += 1
        added += fresh
        log(f"{source['jurisdiction']}: {source['name']} +{fresh}")

    records.sort(key=lambda r: (r["decidedOn"] or "", r["retrievedAt"]), reverse=True)

    by_jurisdiction: dict[str, int] = {}
    for record in records:
        by_jurisdiction[record["jurisdiction"]] = by_jurisdiction.get(
            record["jurisdiction"], 0) + 1

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "method": "Case name, court, date and link taken from official court and "
                  "justice-ministry sources. Full judgment text is never stored or "
                  "republished; every record links to the official record.",
        "total": len(records),
        "byJurisdiction": dict(sorted(by_jurisdiction.items())),
        "records": records,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"added {added}; {len(records)} records across {len(by_jurisdiction)} jurisdictions")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League court record collection")
    sys.exit(main())
