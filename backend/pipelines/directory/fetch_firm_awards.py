"""
League of Legals — external recognition, cited rather than copied.

    python backend/pipelines/directory/fetch_firm_awards.py
    python backend/pipelines/directory/fetch_firm_awards.py --jurisdiction south-korea

Chambers, The Legal 500, IFLR1000, asialaw, Benchmark Litigation, Law.asia and
ALB all publish rankings. Those tables are compilations: the selection and the
arrangement are the protected work, and reproducing them is the database-right
problem that keeps Law.asia off the news source registry. The facts inside them
are not protected, and neither is the fact that a publisher said something.

So this records citations, not tables:

    Firm X states it was ranked Band 1 for Corporate/M&A
    in Chambers Asia-Pacific 2026.
    Source: <the firm's own press release>

Every record is read from the FIRM's own site, never from the ranking
publisher's. That is the sourcing rule for this project, and here it also
happens to be the cleanest possible provenance — we are reporting what a firm
says about itself, with a link, which is ordinary journalism and touches nobody
else's database.

Consequences, deliberately accepted:

  * Coverage is uneven, because it reflects which firms publicise their
    rankings rather than who was ranked. A firm ranked Band 1 that never
    mentions it will show nothing here. That is honest and it is disclosed on
    the page; the alternative is scraping the tables.

  * Nothing here is a League of Legals ranking, and the page says so. These are
    other publishers' opinions, attributed to them, with the firm's own
    announcement as the citation. Reconciling them into a view of our own is a
    separate step that must show its working.
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
OUTPUT_FILE = REPO / "frontend" / "src" / "data" / "firm_awards.json"

# The publishers whose recognitions are worth recording, with the spellings
# firms actually use. Law.asia and ALB are included: we do not crawl them, but
# a firm citing them is reporting a real recognition and excluding it would be
# editorial cowardice rather than caution.
PUBLISHERS = {
    "Chambers": r"chambers(?:\s+(?:and|&)\s+partners)?(?:\s+(?:asia[- ]pacific|global|uk|usa|europe))?",
    "The Legal 500": r"legal\s?500|legalease",
    "IFLR1000": r"iflr\s?1000|iflr",
    "asialaw": r"asialaw",
    "Benchmark Litigation": r"benchmark\s+litigation",
    "Law.asia": r"law\.asia|asia\s+business\s+law\s+journal|china\s+business\s+law\s+journal|india\s+business\s+law\s+journal",
    "Asian Legal Business": r"asian\s+legal\s+business|\bALB\b",
    "Lexology Index": r"lexology\s+index|who'?s\s+who\s+legal",
    "Best Lawyers": r"best\s+lawyers",
    "Managing IP": r"managing\s+(?:ip|intellectual\s+property)",
}
PUBLISHER_RE = {
    name: re.compile(pattern, re.I) for name, pattern in PUBLISHERS.items()
}

# Pages where firms announce recognitions.
AWARD_LINK_RE = re.compile(
    r"\b(award|awards|recognition|recognitions|ranking|rankings|accolade|"
    r"accolades|news|press|media|insight)\b", re.I)

TIER_RE = re.compile(
    r"\b(band\s*[1-6]|tier\s*[1-6]|top\s+tier|first\s+tier|"
    r"leading\s+firm|highly\s+regarded|recommended|elite|outstanding|"
    r"firm\s+of\s+the\s+year|law\s+firm\s+of\s+the\s+year)\b", re.I)
EDITION_RE = re.compile(r"\b(20[12]\d)\b")

# Practice vocabulary, matched inside the recognition sentence itself.
PRACTICES = [
    "Antitrust", "Competition", "Arbitration", "Banking", "Banking and Finance",
    "Capital Markets", "Compliance", "Construction", "Corporate", "Corporate/M&A",
    "Data Protection", "Dispute Resolution", "Employment", "Energy",
    "Environment", "Insolvency", "Insurance", "Intellectual Property",
    "International Trade", "Investigations", "Labour", "Litigation", "M&A",
    "Maritime", "Private Client", "Private Equity", "Project Finance",
    "Real Estate", "Regulatory", "Restructuring", "Shipping", "Tax",
    "Technology", "TMT", "White Collar",
]
PRACTICE_RE = [(p, re.compile(r"\b" + re.escape(p).replace(r"/", r"\s*/\s*") + r"\b", re.I))
               for p in PRACTICES]

# Split only on punctuation that actually ends a sentence — one followed by
# whitespace. A bare character class on "." cuts "Law.asia" in half, which
# silently made our own biggest rival unciteable.
SENTENCE_SPLIT_RE = re.compile(
    r"(?<=[.!?])\s+|[•|]|"
    r"(?:learn more|view details|view more|read more|find out more|"
    r"click here|see all|work highlight)",
    re.I,
)

# Without a verb of recognition, a publisher's name is just a name. "Managing IP
# is a directory that researches and ranks firms" names a publisher, contains
# the word "ranks", and asserts nothing about the firm at all.
RECOGNITION_VERB_RE = re.compile(
    r"\b(ranked|ranks|recognised|recognized|named|awarded|wins?|won|"
    r"listed|selected|honou?red|shortlisted|clinched|maintains?|"
    r"has been|was|were|is ranked|top[- ]ranked)\b", re.I)

# Navigation and card furniture. These chunks are stitched-together link text,
# not prose, and any publisher inside them is part of a logo wall.
BOILERPLATE_RE = re.compile(r"(→|&hellip;|\.\.\.\s*$)", re.I)

# A publisher describing itself. "Managing IP is a directory that researches and
# ranks firms" carries a publisher, a recognition verb and a practice area, and
# says nothing whatever about the firm whose page it sits on.
SELF_DESCRIPTION_RE = re.compile(
    r"(?:^|[^a-z])is (?:a|an|the) [a-z ]{0,24}"
    r"(?:directory|directories|publication|guide|ranking|rankings|"
    r"legal media|magazine|journal)(?:[^a-z]|$)",
    re.I)

# How close a publisher must sit to the words that make a claim about it.
CLAIM_WINDOW = 130


def log(message: str) -> None:
    print(f"  {message}", flush=True)


def find_award_pages(homepage: str, base: str, robots: Robots,
                     renderer: Renderer, limit: int = 16) -> list[tuple[str, str]]:
    """
    The firm's own awards and recognition pages, breadth-first.

    Breadth matters more than depth here and the ordering is not a detail. A
    depth-first walk spends the whole page budget on the children of the first
    index it finds, so the other sections are never opened at all — that change
    alone took Singapore from five firms with recognitions down to one. Every
    top-level section is therefore visited before any child is.
    """
    seen: set[str] = set()
    pages: list[tuple[str, str]] = []

    def fetch_into(url: str) -> str | None:
        if url in seen or len(pages) >= limit:
            return None
        seen.add(url)
        if not robots.allows(url):
            return None
        time.sleep(CRAWL_DELAY)
        html = get(url, renderer)
        if html:
            pages.append((url, html))
        return html

    level_one = [url for url in discover_links(homepage, base, limit=40)
                 if AWARD_LINK_RE.search(url)][:8]

    # Pass one: every award/news section off the homepage.
    fetched: list[tuple[str, str]] = []
    for url in level_one:
        html = fetch_into(url)
        if html:
            fetched.append((url, html))

    # Pass two: individual items inside those sections, and the next page of
    # each, with whatever budget remains.
    for url, html in fetched:
        if len(pages) >= limit:
            break
        inner = [u for u in discover_links(html, base, limit=60) if u not in seen]
        inner.sort(key=lambda u: (
            0 if re.search(r"award|recognition|ranking|ranked|band|tier", u, re.I) else 1,
            len(u)))
        for child in inner[:3]:
            fetch_into(child)
            if len(pages) >= limit:
                break
        fetch_into(f"{url.rstrip('/')}/page/2")

    return pages


def extract_recognitions(text: str, url: str) -> list[dict]:
    """
    One record per sentence that names a ranking publisher.

    Sentence-level on purpose. A page-level match would attribute every
    publisher on the page to every practice on the page, which is how a
    citation index turns into fiction.
    """
    out: list[dict] = []
    seen: set[tuple] = set()

    for chunk in SENTENCE_SPLIT_RE.split(text):
        sentence = (chunk or "").strip()
        if not 25 <= len(sentence) <= 420:
            continue
        # What survives the split is prose; only an arrow or ellipsis
        # left inside still marks a stitched-together link list.
        if BOILERPLATE_RE.search(sentence):
            continue

        hits = [(name, pattern.search(sentence))
                for name, pattern in PUBLISHER_RE.items()]
        hits = [(name, m) for name, m in hits if m]
        if not hits:
            continue

        # No cap on how many publishers may appear. The 130-character claim
        # window below is what prevents cross-attribution, and it does the job
        # more precisely: a credentials list carries no tier or practice near
        # any publisher, so every candidate falls out on its own. Capping at
        # two instead threw away real recognitions, because firms print their
        # citations back to back with no full stop between them.

        if not RECOGNITION_VERB_RE.search(sentence):
            continue
        if SELF_DESCRIPTION_RE.search(sentence):
            continue

        editions = [int(y) for y in EDITION_RE.findall(sentence)
                    if 2015 <= int(y) <= 2030]

        for publisher, hit in hits:
            # Tier and practice must sit near this publisher's mention, not
            # merely somewhere in the sentence. Otherwise one publisher inherits
            # another's band and an unrelated practice area.
            start = max(0, hit.start() - CLAIM_WINDOW)
            end = min(len(sentence), hit.end() + CLAIM_WINDOW)
            window = sentence[start:end]

            tier = TIER_RE.search(window)
            practices = [name for name, pattern in PRACTICE_RE
                         if pattern.search(window)]
            if not tier and not practices:
                continue

            practices = [a for a in practices
                         if not any(a != b and a.lower() in b.lower() for b in practices)]
            key = (publisher, tier.group(0).lower() if tier else None,
                   tuple(practices[:3]))
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "publisher": publisher,
                "tier": tier.group(0) if tier else None,
                "practiceAreas": practices[:3],
                "edition": max(editions) if editions else None,
                # The firm's own words, so a reader can judge the claim rather
                # than take our parse of it on trust.
                "quote": sentence[:300],
                "sourceUrl": url,
            })
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jurisdiction")
    parser.add_argument("--limit", type=int, help="max firms to process")
    args = parser.parse_args()

    if not DETAILS_FILE.exists():
        log("run fetch_firm_details.py first — this reads its verified firms")
        return 1

    firms = json.loads(DETAILS_FILE.read_text("utf-8"))["firms"]
    if args.jurisdiction:
        firms = [f for f in firms if f["jurisdiction"] == args.jurisdiction]
    if args.limit:
        firms = firms[: args.limit]

    robots = Robots()
    renderer = Renderer()
    run_started = datetime.now(timezone.utc)

    records: list[dict] = []
    if OUTPUT_FILE.exists():
        records = json.loads(OUTPUT_FILE.read_text("utf-8")).get("firms", [])
    done = {r["slug"] for r in records}

    for firm in firms:
        if firm["slug"] in done:
            continue
        base = firm["website"]
        time.sleep(CRAWL_DELAY)
        homepage = get(base, renderer)
        if not homepage:
            continue

        pages = [(base, homepage)]
        pages += find_award_pages(homepage, base, robots, renderer)

        recognitions: list[dict] = []
        for url, html in pages:
            recognitions.extend(extract_recognitions(clean(html), url))

        # Deduplicate across pages; firms repeat the same accolade everywhere.
        unique: dict[tuple, dict] = {}
        for record in recognitions:
            unique.setdefault(
                (record["publisher"], record["tier"], tuple(record["practiceAreas"])),
                record)
        recognitions = list(unique.values())

        if not recognitions:
            log(f"    {firm['name']}: no recognition stated on its own site")
            continue

        publishers = sorted({r["publisher"] for r in recognitions})
        records.append({
            "slug": firm["slug"],
            "name": firm["name"],
            "jurisdiction": firm["jurisdiction"],
            "recognitions": recognitions,
            "checkedAt": run_started.isoformat().replace("+00:00", "Z"),
        })
        done.add(firm["slug"])
        log(f"    {firm['name']}: {len(recognitions)} from {', '.join(publishers)}")

    renderer.close()

    total = sum(len(r["recognitions"]) for r in records)
    by_publisher: dict[str, int] = {}
    for record in records:
        for recognition in record["recognitions"]:
            by_publisher[recognition["publisher"]] = by_publisher.get(
                recognition["publisher"], 0) + 1

    OUTPUT_FILE.write_text(json.dumps({
        "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
        "method": "Recognitions as stated by each firm on its own website, with "
                  "the firm's wording and a link to the page. Ranking tables "
                  "published by Chambers, The Legal 500, Law.asia and others are "
                  "not reproduced; these are citations to what a firm says about "
                  "itself. Coverage reflects which firms publicise rankings, not "
                  "who was ranked.",
        "disclaimer": "These are other publishers' assessments, attributed to "
                      "them. League of Legals publishes no ranking of its own.",
        "firmCount": len(records),
        "recognitionCount": total,
        "byPublisher": dict(sorted(by_publisher.items(), key=lambda kv: -kv[1])),
        "firms": records,
    }, indent=2, ensure_ascii=False), "utf-8")

    print()
    log(f"{total} recognitions across {len(records)} firms")
    for publisher, count in sorted(by_publisher.items(), key=lambda kv: -kv[1]):
        log(f"  {count:>4}  {publisher}")
    log(f"wrote -> {OUTPUT_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("League of Legals external recognition collection")
    sys.exit(main())
