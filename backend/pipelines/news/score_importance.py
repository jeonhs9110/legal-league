"""
League of Legals — article importance, and a front page that is not all India.

    python backend/pipelines/news/score_importance.py
    python backend/pipelines/news/score_importance.py --top 6

THE PROBLEM

Our Asia-Pacific feed is 342 stories and every one is Indian, because the only
two Asian sources that permit crawling are Bar & Bench and LiveLaw, and both
cover Indian courts. Sorted by date, the front page becomes an Indian legal
newsletter. That is a sourcing gap, and it is not fixed by pretending the
stories are less good — they are good; there are simply too many of them from
one place.

WHAT IMPORTANCE MEASURES

  capital      The money at stake, normalised to USD and scored on a log scale
               so a $2bn matter outranks a $200m one without outranking it by
               ten times. Currency matters: the corpus carries £, ₹, ¥, S$, €
               and A$, and comparing them raw would rank by exchange rate.

  forum        Which court. An apex court binds a whole jurisdiction; a
               district court binds the parties. Weighted accordingly.

  reach        Whether the matter is cross-border or sector-wide — a regulator
               acting against an industry outranks one acting against a shop.

  firms        Whether a firm in our directory is named. This is a legal
               directory; a story naming firms is on-topic in a way a general
               crime story is not.

  freshness    Gentle recency decay, not a cliff. A significant judgment from
               last week outranks a routine one from this morning.

THE DIVERSITY RULE

Raw importance would still return an Indian top six, because two thirds of the
corpus is Indian and importance is roughly uniform across sources. So selection
is greedy with a saturation penalty: each story already chosen from a
jurisdiction makes the next story from that jurisdiction cost more. The
penalty is proportional, not a quota — an Indian story that is genuinely the
most important story of the day still wins. It has to be better than the
alternatives by a margin that grows as India fills the page.

That is a presentation decision, and it is disclosed on the page rather than
applied quietly.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
NEWS_FILE = REPO / "frontend" / "src" / "data" / "news.json"
RANKINGS_FILE = REPO / "frontend" / "src" / "data" / "rankings.json"
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "news_importance.json"

# Fixed indicative rates. Deliberately static: a story's importance should not
# change because a currency moved overnight.
FX_TO_USD = {
    "USD": 1.0, "GBP": 1.27, "EUR": 1.09, "INR": 0.012, "KRW": 0.00072,
    "JPY": 0.0065, "CNY": 0.14, "SGD": 0.74, "AUD": 0.66, "HKD": 0.128,
    "CAD": 0.73, "CHF": 1.12, "BRL": 0.18, "ZAR": 0.055, "AED": 0.27,
}

SYMBOL_TO_CODE = {
    "$": "USD", "£": "GBP", "€": "EUR", "₹": "INR", "₩": "KRW",
    "¥": "JPY", "S$": "SGD", "A$": "AUD", "HK$": "HKD", "C$": "CAD",
    "R$": "BRL", "Rs": "INR", "Rs.": "INR", "₨": "INR",
}

# Indian numbering: 1 crore = 10m, 1 lakh = 100k. Missing these reads
# "₹25,000 crore" as twenty-five thousand rupees.
SCALE = {
    "trillion": 1e12, "tn": 1e12,
    "billion": 1e9, "bn": 1e9,
    "million": 1e6, "mn": 1e6, "m": 1e6,
    "crore": 1e7, "cr": 1e7,
    "lakh": 1e5, "lac": 1e5,
    "thousand": 1e3, "k": 1e3,
}

MONEY_RE = re.compile(
    r"(?P<sym>HK\$|S\$|A\$|C\$|R\$|Rs\.?|₨|[$£€₹₩¥])\s*"
    r"(?P<amount>[\d,]+(?:\.\d+)?)\s*"
    r"(?P<scale>trillion|billion|million|crore|lakh|lac|thousand|tn|bn|mn|cr|k|m)?",
    re.I,
)
CODE_MONEY_RE = re.compile(
    r"\b(?P<code>USD|GBP|EUR|INR|KRW|JPY|CNY|SGD|AUD|HKD|CAD|CHF|BRL|ZAR|AED)\s*"
    r"(?P<amount>[\d,]+(?:\.\d+)?)\s*"
    r"(?P<scale>trillion|billion|million|crore|lakh|thousand|tn|bn|mn|cr|k|m)?",
    re.I,
)

# Forum seniority. An apex court binds a jurisdiction.
FORUM_WEIGHTS = [
    (re.compile(r"supreme court|apex court|constitutional court|privy council|"
                r"court of final appeal|大法院|最高裁|最高人民法院", re.I), 1.00),
    (re.compile(r"court of appeal|appellate|high court|federal court|"
                r"court of session|高等法院", re.I), 0.72),
    (re.compile(r"tribunal|commission|regulator|authority|nclt|itat|cci|"
                r"competition|antitrust", re.I), 0.55),
    (re.compile(r"district court|magistrate|sessions court|county court", re.I), 0.32),
]

REACH_RE = re.compile(
    r"cross[- ]border|international|multinational|global|nationwide|"
    r"industry[- ]wide|sector|landmark|precedent|constitutional|"
    r"class action|mass tort|sanctions|merger|acquisition|ipo|listing", re.I)

# Stories that are administrative rather than newsworthy.
ROUTINE_RE = re.compile(
    r"^(daily|weekly|roundup|round[- ]up|digest|newsletter|briefs?|"
    r"in brief|this week|live updates?|watch:|video:)\b", re.I)


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def to_usd(text: str) -> int:
    """Largest USD amount mentioned. Zero when no money is named."""
    best = 0
    for pattern, key in ((MONEY_RE, "sym"), (CODE_MONEY_RE, "code")):
        for match in pattern.finditer(text):
            token = match.group(key)
            code = (SYMBOL_TO_CODE.get(token.strip())
                    if key == "sym" else token.upper())
            rate = FX_TO_USD.get(code or "")
            if not rate:
                continue
            try:
                amount = float(match.group("amount").replace(",", ""))
            except ValueError:
                continue
            scale = match.group("scale")
            amount *= SCALE.get(scale.lower(), 1.0) if scale else 1.0
            usd = amount * rate
            # Below $10k is a filing fee; above $1tn is a misparse.
            if 10_000 <= usd <= 1e12:
                best = max(best, int(usd))
    return best


def score(article: dict, firm_names: set[str]) -> dict:
    title = article.get("title", "")
    text = f"{title} {article.get('excerpt') or ''}"

    # The headline's figure wins over the body's. "Tribunal approves landmark
    # £200m Mastercard settlement" sits beside an excerpt mentioning the £14bn
    # claim; taking the largest number anywhere reported the settlement as
    # $17.8bn. What a headline puts in front is what the story is about.
    usd = to_usd(title) or to_usd(text)
    # log10 scaled: $100k -> 0.0, $1bn -> ~0.8, $1tn -> 1.0.
    capital = min(1.0, max(0.0, (math.log10(usd) - 5) / 7)) if usd else 0.0

    forum = 0.0
    for pattern, weight in FORUM_WEIGHTS:
        if pattern.search(text):
            forum = max(forum, weight)

    reach = min(1.0, len(REACH_RE.findall(text)) / 3)

    lowered = text.lower()
    firms = sum(1 for name in firm_names if name in lowered)
    firm_signal = min(1.0, firms / 2)

    try:
        age_days = (datetime.now(timezone.utc)
                    - datetime.fromisoformat(
                        article["publishedAt"].replace("Z", "+00:00"))).days
    except Exception:  # noqa: BLE001
        age_days = 30
    freshness = math.exp(-max(0, age_days) / 45)

    importance = (
        0.34 * capital + 0.26 * forum + 0.16 * reach
        + 0.14 * firm_signal + 0.10 * freshness
    )
    if ROUTINE_RE.search(article.get("title", "")):
        importance *= 0.35

    return {
        "id": article["id"],
        "importance": round(importance, 4),
        "capitalUsd": usd or None,
        "components": {
            "capital": round(capital, 3), "forum": round(forum, 3),
            "reach": round(reach, 3), "firms": round(firm_signal, 3),
            "freshness": round(freshness, 3),
        },
    }


def diversified(scored: list[dict], by_id: dict[str, dict], count: int,
                penalty: float = 0.55) -> list[dict]:
    """
    Greedy selection with a saturation penalty per jurisdiction.

    Each story already taken from a jurisdiction makes the next one from there
    cost more. Not a quota: a genuinely dominant story still wins, it simply has
    to beat the alternatives by a widening margin.
    """
    chosen: list[dict] = []
    taken: dict[str, int] = {}
    pool = sorted(scored, key=lambda s: -s["importance"])

    while pool and len(chosen) < count:
        best, best_value = None, -1.0
        for entry in pool:
            iso = by_id[entry["id"]].get("jurisdictionIso") or "none"
            adjusted = entry["importance"] * (penalty ** taken.get(iso, 0))
            if adjusted > best_value:
                best, best_value = entry, adjusted
        if best is None:
            break
        iso = by_id[best["id"]].get("jurisdictionIso") or "none"
        taken[iso] = taken.get(iso, 0) + 1
        chosen.append({**best, "adjusted": round(best_value, 4)})
        pool.remove(best)
    return chosen


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=6)
    args = parser.parse_args()

    news = json.loads(NEWS_FILE.read_text("utf-8"))
    articles = [a for a in news["articles"] if (a.get("language") or "en") == "en"]

    firm_names: set[str] = set()
    if RANKINGS_FILE.exists():
        for j in json.loads(RANKINGS_FILE.read_text("utf-8"))["jurisdictions"]:
            for f in j.get("firms") or []:
                name = f["name"].lower()
                if len(name) >= 8:
                    firm_names.add(name)

    scored = [score(a, firm_names) for a in articles]
    by_id = {a["id"]: a for a in articles}
    highlights = diversified(scored, by_id, args.top)

    from collections import Counter
    raw_top = sorted(scored, key=lambda s: -s["importance"])[:args.top]
    raw_mix = Counter(by_id[s["id"]]["sourceName"] for s in raw_top)
    div_mix = Counter(by_id[s["id"]]["sourceName"] for s in highlights)

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "method": (
            "Importance combines the capital at stake (normalised to USD), the "
            "seniority of the forum, how far the matter reaches, whether a firm "
            "in this directory is named, and recency. The front-page selection "
            "then applies a saturation penalty per jurisdiction, so one "
            "well-covered market cannot fill the page. India supplies two thirds "
            "of the corpus because it supplies two of our three crawlable Asian "
            "sources; the penalty corrects the presentation, not the reporting."
        ),
        "currencyNote": "All figures converted to USD at fixed indicative rates.",
        "scored": len(scored),
        "withCapital": sum(1 for s in scored if s["capitalUsd"]),
        "highlightIds": [h["id"] for h in highlights],
        "scores": {s["id"]: s["importance"] for s in scored},
        "capitalUsd": {s["id"]: s["capitalUsd"] for s in scored if s["capitalUsd"]},
    }, indent=2, ensure_ascii=False), "utf-8")

    log(f"scored {len(scored)} articles; {sum(1 for s in scored if s['capitalUsd'])} name a sum of money")
    print()
    log("top six WITHOUT the diversity rule:")
    for s in raw_top:
        a = by_id[s["id"]]
        money = f" ${s['capitalUsd']:,}" if s["capitalUsd"] else ""
        log(f"   {s['importance']:.3f}{money}  [{a['sourceName']}] {a['title'][:58]}")
    log(f"   sources: {dict(raw_mix)}")
    print()
    log("top six WITH it:")
    for s in highlights:
        a = by_id[s["id"]]
        money = f" ${s['capitalUsd']:,}" if s["capitalUsd"] else ""
        log(f"   {s['importance']:.3f}{money}  [{a['sourceName']}] {a['title'][:58]}")
    log(f"   sources: {dict(div_mix)}")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("League of Legals article importance")
    sys.exit(main())
