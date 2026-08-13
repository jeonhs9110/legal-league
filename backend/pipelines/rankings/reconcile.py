"""
Legal League — reconciliation of external directory rankings.

Chambers, The Legal 500, IFLR1000, asialaw, Benchmark Litigation, Law.asia,
Asian Legal Business, Managing IP, Lexology Index and Best Lawyers each publish
their own view of the same market, in their own vocabulary, on their own
schedule, and none of them shows its working. A reader who wants to know how a
firm is regarded has to read ten tables and hold the differences in their head.

This reconciles them into one figure and shows every input.

WHAT IT IS NOT. This is not Legal League's own assessment of a firm. Nothing
here is independent research into quality of work. It is a weighted count of
what other publishers have said, taken from the firms' own announcements of
those recognitions, with each citation kept and displayed. That distinction is
published on the site in the same words.

HOW IT WORKS.

  1. Tier vocabulary is normalised to one 0-1 scale. "Band 1", "Tier 1",
     "first tier" and "Firm of the Year" all mean the top of that publisher's
     scale and all map to 1.0. "Recommended" is a weaker claim than "Band 2"
     and maps below it. A recognition with no tier stated is still evidence
     that a publisher listed the firm, and maps to 0.40.

  2. One score per publisher, not per recognition. A firm that announces the
     same Chambers band across six practice areas has been recognised once by
     Chambers, six times over — counting each would let a firm inflate its
     standing by publishing more press releases. The best tier that publisher
     gave is taken, and the practice breadth is recorded separately.

  3. Corroboration gates publication. One publisher is a claim; two
     independent publishers agreeing is evidence. This is the same rule the
     news pipeline uses to decide a brief may be written, and it is applied
     here for the same reason.

  4. Publishers are weighted by whether they are a research directory or an
     awards programme. Both are recorded, but an editorial award is a
     different kind of statement from a researched band and should not carry
     the same weight.
"""

from __future__ import annotations

import re

# Tier vocabulary across ten publishers, normalised to one scale. Written out
# rather than inferred, because "highly regarded" and "Band 2" are not the same
# claim and a regex that treated them alike would flatten the whole exercise.
TIER_STRENGTH: list[tuple[re.Pattern, float]] = [
    (re.compile(r"\bband\s*1\b|\btier\s*1\b|first\s+tier|top\s+tier", re.I), 1.00),
    (re.compile(r"firm\s+of\s+the\s+year", re.I), 1.00),
    (re.compile(r"\belite\b", re.I), 0.95),
    (re.compile(r"\bband\s*2\b|\btier\s*2\b", re.I), 0.80),
    (re.compile(r"outstanding", re.I), 0.75),
    (re.compile(r"leading\s+firm", re.I), 0.70),
    (re.compile(r"highly\s+regarded", re.I), 0.70),
    (re.compile(r"\bband\s*3\b|\btier\s*3\b", re.I), 0.60),
    (re.compile(r"recommended", re.I), 0.55),
    (re.compile(r"\bband\s*4\b|\btier\s*4\b", re.I), 0.45),
    (re.compile(r"\bband\s*[56]\b|\btier\s*[56]\b", re.I), 0.30),
]

# No tier stated. The publisher still listed the firm, which is weaker evidence
# than a band but not none.
UNTIERED_STRENGTH = 0.40

# Researched directories against awards programmes. An award is a real
# recognition and is recorded, but it is one editorial decision on one night,
# not a research cycle, and it does not weigh the same.
PUBLISHER_WEIGHT = {
    "Chambers": 1.00,
    "The Legal 500": 1.00,
    "IFLR1000": 0.85,
    "asialaw": 0.85,
    "Benchmark Litigation": 0.85,
    "Managing IP": 0.75,
    "Lexology Index": 0.70,
    "Law.asia": 0.65,
    "Asian Legal Business": 0.65,
    "Best Lawyers": 0.50,
}
DEFAULT_PUBLISHER_WEIGHT = 0.50

# One publisher is a claim; two agreeing is evidence.
MIN_PUBLISHERS = 2


def tier_strength(tier: str | None) -> float:
    if not tier:
        return UNTIERED_STRENGTH
    for pattern, value in TIER_STRENGTH:
        if pattern.search(tier):
            return value
    return UNTIERED_STRENGTH


def reconcile_firm(recognitions: list[dict]) -> dict | None:
    """
    Collapse one firm's recognitions into a single reconciled view.

    Returns None when fewer than MIN_PUBLISHERS independent publishers are
    represented — the firm is then listed without a consensus figure rather
    than given one that rests on a single source.
    """
    if not recognitions:
        return None

    best_by_publisher: dict[str, float] = {}
    practices_by_publisher: dict[str, set] = {}
    editions: list[int] = []

    for record in recognitions:
        publisher = record.get("publisher")
        if not publisher:
            continue
        strength = tier_strength(record.get("tier"))
        # Best tier this publisher gave, not the sum of how often it was said.
        best_by_publisher[publisher] = max(
            best_by_publisher.get(publisher, 0.0), strength)
        practices_by_publisher.setdefault(publisher, set()).update(
            record.get("practiceAreas") or [])
        if record.get("edition"):
            editions.append(int(record["edition"]))

    if len(best_by_publisher) < MIN_PUBLISHERS:
        return None

    # Weighted mean across publishers, so a Chambers band moves the figure more
    # than an awards listing without either being discarded.
    numerator = sum(
        strength * PUBLISHER_WEIGHT.get(pub, DEFAULT_PUBLISHER_WEIGHT)
        for pub, strength in best_by_publisher.items()
    )
    denominator = sum(
        PUBLISHER_WEIGHT.get(pub, DEFAULT_PUBLISHER_WEIGHT)
        for pub in best_by_publisher
    )
    consensus = numerator / denominator if denominator else 0.0

    practices = sorted({p for s in practices_by_publisher.values() for p in s})

    return {
        "consensus": round(consensus, 4),
        "publisherCount": len(best_by_publisher),
        "publishers": sorted(best_by_publisher),
        "byPublisher": {p: round(v, 3) for p, v in sorted(best_by_publisher.items())},
        "practiceAreas": practices[:12],
        "latestEdition": max(editions) if editions else None,
        # Kept so the site can show the arithmetic rather than assert the result.
        "method": (
            f"Weighted mean of the best tier each of {len(best_by_publisher)} "
            "publishers gave, weighted by publisher type. Requires at least "
            f"{MIN_PUBLISHERS} independent publishers."
        ),
    }


def band_for(consensus: float) -> str:
    """
    Presentation band. Deliberately coarse: the underlying figure is a
    reconciliation of other people's judgements and does not support the
    precision that a rank-ordered list to two decimal places would imply.
    """
    if consensus >= 0.90:
        return "A"
    if consensus >= 0.75:
        return "B"
    if consensus >= 0.55:
        return "C"
    return "D"
