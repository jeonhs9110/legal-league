"""
Legal League — Korean law firm revenue, per lawyer.

    python backend/pipelines/rankings/revenue_kr.py
    python backend/pipelines/rankings/revenue_kr.py --dry-run

WHY PER LAWYER, NOT REVENUE

Raw turnover measures size, and ranking by it just re-sorts the market by
headcount. Korea makes the point cleanly: on revenue, Lee & Ko leads, having
been the first Korean firm past ₩400bn. Divide by lawyer count and the order
changes — Yulchon, then Yoon & Yang, then Bae Kim & Lee. That second list says
something about the practice; the first says the firm is large.

WHERE THE NUMBER COMES FROM

Korean firms do not file public accounts the way a UK LLP does. The revenue
figures that circulate originate in the VAT taxable-base declarations
(부가가치세 과세표준 신고액) firms file with the National Tax Service (국세청).
That filing is the authority — not the Ministry of Justice, which registers
firms but does not publish their earnings.

WHAT THIS USES, AND WHAT IT REFUSES

  * A firm's own published figure. When 대륜 announces ₩130bn, that is the firm
    speaking about itself, and it is quotable with a link — the same rule that
    governs award recognitions here.
  * Official open data where a machine-readable series exists.

  It does NOT use the per-firm league table 법률신문 compiles each year. That
  publication is already on our excluded source list — it refuses this crawler
  with a 403 — and its table is a compilation in exactly the way a Chambers
  band table is. Taking it would contradict the position this directory is
  built on, for a number we can get honestly or not at all.

CONSEQUENCE

Coverage will be partial, because it reflects which firms announce revenue
rather than which firms earn it. A firm that publishes nothing scores zero on
this signal rather than being estimated, and the jurisdiction page says so.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "directory"))
from fetch_firm_details import (  # noqa: E402
    CRAWL_DELAY, Renderer, Robots, clean, discover_links, get,
)

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
DETAILS_FILE = REPO / "frontend" / "src" / "data" / "firm_details.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "firm_revenue.json"

JURISDICTION = "south-korea"
CURRENCY = "KRW"
# Indicative, fixed so a figure does not move because a rate did.
KRW_TO_USD = 0.00072

# Korean firms write revenue in 억원 (hundred million won) or 조원 (trillion).
# "매출 1300억원" is 130 billion won.
REVENUE_RE = re.compile(
    r"(?:매출(?:액)?|수익|영업수익)[^\d]{0,12}([\d,\.]+)\s*(조|억)\s*원", re.I)
REVENUE_EN_RE = re.compile(
    r"revenue[^\d]{0,18}(?:KRW|₩)?\s*([\d,\.]+)\s*(trillion|billion|million)", re.I)
YEAR_RE = re.compile(r"(20[12]\d)\s*년|\b(20[12]\d)\b")

NEWS_LINK_RE = re.compile(r"(news|press|media|notice|보도|공지|소식|뉴스)", re.I)

# Aspiration, not achievement. Lee & Ko's site carries its managing partner
# saying the firm will "open the era of 500 billion won in revenue" — a target,
# quoted in an interview. Read as reported revenue it would have put Korea's
# second-largest firm on the page with a number nobody has earned yet, sourced
# to the firm, and looking entirely credible.
ASPIRATION_RE = re.compile(
    r"(열 것|열겠|목표|전망|예상|기대|계획|추진|달성하겠|넘어설 것|시대를? 열|"
    r"돌파하겠|will (?:reach|exceed|open|hit|achieve|target)|aims? to|"
    r"targets?|goal|forecast|expects? to|plans? to|by 20[3-9]\d)",
    re.I,
)


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def to_krw(amount: str, unit: str) -> int | None:
    try:
        value = float(amount.replace(",", ""))
    except ValueError:
        return None
    multiplier = {
        "조": 1_000_000_000_000, "억": 100_000_000,
        "trillion": 1_000_000_000_000, "billion": 1_000_000_000,
        "million": 1_000_000,
    }.get(unit.lower())
    if not multiplier:
        return None
    krw = int(value * multiplier)
    # A Korean firm's annual revenue below ₩1bn or above ₩5tn is a misparse.
    return krw if 1_000_000_000 <= krw <= 5_000_000_000_000 else None


def extract_revenue(text: str) -> tuple[int, int | None, str] | None:
    """Returns (krw, year, the sentence it came from)."""
    for pattern in (REVENUE_RE, REVENUE_EN_RE):
        for match in pattern.finditer(text):
            krw = to_krw(match.group(1), match.group(2))
            if not krw:
                continue
            start, end = max(0, match.start() - 110), min(len(text), match.end() + 90)
            context = text[start:end].strip()
            if ASPIRATION_RE.search(context):
                continue
            year_match = YEAR_RE.search(context)
            year = None
            if year_match:
                year = int(year_match.group(1) or year_match.group(2))
                if not 2015 <= year <= 2030:
                    year = None
            return krw, year, context
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not DETAILS_FILE.exists():
        log("run fetch_firm_details.py first")
        return 1

    firms = [f for f in json.loads(DETAILS_FILE.read_text("utf-8"))["firms"]
             if f["jurisdiction"] == JURISDICTION]
    log(f"{len(firms)} Korean firms on file")

    robots = Robots()
    renderer = Renderer()
    run_started = datetime.now(timezone.utc)
    records: list[dict] = []

    for firm in firms:
        base = firm["website"]
        time.sleep(CRAWL_DELAY)
        homepage = get(base, renderer)
        if not homepage:
            log(f"    {firm['name']}: site unreachable")
            continue

        pages = [(base, homepage)]
        if not args.dry_run:
            for url in [u for u in discover_links(homepage, base, limit=30)
                        if NEWS_LINK_RE.search(u)][:4]:
                if not robots.allows(url):
                    continue
                time.sleep(CRAWL_DELAY)
                html = get(url, renderer)
                if html:
                    pages.append((url, html))

        found = None
        for url, html in pages:
            found = extract_revenue(clean(html))
            if found:
                found = (*found, url)
                break

        if not found:
            log(f"    {firm['name']}: publishes no revenue figure")
            continue

        krw, year, quote, source_url = found
        headcount = firm.get("headcount")
        records.append({
            "slug": firm["slug"],
            "name": firm["name"],
            "jurisdiction": JURISDICTION,
            "revenueKrw": krw,
            "revenueUsd": int(krw * KRW_TO_USD),
            "fiscalYear": year,
            "headcount": headcount,
            # The whole point of the signal. Null where headcount is unknown —
            # revenue alone is not this measure and must not be shown as if it were.
            "revenuePerLawyerKrw": int(krw / headcount) if headcount else None,
            "quote": quote[:300],
            "sourceUrl": source_url,
            "basis": (
                "Figure as published by the firm. Korean law firm revenue "
                "originates in VAT taxable-base declarations filed with the "
                "National Tax Service."
            ),
            "retrievedAt": run_started.isoformat().replace("+00:00", "Z"),
        })
        per = records[-1]["revenuePerLawyerKrw"]
        log(f"    {firm['name']}: ₩{krw:,}"
            + (f" / {headcount} lawyers = ₩{per:,} each" if per else " (no headcount)"))

    renderer.close()
    ranked = [r for r in records if r["revenuePerLawyerKrw"]]
    ranked.sort(key=lambda r: -r["revenuePerLawyerKrw"])

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "currency": CURRENCY,
        "method": (
            "Revenue divided by professional headcount. Raw revenue measures "
            "size, not practice: on turnover Lee & Ko leads Korea; per lawyer "
            "the order is different. Figures are taken only from firms' own "
            "publications; the annual league table compiled by 법률신문 is not "
            "used, being both an excluded source and a compilation."
        ),
        "underlyingSource": "국세청 부가가치세 과세표준 신고액 (National Tax Service)",
        "firmsWithRevenue": len(records),
        "firmsRankable": len(ranked),
        "firms": records,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"{len(records)} firms published a revenue figure; "
        f"{len(ranked)} also had a headcount and can be ranked per lawyer")
    if len(ranked) < len(records):
        log(f"  {len(records) - len(ranked)} have revenue but no headcount — "
            "not rankable on this signal, and not estimated")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League Korean revenue per lawyer")
    sys.exit(main())
