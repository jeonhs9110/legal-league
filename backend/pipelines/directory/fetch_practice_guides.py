"""
League of Legals — jurisdiction practice guides published by law firms.

    python backend/pipelines/directory/fetch_practice_guides.py
    python backend/pipelines/directory/fetch_practice_guides.py --jurisdiction south-korea

Firms publish standing guides to doing business in their own market — Shin &
Kim's "Doing Business in Korea" is the type. They are written to be given away,
they are the single most useful thing on most firm websites, and no directory
collects them, because a directory that only ranks has nowhere to put them.

This gives them somewhere: a reader who clicks Korea gets the ranked firms and,
beside them, the guides those firms publish about practising there.

Two editorial rules:

  * Only guides about the jurisdiction the firm is listed in. A Singapore firm's
    guide to Indonesia is a guide to Indonesia, and belongs on Indonesia's page
    if it belongs anywhere — filing it under Singapore would tell a reader the
    opposite of the truth about who knows that market.

  * Duplicates are kept, not collapsed. When six firms publish a Korea guide,
    that is worth showing: it says the market is competitive and it lets a
    reader compare. Collapsing them to one would hide the most interesting
    signal on the page. They are grouped by jurisdiction and every publishing
    firm is named.

Nothing is republished. Title, publishing firm, year and a link — the guide
stays on the firm's own site, where the firm wants the traffic anyway.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_firm_details import (  # noqa: E402
    CRAWL_DELAY, Renderer, Robots, clean, discover_links, get,
)

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
DETAILS_FILE = REPO / "frontend" / "src" / "data" / "firm_details.json"
SEEDS_FILE = Path(__file__).resolve().parent / "firm_seeds.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "practice_guides.json"

# Jurisdiction slug -> the names a firm might use for that market in a title.
JURISDICTION_TERMS: dict[str, list[str]] = {
    "south-korea": ["korea", "korean", "한국", "대한민국"],
    "japan": ["japan", "japanese", "日本"],
    "china": ["china", "chinese", "prc", "中国"],
    "taiwan": ["taiwan", "taiwanese", "台灣", "台湾"],
    "hong-kong": ["hong kong", "hongkong", "香港"],
    "singapore": ["singapore", "singaporean"],
    "india": ["india", "indian"],
    "indonesia": ["indonesia", "indonesian"],
    "malaysia": ["malaysia", "malaysian"],
    "philippines": ["philippines", "philippine"],
    "vietnam": ["vietnam", "vietnamese"],
    "thailand": ["thailand", "thai"],
    "united-kingdom": ["united kingdom", "uk", "england", "britain", "british"],
    "united-states": ["united states", "usa", "u.s.", "america", "american"],
    "canada": ["canada", "canadian"],
    "australia": ["australia", "australian"],
    "germany": ["germany", "german", "deutschland"],
    "france": ["france", "french"],
    "italy": ["italy", "italian"],
    "spain": ["spain", "spanish"],
    "netherlands": ["netherlands", "dutch", "holland"],
    "sweden": ["sweden", "swedish"],
    "switzerland": ["switzerland", "swiss"],
    "ireland": ["ireland", "irish"],
    "israel": ["israel", "israeli"],
    "south-africa": ["south africa", "south african"],
    "brazil": ["brazil", "brazilian", "brasil"],
    "mexico": ["mexico", "mexican", "méxico"],
    "argentina": ["argentina", "argentine"],
    "turkey": ["turkey", "turkish", "türkiye"],
    "united-arab-emirates": ["uae", "united arab emirates", "dubai", "abu dhabi"],
    "saudi-arabia": ["saudi arabia", "saudi", "ksa"],
    "nigeria": ["nigeria", "nigerian"],
    "russia": ["russia", "russian"],
    "macao": ["macao", "macau", "澳門"],
}

# What a guide calls itself. Deliberately narrow: "guide" alone matches a style
# guide and a guide to the office car park.
GUIDE_RE = re.compile(
    r"(doing business|business guide|legal guide|practice guide|investment guide|"
    r"guide to (?:doing business|investing|establishing|setting up|the legal)|"
    r"market guide|country guide|jurisdiction guide|법률\s*가이드|비즈니스\s*가이드|"
    r"investing in|setting up (?:a )?business|establishing a (?:business|presence)|"
    r"foreign investment guide|legal handbook|desk reference)",
    re.I,
)

# Links worth opening in search of one.
SECTION_RE = re.compile(
    r"(publication|insight|resource|guide|knowledge|report|brochure|library|"
    r"thought.?leadership|간행물|자료|발간)", re.I)

YEAR_RE = re.compile(r"\b(20[12]\d)\b")


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def is_about(title: str, url: str, jurisdiction: str) -> bool:
    """Does this guide concern the jurisdiction the firm is listed in?"""
    terms = JURISDICTION_TERMS.get(jurisdiction, [])
    haystack = f"{title} {url}".lower()
    return any(term in haystack for term in terms)


def find_guides(html: str, base: str, jurisdiction: str) -> list[dict]:
    """Guide-shaped links on a page, filtered to this jurisdiction."""
    out: list[dict] = []
    seen: set[str] = set()
    for href, anchor in re.findall(
        r'<a\b[^>]*href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', html, re.S | re.I
    ):
        title = clean(anchor)
        if not 8 <= len(title) <= 180:
            continue
        if not GUIDE_RE.search(title) and not GUIDE_RE.search(href):
            continue
        import urllib.parse

        url = urllib.parse.urljoin(base + "/", href.strip())
        if url in seen:
            continue
        if not is_about(title, url, jurisdiction):
            continue
        seen.add(url)
        year = YEAR_RE.search(f"{title} {url}")
        out.append({
            "title": title,
            "url": url,
            "year": int(year.group(1)) if year else None,
        })
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jurisdiction")
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    if not DETAILS_FILE.exists():
        log("run fetch_firm_details.py first")
        return 1

    firms = json.loads(DETAILS_FILE.read_text("utf-8"))["firms"]
    if args.jurisdiction:
        firms = [f for f in firms if f["jurisdiction"] == args.jurisdiction]
    if args.limit:
        firms = firms[: args.limit]

    robots = Robots()
    renderer = Renderer()
    run_started = datetime.now(timezone.utc)

    guides: list[dict] = []
    for firm in firms:
        base = firm["website"]
        time.sleep(CRAWL_DELAY)
        homepage = get(base, renderer)
        if not homepage:
            continue

        found = find_guides(homepage, base, firm["jurisdiction"])
        # Publications sections, where a standing guide usually lives rather
        # than on the front page.
        for url in [u for u in discover_links(homepage, base, limit=30)
                    if SECTION_RE.search(u)][:4]:
            if len(found) >= 6 or not robots.allows(url):
                continue
            time.sleep(CRAWL_DELAY)
            html = get(url, renderer)
            if html:
                found.extend(find_guides(html, base, firm["jurisdiction"]))

        unique = {g["url"]: g for g in found}
        for guide in list(unique.values())[:5]:
            guides.append({
                **guide,
                "firmSlug": firm["slug"],
                "firmName": firm["name"],
                "jurisdiction": firm["jurisdiction"],
                "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
            })
        if unique:
            log(f"    {firm['name']}: {len(unique)} guide(s) — "
                f"{list(unique.values())[0]['title'][:56]}")

    renderer.close()

    by_jurisdiction: dict[str, int] = {}
    for guide in guides:
        by_jurisdiction[guide["jurisdiction"]] = (
            by_jurisdiction.get(guide["jurisdiction"], 0) + 1)

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "method": (
            "Standing guides to doing business in a jurisdiction, published by "
            "firms listed in that jurisdiction. Title, firm, year and a link "
            "only — the guide stays on the firm's own site. Where several firms "
            "publish a guide to the same market all are listed: that several "
            "compete to explain a jurisdiction is itself worth knowing."
        ),
        "total": len(guides),
        "byJurisdiction": dict(sorted(by_jurisdiction.items())),
        "guides": guides,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"{len(guides)} guides across {len(by_jurisdiction)} jurisdictions")
    for slug, count in sorted(by_jurisdiction.items(), key=lambda kv: -kv[1])[:10]:
        log(f"   {count:>3}  {slug}")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("League of Legals practice guide collection")
    sys.exit(main())
