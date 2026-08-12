"""
Legal League — ranking builder.

Reads the firm directory and every evidence source that exists, scores each firm
against the published methodology, and decides — per jurisdiction — whether
there is enough evidence to publish a ranking at all.

    python backend/pipelines/rankings/build_rankings.py

The decision to withhold is the important part of this file.

A ranking is published for a jurisdiction only when the signals we actually hold
account for at least MIN_COVERAGE of the methodology's total weight. Below that,
the jurisdiction is emitted as `directory_only`: real firms, listed
alphabetically, with no scores and no order implied.

That rule exists because the alternative is worse than useless. A composite
score computed from 0% of the intended evidence is not a rough estimate, it is a
fabrication with a decimal point on it — and publishing one against a real,
named firm is defamation exposure, not a rounding error. Conventional
directories solve this by not showing their working. We solve it by not
publishing until the working exists.

Right now every jurisdiction comes out `directory_only`. That is the correct and
expected output, not a bug: no directory-consensus, court-record or submission
evidence has been collected yet. As those collectors land, coverage rises and
jurisdictions cross the threshold on their own.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
DATA_DIR = REPO / "frontend" / "src" / "data"
FIRMS_FILE = DATA_DIR / "firms.json"
NEWS_FILE = DATA_DIR / "news.json"
WEIGHTS_FILE = Path(__file__).resolve().parent / "methodology.json"
OUTPUT_FILE = DATA_DIR / "rankings.json"

# Share of total methodology weight that must be backed by real evidence before
# a jurisdiction's ranking may be published.
MIN_COVERAGE = 0.5

# Tokens dropped when matching a firm name against press coverage, so
# "Kim & Chang" still matches "Kim & Chang LLP".
SUFFIXES = re.compile(
    r"\b(llp|llc|plc|ltd|limited|inc|pc|pllc|law offices?|law firm|"
    r"attorneys?( at law)?|advocates?|associates|partners|and partners|& co\.?)\b",
    re.I,
)
PUNCT = re.compile(r"[^\w\s]", re.UNICODE)


def normalize(value: str) -> str:
    value = SUFFIXES.sub(" ", value)
    value = PUNCT.sub(" ", value)
    return re.sub(r"\s+", " ", value).strip().lower()


def press_mentions(firm_name: str, haystacks: list[str]) -> int:
    """
    Conservative name matching. Short or generic stems are skipped entirely —
    a false positive here would attach a story to the wrong firm, which is a
    defamation vector rather than a display bug.
    """
    stem = normalize(firm_name)
    if len(stem) < 8 or " " not in stem:
        return 0
    return sum(1 for text in haystacks if stem in text)


def build() -> int:
    firms_data = json.loads(FIRMS_FILE.read_text("utf-8"))
    weights = json.loads(WEIGHTS_FILE.read_text("utf-8"))
    run_started = datetime.now(timezone.utc)

    haystacks: list[str] = []
    news_generated = None
    if NEWS_FILE.exists():
        news = json.loads(NEWS_FILE.read_text("utf-8"))
        news_generated = news.get("generatedAt")
        haystacks = [
            normalize(f"{a.get('title', '')} {a.get('excerpt') or ''}")
            for a in news.get("articles", [])
        ]

    firms_by_jurisdiction: dict[str, list[dict]] = {}
    for firm in firms_data["firms"]:
        firms_by_jurisdiction.setdefault(firm["jurisdictionIso"], []).append(firm)

    signal_weights = {s["key"]: s["weight"] for s in weights["signals"]}
    jurisdictions_out = []
    published = 0
    total_mentions = 0

    for jurisdiction in firms_data["jurisdictions"]:
        iso = jurisdiction["isoNumeric"]
        firms = firms_by_jurisdiction.get(iso, [])

        firm_rows = []
        for firm in firms:
            mentions = press_mentions(firm["name"], haystacks)
            total_mentions += mentions
            firm_rows.append(
                {
                    "slug": firm["slug"],
                    "name": firm["name"],
                    "foundedYear": firm["foundedYear"],
                    "sourceUrl": firm["sourceUrl"],
                    "sourceName": firm["sourceName"],
                    "pressMentions": mentions,
                    # No score. See the module docstring.
                    "score": None,
                    "rank": None,
                    "band": None,
                }
            )

        # Evidence actually held for this jurisdiction, by methodology signal.
        evidence = {
            "directoryConsensus": 0,
            "courtRecord": 0,
            "submissions": 0,
            "peerReview": 0,
        }
        coverage = sum(
            signal_weights.get(key, 0) for key, count in evidence.items() if count > 0
        )

        status = "ranked" if coverage >= MIN_COVERAGE and firm_rows else "directory_only"
        if status == "ranked":
            published += 1

        firm_rows.sort(key=lambda f: f["name"])

        jurisdictions_out.append(
            {
                "isoNumeric": iso,
                "isoAlpha2": jurisdiction["isoAlpha2"],
                "slug": jurisdiction["slug"],
                "name": jurisdiction["name"],
                "region": jurisdiction["region"],
                "g20": jurisdiction["g20"],
                "status": status,
                "coverage": round(coverage, 3),
                "minCoverage": MIN_COVERAGE,
                "evidence": evidence,
                "pressMentions": sum(f["pressMentions"] for f in firm_rows),
                "firmCount": len(firm_rows),
                "firms": firm_rows,
            }
        )

    jurisdictions_out.sort(key=lambda j: (-j["firmCount"], j["name"]))

    payload = {
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "methodologyVersion": weights["version"],
        "minCoverage": MIN_COVERAGE,
        "newsSnapshot": news_generated,
        "attribution": firms_data.get("attribution"),
        "summary": {
            "jurisdictions": len(jurisdictions_out),
            "withFirms": sum(1 for j in jurisdictions_out if j["firmCount"]),
            "firms": sum(j["firmCount"] for j in jurisdictions_out),
            "published": published,
            "directoryOnly": len(jurisdictions_out) - published,
        },
        "jurisdictions": jurisdictions_out,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")

    s = payload["summary"]
    print(f"  jurisdictions={s['jurisdictions']} with firms={s['withFirms']} "
          f"firms={s['firms']}")
    print(f"  press mentions matched: {total_mentions}")
    print(f"  rankings published: {s['published']}   directory only: {s['directoryOnly']}")
    print(f"  (a ranking needs >= {int(MIN_COVERAGE * 100)}% of methodology weight "
          f"backed by evidence)")
    print(f"  wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League ranking builder")
    sys.exit(build())
