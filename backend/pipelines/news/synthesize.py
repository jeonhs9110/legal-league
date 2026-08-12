"""
Legal League — issue clustering and brief synthesis.

Modelled on the VaccineDailyReport pipeline (D:\\PRE\\ibm\\VaccineDailyReport-main):
cluster related articles, gate the clusters, then run a Writer -> Critic ->
Refiner chain to produce one synthesized piece per surviving cluster.

    python backend/pipelines/news/synthesize.py            # cluster only
    python backend/pipelines/news/synthesize.py --write    # cluster + synthesize

Differences from the vaccine pipeline, and why:

  * No sentence-transformers / ChromaDB / HDBSCAN. At 60 articles, TF-IDF plus
    single-link agglomerative clustering in pure stdlib is as accurate and
    installs nothing. Swap in embeddings when the corpus outgrows a few
    thousand items — the gates below stay identical.
  * No Kiwi morphological analyser. Korean is tokenized as character bigrams,
    which is language-agnostic and needs no model download. The cost is that
    clusters do not cross languages: a Korean and an English article about the
    same event will not group. Multilingual embeddings are the fix, and the
    only reason to reach for them first.
  * The synthesis step reads full article text, which the collector does not
    store. Clustered articles are fetched on demand into the private staging
    area — the same separation the schema enforces: full text for processing,
    never for publication.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
import time
import unicodedata
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parents[2]
REPO = ROOT.parent
NEWS_FILE = REPO / "frontend" / "src" / "data" / "news.json"
CLUSTERS_FILE = ROOT / "data" / "clusters.json"
FULLTEXT_DIR = ROOT / "data" / "raw" / "articles"
BRIEFS_FILE = REPO / "frontend" / "src" / "data" / "briefs.json"

USER_AGENT = "LegalLeagueBot/0.1 (+https://legalleague.org/about; news aggregation)"

# --- Clustering thresholds -------------------------------------------------
# Cosine similarity above which two articles are linked. Single-link
# clustering means a chain of pairwise links forms one cluster, so this runs
# deliberately high: a loose threshold merges unrelated stories through a
# single weak bridge.
# Calibrated against the observed distribution of this corpus, not guessed:
# across 1,770 pairs the median similarity is 0.0 and only three pairs clear
# 0.20. The highest genuine cross-outlet match — two Korean papers on the same
# awards ceremony — sits at 0.270, so the cut goes just below it.
SIMILARITY_THRESHOLD = 0.24

# The vaccine pipeline required 3 articles because Korean domestic health news
# is dense enough that three outlets cover the same event daily. Legal news at
# 60 items/day across 7 outlets is not: no event here is covered three times.
# Two articles from two distinct outlets is the smallest honest definition of
# corroboration, and MIN_SOURCES is what actually carries the weight — three
# articles from one outlet is a topic page, not a corroborated story.
MIN_ARTICLES = 2
MIN_SOURCES = 2
MIN_SHARED_TERMS = 1      # the simple_kg_check equivalent

# Model split. Anything published before the cutoff is backfill — bulk archive
# work where cost dominates — so it runs on the cheap model. Current news gets
# whatever OPENAI_MODEL names, so the two can diverge without touching code.
ARCHIVE_CUTOFF = "2026-04-01"
ARCHIVE_MODEL = "gpt-4o-mini"
CURRENT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

STOPWORDS = {
    "the", "and", "for", "that", "with", "from", "this", "have", "has", "was",
    "were", "are", "will", "would", "could", "should", "been", "being", "その",
    "after", "before", "about", "into", "over", "under", "than", "then", "they",
    "their", "them", "there", "these", "those", "which", "while", "when", "what",
    "who", "whom", "whose", "said", "says", "say", "new", "more", "most", "also",
    "但", "但是", "기자", "뉴스", "오늘", "지난", "이번", "관련", "대한", "위해",
    "law", "legal", "court", "case", "firm", "firms", "lawyer", "lawyers",
}

WORD_RE = re.compile(r"[a-z][a-z'-]{2,}")
CJK_RE = re.compile(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7a3]+")


def log(message: str) -> None:
    print(f"  {message}", flush=True)


# ---------------------------------------------------------------------------
# Tokenizing and vectors
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list[str]:
    """
    Latin words plus CJK character bigrams. Bigrams stand in for morphological
    analysis: 'ê°ì¬ìì' yields 'ê°ì¬', 'ì¬ì', 'ìì', which is enough
    signal to group two articles about the same appointment.
    """
    text = unicodedata.normalize("NFKC", text or "")
    tokens = [t for t in WORD_RE.findall(text.lower()) if t not in STOPWORDS]

    for run in CJK_RE.findall(text):
        if len(run) == 1:
            continue
        for i in range(len(run) - 1):
            bigram = run[i : i + 2]
            if bigram not in STOPWORDS:
                tokens.append(bigram)

    return tokens


def tfidf_vectors(documents: list[list[str]]) -> list[dict[str, float]]:
    n = len(documents)
    document_frequency: Counter[str] = Counter()
    for tokens in documents:
        document_frequency.update(set(tokens))

    vectors: list[dict[str, float]] = []
    for tokens in documents:
        counts = Counter(tokens)
        if not counts:
            vectors.append({})
            continue
        vector: dict[str, float] = {}
        for term, count in counts.items():
            # Terms appearing in nearly every document carry no signal; the idf
            # floor of 0 drops them rather than letting them dominate.
            idf = math.log(n / (1 + document_frequency[term]))
            if idf <= 0:
                continue
            vector[term] = (count / len(tokens)) * idf
        norm = math.sqrt(sum(v * v for v in vector.values())) or 1.0
        vectors.append({t: v / norm for t, v in vector.items()})
    return vectors


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(weight * b.get(term, 0.0) for term, weight in a.items())


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def cluster(vectors: list[dict[str, float]]) -> list[list[int]]:
    """Single-link agglomerative clustering via union-find."""
    parent = list(range(len(vectors)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(len(vectors)):
        for j in range(i + 1, len(vectors)):
            if cosine(vectors[i], vectors[j]) >= SIMILARITY_THRESHOLD:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(len(vectors)):
        groups.setdefault(find(i), []).append(i)
    return [g for g in groups.values() if len(g) >= MIN_ARTICLES]


def shared_terms(documents: list[list[str]], members: list[int]) -> list[str]:
    """
    Intersection of significant terms across every member — the equivalent of
    the vaccine pipeline's simple_kg_check. A cluster whose members share no
    vocabulary was joined by chained near-misses, not by subject.
    """
    sets = [set(documents[i]) for i in members]
    common = set.intersection(*sets) if sets else set()
    return sorted(common)


# ---------------------------------------------------------------------------
# Full text (private staging only)
# ---------------------------------------------------------------------------

TAG_RE = re.compile(r"<(script|style)[^>]*>.*?</\1>|<[^>]+>", re.S | re.I)
WS_RE = re.compile(r"\s+")


def fetch_fulltext(url: str) -> str | None:
    """
    Fetch an article body for synthesis. Stored under backend/data/raw only —
    never emitted to the frontend. The published brief is our own prose plus
    citations, which is a separate work rather than a reproduction.
    """
    FULLTEXT_DIR.mkdir(parents=True, exist_ok=True)
    cache = FULLTEXT_DIR / f"{hashlib.sha256(url.encode()).hexdigest()[:16]}.txt"
    if cache.exists():
        return cache.read_text("utf-8")

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            raw = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
    except Exception as error:  # noqa: BLE001
        log(f"fulltext failed {url}: {error}")
        return None

    html = raw.decode(charset, errors="replace")
    text = WS_RE.sub(" ", TAG_RE.sub(" ", html)).strip()
    cache.write_text(text[:20000], "utf-8")
    time.sleep(2)
    return text[:20000]


# ---------------------------------------------------------------------------
# Writer -> Critic -> Refiner
# ---------------------------------------------------------------------------

BRIEF_SHAPE = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "standfirst": {"type": "string"},
        "body": {"type": "string"},
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {"type": "string"},
                    "source_indexes": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["statement", "source_indexes"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["headline", "standfirst", "body", "claims"],
    "additionalProperties": False,
}


def normalize(data: dict | None) -> dict | None:
    """
    JSON mode guarantees valid JSON, not a particular shape — the model picks
    its own key names run to run. Accept the common aliases rather than losing
    a brief that is otherwise complete.
    """
    if not isinstance(data, dict):
        return None
    def pick(*names, default=""):
        for n in names:
            if isinstance(data.get(n), str) and data[n].strip():
                return data[n].strip()
        return default
    body = pick("body", "contents", "content", "article", "text")
    headline = pick("headline", "title")
    if not (body and headline):
        return None
    claims = data.get("claims") or data.get("facts") or []
    return {
        "headline": headline,
        "standfirst": pick("standfirst", "lede", "lead", "summary", "subtitle"),
        "body": body,
        "claims": claims if isinstance(claims, list) else [],
    }


def synthesize(client, topic: str, sources: list[dict], model: str) -> dict | None:
    """
    Three passes, following the vaccine pipeline's agent structure. The Critic
    is the load-bearing one: its only job is finding assertions the sources do
    not support. For a legal publication that check is not polish — an
    unsupported sentence about a named firm is the defamation exposure this
    whole project is built to avoid.
    """
    context = "\n\n".join(
        f"[{i}] {s['sourceName']} — {s['title']}\n{s['text'][:4000]}"
        for i, s in enumerate(sources)
    )

    def call(system: str, user: str, as_json: bool = False):
        kwargs = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3 if as_json else 0.1,
        }
        if as_json:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = client.chat.completions.create(**kwargs)
        except Exception as error:  # noqa: BLE001
            log(f"  model call failed: {error}")
            return None
        return response.choices[0].message.content

    log("  writer…")
    draft = call(
        "You are a legal-affairs correspondent writing a straight news brief. "
        "You combine facts across sources and attribute every claim. You do not "
        "characterise any firm or individual beyond what the sources state.",
        f"Topic: {topic}\n\nSources:\n{context}\n\n"
        "Write a brief that synthesises what these sources jointly report. "
        "Every entry in `claims` must cite the source indexes that support it. "
        "Do not include any assertion that is not in the sources.\n\n"
        "Respond with JSON only, in exactly this shape:\n"
        + json.dumps(BRIEF_SHAPE),
        True,
    )
    if not draft:
        return None
    draft_data = json.loads(draft)

    log("  critic…")
    critique = call(
        "You are a news desk editor checking a draft against its sources. Your "
        "single most important job is to find assertions the sources do not "
        "support, especially any claim about a named law firm or lawyer.",
        f"Draft:\n{json.dumps(draft_data, ensure_ascii=False)}\n\nSources:\n{context}\n\n"
        "List every unsupported or overstated statement, every citation that "
        "does not match its source, and any characterisation that goes beyond "
        "the reporting. If the draft is clean, say exactly: NO ISSUES.",
    )
    # The critic is the fact-check. If it returned nothing we have no evidence
    # the draft was checked at all, so the brief is held rather than published.
    # Failing open here would publish unverified assertions about named firms,
    # which is the exact exposure this pipeline exists to prevent.
    if not critique or not critique.strip():
        log("  critic returned nothing — brief HELD, not published")
        return None

    log("  refiner…")
    final = call(
        "You are the editor of record. Apply the critique, removing anything "
        "the sources do not support rather than softening it.",
        f"Draft:\n{json.dumps(draft_data, ensure_ascii=False)}\n\n"
        f"Critique:\n{critique}\n\nSources:\n{context}\n\n"
        "Return the corrected brief. "
        "Respond with JSON only, in exactly this shape: "
        + json.dumps(BRIEF_SHAPE),
        True,
    )
    if not final:
        return None

    result = normalize(json.loads(final)) or normalize(draft_data)
    if result:
        result["critique"] = critique
    return result


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true",
                        help="run the writer/critic/refiner chain (needs ANTHROPIC_API_KEY)")
    args = parser.parse_args()

    snapshot = json.loads(NEWS_FILE.read_text("utf-8"))
    articles = snapshot["articles"]
    run_started = datetime.now(timezone.utc)

    # English-only clustering. TF-IDF over character bigrams cannot match a
    # Korean article to an English one about the same event, so a mixed corpus
    # produces language-siloed clusters that look like coverage convergence and
    # are not. One language in, one standard out; translation happens at
    # display time, downstream of every editorial check.
    articles = [a for a in articles if (a.get("language") or "en") == "en"]
    log(f"{len(articles)} English articles after language filter")

    documents = [tokenize(f"{a['title']} {a.get('excerpt') or ''}") for a in articles]
    vectors = tfidf_vectors(documents)
    raw_clusters = cluster(vectors)

    log(f"{len(articles)} articles -> {len(raw_clusters)} raw clusters "
        f"(>= {MIN_ARTICLES} articles)")

    kept, rejected = [], []
    for members in raw_clusters:
        sources = {articles[i]["sourceSlug"] for i in members}
        terms = shared_terms(documents, members)

        if len(sources) < MIN_SOURCES:
            rejected.append(("single source", members))
            continue
        if len(terms) < MIN_SHARED_TERMS:
            rejected.append(("no shared vocabulary", members))
            continue

        kept.append(
            {
                "id": hashlib.sha256(
                    "".join(sorted(articles[i]["id"] for i in members)).encode()
                ).hexdigest()[:12],
                "sharedTerms": terms[:12],
                "sourceCount": len(sources),
                "articles": [
                    {
                        "id": articles[i]["id"],
                        "title": articles[i]["title"],
                        "sourceName": articles[i]["sourceName"],
                        "sourceSlug": articles[i]["sourceSlug"],
                        "canonicalUrl": articles[i]["canonicalUrl"],
                        "publishedAt": articles[i]["publishedAt"],
                    }
                    for i in members
                ],
            }
        )

    for reason, members in rejected:
        log(f"rejected ({reason}): {articles[members[0]]['title'][:60]}")

    CLUSTERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    CLUSTERS_FILE.write_text(
        json.dumps(
            {
                "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
                "similarityThreshold": SIMILARITY_THRESHOLD,
                "minArticles": MIN_ARTICLES,
                "minSources": MIN_SOURCES,
                "clusters": kept,
            },
            indent=2,
            ensure_ascii=False,
        ),
        "utf-8",
    )

    print()
    log(f"{len(kept)} clusters cleared the gates, {len(rejected)} rejected")
    log(f"wrote -> {CLUSTERS_FILE.relative_to(REPO)}")

    if not args.write:
        if kept:
            log("run again with --write to synthesize briefs")
        return 0

    if not os.getenv("OPENAI_API_KEY"):
        print()
        log("OPENAI_API_KEY is not set — synthesis skipped.")
        log("Clustering is complete and its output is written; only the")
        log("writer/critic/refiner chain needs the key.")
        return 1

    try:
        from openai import OpenAI
    except ImportError:
        log("pip install openai")
        return 1

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    briefs = []

    for entry in kept:
        topic = entry["articles"][0]["title"]
        log(f"synthesising: {topic[:60]}")

        sources = []
        for article in entry["articles"]:
            text = fetch_fulltext(article["canonicalUrl"])
            if text:
                sources.append({**article, "text": text})

        if len(sources) < MIN_ARTICLES:
            log("  not enough retrievable full text; skipped")
            continue

        newest = max(a["publishedAt"] for a in entry["articles"])
        model = ARCHIVE_MODEL if newest < ARCHIVE_CUTOFF else CURRENT_MODEL
        log(f"  model: {model}")
        brief = synthesize(client, topic, sources, model)
        if not brief:
            continue

        briefs.append(
            {
                "id": entry["id"],
                "headline": brief["headline"],
                "standfirst": brief["standfirst"],
                "body": brief["body"],
                "claims": brief["claims"],
                "sources": [
                    {
                        "name": s["sourceName"],
                        "title": s["title"],
                        "url": s["canonicalUrl"],
                    }
                    for s in sources
                ],
                "critique": brief.get("critique", ""),
                "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
                "model": model,
            }
        )

    BRIEFS_FILE.write_text(
        json.dumps(
            {
                "generatedAt": run_started.isoformat().replace("+00:00", "Z"),
                "archiveModel": ARCHIVE_MODEL,
                "currentModel": CURRENT_MODEL,
                "briefs": briefs,
            },
            indent=2,
            ensure_ascii=False,
        ),
        "utf-8",
    )
    log(f"wrote {len(briefs)} briefs -> {BRIEFS_FILE.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    print("Legal League issue clustering")
    sys.exit(main())
