"""
Legal League — firm directory collector.

Builds a real list of law firms per jurisdiction from Wikipedia's category graph,
via the MediaWiki API. Firm names, the jurisdiction they belong to, and the
source URL are facts; they are not copyrightable, and we do not reproduce any
Wikipedia prose. Attribution is recorded in the output regardless.

    python backend/pipelines/directory/fetch_firms.py

This produces *entities*, not rankings. A firm appearing here means "this firm
exists and practises in this jurisdiction", nothing more. Scoring happens in
backend/pipelines/rankings/, and only where there is evidence to score from.
"""

from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
JURISDICTIONS_FILE = Path(__file__).resolve().parent / "jurisdictions.json"
RAW_DIR = ROOT / "data" / "raw" / "directory"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "firms.json"

API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "LegalLeagueBot/0.1 (+https://legalleague.org/about; legal directory)"
REQUEST_DELAY = 0.5          # courteous; the API allows far more
TIMEOUT = 25

# Category members that are lists, categories, or disambiguation pages rather
# than firms.
NOT_A_FIRM = re.compile(
    r"^(List of|Category:|Template:|Index of)|"
    r"(law firms?|legal profession|bar association)$",
    re.I,
)
YEAR_RE = re.compile(r"\b(1[5-9]\d{2}|20[0-2]\d)\b")


def api_get(params: dict) -> dict:
    params = {**params, "format": "json", "formatversion": "2"}
    url = f"{API}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def category_members(category: str) -> list[str]:
    """All pages in a category, following continuation."""
    titles: list[str] = []
    cont: dict = {}
    while True:
        data = api_get(
            {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": f"Category:{category}",
                "cmlimit": "500",
                "cmtype": "page",
                **cont,
            }
        )
        members = data.get("query", {}).get("categorymembers", [])
        titles.extend(m["title"] for m in members)
        if "continue" not in data:
            break
        cont = data["continue"]
        time.sleep(REQUEST_DELAY)
    return titles


def slugify(value: str) -> str:
    value = re.sub(r"\s*\([^)]*\)$", "", value).strip()          # drop "(law firm)"
    value = value.replace("&", " and ")
    value = re.sub(r"[^\w\s-]", "", value, flags=re.UNICODE)
    return re.sub(r"[\s_]+", "-", value).strip("-").lower()


def display_name(title: str) -> str:
    """Wikipedia disambiguates with a parenthetical; firms do not use one."""
    return re.sub(r"\s*\((law firm|company|firm)\)$", "", title, flags=re.I).strip()


def fetch_extracts(titles: list[str]) -> dict[str, str]:
    """
    Batched intro extracts. Used only to derive facts (a founding year); the
    prose itself is never stored or displayed, which keeps us clear of the
    CC BY-SA share-alike obligation on Wikipedia text.
    """
    out: dict[str, str] = {}
    for i in range(0, len(titles), 20):
        batch = titles[i : i + 20]
        try:
            data = api_get(
                {
                    "action": "query",
                    "prop": "extracts",
                    "exintro": "1",
                    "explaintext": "1",
                    "titles": "|".join(batch),
                }
            )
        except Exception as error:  # noqa: BLE001
            print(f"    extract batch failed: {error}")
            continue
        for page in data.get("query", {}).get("pages", []):
            if "extract" in page:
                out[page["title"]] = page["extract"][:600]
        time.sleep(REQUEST_DELAY)
    return out


def founded_year(extract: str) -> int | None:
    """
    First plausible year in the intro, when it appears near a founding verb.
    Conservative: returns None rather than guessing.
    """
    window = extract[:400]
    if not re.search(r"\b(founded|established|formed|created|merger|merged)\b", window, re.I):
        return None
    years = [int(y) for y in YEAR_RE.findall(window)]
    years = [y for y in years if 1500 <= y <= datetime.now(timezone.utc).year]
    return min(years) if years else None


def collect() -> int:
    registry = json.loads(JURISDICTIONS_FILE.read_text("utf-8"))
    run_started = datetime.now(timezone.utc)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    jurisdictions_out = []
    firms_out = []
    seen_slugs: set[str] = set()
    total_firms = 0

    for jurisdiction in registry["jurisdictions"]:
        titles: list[str] = []
        used_category = None

        for category in jurisdiction["wiki_categories"]:
            try:
                found = category_members(category)
            except Exception as error:  # noqa: BLE001
                print(f"  {jurisdiction['slug']}: category '{category}' failed: {error}")
                continue
            if found:
                titles, used_category = found, category
                break
            time.sleep(REQUEST_DELAY)

        titles = [t for t in titles if not NOT_A_FIRM.search(t)]
        extracts = fetch_extracts(titles) if titles else {}

        jurisdiction_firms = []
        for title in titles:
            name = display_name(title)
            slug = slugify(name)
            if not slug or slug in seen_slugs:
                continue
            seen_slugs.add(slug)

            extract = extracts.get(title, "")
            jurisdiction_firms.append(
                {
                    "slug": slug,
                    "name": name,
                    "jurisdictionIso": jurisdiction["iso_numeric"],
                    "foundedYear": founded_year(extract),
                    "sourceUrl": "https://en.wikipedia.org/wiki/"
                    + urllib.parse.quote(title.replace(" ", "_")),
                    "sourceName": "Wikipedia",
                    "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
                }
            )

        jurisdiction_firms.sort(key=lambda f: f["name"])
        firms_out.extend(jurisdiction_firms)
        total_firms += len(jurisdiction_firms)

        jurisdictions_out.append(
            {
                "isoNumeric": jurisdiction["iso_numeric"],
                "isoAlpha2": jurisdiction["iso_alpha2"],
                "slug": jurisdiction["slug"],
                "name": jurisdiction["name"],
                "region": jurisdiction["region"],
                "g20": jurisdiction["g20"],
                "firmCount": len(jurisdiction_firms),
                "sourceCategory": used_category,
            }
        )

        print(f"  {jurisdiction['slug']:<22} {len(jurisdiction_firms):>3} firms"
              f"  ({used_category or 'no category resolved'})")
        time.sleep(REQUEST_DELAY)

    payload = {
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "attribution": {
            "source": "Wikipedia (English)",
            "license": "CC BY-SA 4.0",
            "note": "Firm names, jurisdictions and founding years are facts drawn "
                    "from Wikipedia articles. No Wikipedia prose is reproduced.",
        },
        "jurisdictions": jurisdictions_out,
        "firms": firms_out,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")
    (RAW_DIR / f"{run_started:%Y%m%dT%H%M%SZ}.json").write_text(
        json.dumps(payload, ensure_ascii=False), "utf-8"
    )

    covered = sum(1 for j in jurisdictions_out if j["firmCount"] > 0)
    print()
    print(f"  {total_firms} firms across {covered}/{len(jurisdictions_out)} jurisdictions")
    print(f"  wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0 if total_firms else 1


if __name__ == "__main__":
    print("Legal League directory collector")
    sys.exit(collect())
