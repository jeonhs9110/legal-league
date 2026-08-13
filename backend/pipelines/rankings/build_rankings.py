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
DETAILS_FILE = DATA_DIR / "firm_details.json"
AWARDS_FILE = DATA_DIR / "firm_awards.json"
NEWS_FILE = DATA_DIR / "news.json"
WEIGHTS_FILE = Path(__file__).resolve().parent / "methodology.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reconcile import band_for, reconcile_firm  # noqa: E402
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


def load_directory() -> tuple[dict[str, list[dict]], dict[str, int]]:
    """
    The directory, unioned across both firm sources.

    firms.json came from Wikipedia and carries 224 names and nothing else.
    firm_details.json came from crawling firms' own websites and carries
    contact details, headcount and practice areas. They were never merged, so
    the site rendered Wikipedia's three Korean firms while six had been
    verified from their own sites — Bae Kim & Lee, Yoon & Yang, Jipyong and
    Barun Law simply never appeared. A firm verified against its own website is
    better evidence than a Wikipedia category, so it wins on conflict.
    """
    firms_data = json.loads(FIRMS_FILE.read_text("utf-8"))
    by_iso: dict[str, list[dict]] = {}
    counts = {"wikipedia": 0, "own-site": 0, "merged": 0}

    slug_by_iso: dict[str, dict[str, dict]] = {}
    for firm in firms_data["firms"]:
        iso = firm["jurisdictionIso"]
        slug_by_iso.setdefault(iso, {})[normalize(firm["name"])] = {
            "slug": firm["slug"],
            "name": firm["name"],
            "foundedYear": firm.get("foundedYear"),
            "sourceUrl": firm.get("sourceUrl"),
            "sourceName": firm.get("sourceName"),
            "verified": False,
        }
        counts["wikipedia"] += 1

    iso_by_slug = {j["slug"]: j["isoNumeric"] for j in firms_data["jurisdictions"]}

    if DETAILS_FILE.exists():
        for firm in json.loads(DETAILS_FILE.read_text("utf-8")).get("firms", []):
            iso = iso_by_slug.get(firm["jurisdiction"])
            if not iso:
                continue
            key = normalize(firm["name"])
            bucket = slug_by_iso.setdefault(iso, {})
            if key in bucket:
                # Same firm, better source: keep the slug the site already
                # links to, but mark it verified against its own website.
                bucket[key]["verified"] = True
                bucket[key]["sourceUrl"] = firm["website"]
                bucket[key]["sourceName"] = "The firm's own website"
                counts["merged"] += 1
            else:
                bucket[key] = {
                    "slug": firm["slug"],
                    "name": firm["name"],
                    "foundedYear": None,
                    "sourceUrl": firm["website"],
                    "sourceName": "The firm's own website",
                    "verified": True,
                }
                counts["own-site"] += 1

    for iso, bucket in slug_by_iso.items():
        by_iso[iso] = list(bucket.values())
    return by_iso, counts


def load_recognitions() -> dict[str, list[dict]]:
    """Reconciled external rankings, keyed by normalised firm name."""
    if not AWARDS_FILE.exists():
        return {}
    out: dict[str, list[dict]] = {}
    for firm in json.loads(AWARDS_FILE.read_text("utf-8")).get("firms", []):
        out[normalize(firm["name"])] = firm.get("recognitions") or []
    return out


def methodology_note(name: str, firm_rows: list[dict], evidence: dict,
                     coverage: float, signal_weights: dict) -> dict:
    """
    The methodology as it applies to THIS jurisdiction, not in general.

    A single site-wide statement cannot be honest here, because what is known
    differs enormously by market: Singapore firms publicise directory
    recognitions in English and can be reconciled; Korean firms largely do not,
    and two of the largest block crawlers outright. Saying so per jurisdiction
    is the difference between a published method and a slogan.
    """
    verified = sum(1 for f in firm_rows if f.get("verified"))
    reconciled = [f for f in firm_rows if f.get("consensus") is not None]
    publishers = sorted({
        p for f in reconciled for p in (f.get("consensusDetail") or {}).get("publishers", [])
    })

    if reconciled:
        basis = (
            f"{len(reconciled)} of {len(firm_rows)} firms in {name} are ranked here, "
            f"ordered by a reconciliation of {len(publishers)} external publishers "
            f"({', '.join(publishers)}). Each figure is the weighted mean of the best "
            "tier every publisher gave that firm, and no firm appears without at least "
            "two independent publishers agreeing. Firms with no reconciled figure are "
            "listed below the ranked ones, alphabetically, and are not ranked."
        )
    else:
        basis = (
            f"No firm in {name} is ranked. Ranking requires at least two independent "
            "publishers to have recognised the same firm, taken from the firm's own "
            "announcements; that threshold is not met here yet, so the whole list is "
            "alphabetical and implies no order."
        )

    limits = []
    if verified < len(firm_rows):
        limits.append(
            f"{len(firm_rows) - verified} of {len(firm_rows)} entries still rest on a "
            "Wikipedia category rather than the firm's own website")
    if not evidence["courtRecord"]:
        limits.append(
            "no court record feeds any firm's position — judgments are collected but "
            "not yet attributed to the firms that argued them")
    if not evidence["submissions"]:
        limits.append("no firm has made a submission, because intake is not open")
    if not evidence["peerReview"]:
        limits.append("no peer or client review has been collected")

    return {
        "basis": basis,
        "limits": limits,
        "coverage": round(coverage, 3),
        "publishers": publishers,
        "verifiedFirms": verified,
        "reconciledFirms": len(reconciled),
        "signalsHeld": {k: v for k, v in evidence.items() if v},
        "signalWeights": signal_weights,
    }


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

    firms_by_jurisdiction, source_counts = load_directory()
    recognitions_by_firm = load_recognitions()

    signal_weights = {s["key"]: s["weight"] for s in weights["signals"]}
    jurisdictions_out = []
    published = 0
    total_mentions = 0

    for jurisdiction in firms_data["jurisdictions"]:
        iso = jurisdiction["isoNumeric"]
        firms = firms_by_jurisdiction.get(iso, [])

        firm_rows = []
        reconciled_count = 0
        for firm in firms:
            mentions = press_mentions(firm["name"], haystacks)
            total_mentions += mentions
            reconciled = reconcile_firm(recognitions_by_firm.get(normalize(firm["name"]), []))
            if reconciled:
                reconciled_count += 1
            firm_rows.append(
                {
                    "slug": firm["slug"],
                    "name": firm["name"],
                    "foundedYear": firm.get("foundedYear"),
                    "sourceUrl": firm.get("sourceUrl"),
                    "sourceName": firm.get("sourceName"),
                    "verified": firm.get("verified", False),
                    "pressMentions": mentions,
                    # Reconciliation of other publishers' rankings — not our own
                    # assessment. None until two independent publishers agree.
                    "consensus": reconciled["consensus"] if reconciled else None,
                    "consensusDetail": reconciled,
                    "score": round(reconciled["consensus"] * 100, 1) if reconciled else None,
                    "rank": None,
                    "band": band_for(reconciled["consensus"]) if reconciled else None,
                }
            )

        # Evidence actually held for this jurisdiction, by methodology signal.
        evidence = {
            # Firms here whose standing is corroborated by two or more
            # independent publishers. This is the only signal currently held.
            "directoryConsensus": reconciled_count,
            # Court records are collected but not yet attributed to firms, so
            # they cannot support a firm-level score and are counted as zero
            # rather than credited on the strength of existing.
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

        firm_rows.sort(key=lambda f: (-(f["consensus"] or -1), f["name"]))
        rank = 0
        for row in firm_rows:
            if row["consensus"] is not None:
                rank += 1
                row["rank"] = rank

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
                "methodology": methodology_note(
                    jurisdiction["name"], firm_rows, evidence, coverage, signal_weights),
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
