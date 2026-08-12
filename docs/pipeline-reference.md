# Pipeline reference — patterns adapted from VaccineDailyReport

Distilled from a read-only pass over `D:\PRE\ibm\VaccineDailyReport-main`
(`clustering.py`, `ai_report_generator.py`, `scraper.py`, `README.md`) on
2026-08-12. Nothing on that drive was modified. This file exists so the
patterns live in this repository and that drive never needs opening again.

The source project is a Korean vaccine/health news aggregator: scrape Naver
News sections → store in Postgres → cluster into issues → generate a synthesized
report per issue. The shape transfers to legal news; several specifics do not,
and the divergences are recorded here with reasons.

---

## 1. Scraping — what to copy

**Multi-day backfill, not a single snapshot.** `crawl_n_days(n_days, sections,
pages_per_day)` walks `date=YYYYMMDD` and `page=N` backwards from today. This
is the answer to the density problem in `backend/pipelines/news/synthesize.py`:
one day of legal news produces no 3-article clusters, but a rolling 3–7 day
window accumulates enough coverage of the same event to form them. Their
clustering step reads `days=3` for exactly this reason.

**Three-layer deduplication, cheapest first.**

1. URL already in the database → skip before fetching anything
2. `(publisher, title)` seen earlier *in this run* → in-memory set
3. `(publisher, title)` already in the database → SQL check

Layer 3 is the interesting one. It catches the same article republished under a
different URL because the publisher re-filed it under another section — a
"category 꼼수" in their comments. Our collector currently has layers 1 and 2
(URL hash, content hash); layer 3 becomes available once Postgres is live.

**Body cleaning before storage.** Their `get_news_data` strips, in order:
reporter bylines (`.*?기자\s?=`), wire-service prefixes, email addresses, and
everything after a copyright marker (`무단전재`, `재배포 금지`, `저작권자`,
`Copyrights`). Then it rejects the article if it is under 200 characters or
less than 25% Hangul.

That length-and-language floor is worth copying wholesale: it is a cheap,
deterministic quality gate that drops navigation pages, photo captions, and
stub entries before they reach the expensive stages.

**Politeness.** `time.sleep(0.1)` between article fetches, `timeout=10` on
every request, and a bare `except` per section so one bad section cannot kill
the run.

## 2. Scraping — what NOT to copy

**They spoof a Chrome User-Agent** to avoid Naver blocking:

```python
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."}
```

We identify ourselves instead: `LegalLeagueBot/0.1 (+https://legalleague.org/about)`.

This is a deliberate divergence, not an oversight. A directory that ranks law
firms is judged on its own conduct, and the moment we misrepresent our client
to get past a block we have converted a copyright question into a
computer-misuse and contract question. The live temptation is 법률신문
(`lawtimes.co.kr`), which returns 403 to our identified bot and would almost
certainly serve a spoofed browser string. It stays on the excluded list in
`backend/pipelines/news/sources.json` until there is a licence.

**They store and re-publish full article bodies** (`News.contents`). We store
full text only in `backend/data/raw/` for processing, and publish headline plus
a ≤320-character extract with a link. See `LICENSES.md`.

## 3. Clustering — the two-gate pattern

From `clustering.py`, the part worth preserving exactly:

| Stage | Their implementation | Ours |
|---|---|---|
| Vectors | SentenceTransformer + ChromaDB cache | TF-IDF, stdlib |
| Grouping | HDBSCAN, `min_cluster_size=3`, `epsilon=0.33` | single-link union-find at cosine ≥ 0.24 |
| Absorption | merge into existing issue at cosine ≥ 0.85 | not implemented |
| **Gate 1** | `simple_kg_check` — Kiwi noun intersection across all members, ≥1 shared noun after stopwords | shared-token intersection, same rule |
| **Gate 2** | LLM same-event verification returning `valid_indices` + title; rejects if < 3 survive | not implemented (needs a key) |

**Gate 1 is the load-bearing idea.** A cluster whose members share no
vocabulary was joined by a chain of pairwise near-misses, not by subject. It is
a few lines of code and it removes the failure mode that makes naive clustering
useless.

Their stopword list is worth reading as a design artifact: ~80 Korean terms
(`오늘`, `발표`, `전망`, `기업`, `개발`, `치료`…) that are frequent enough in
the domain to create false links. Our equivalent lives in `STOPWORDS` in
`synthesize.py` and needs the same treatment for legal vocabulary — `법률`,
`소송`, `판결` will link unrelated stories once the corpus grows.

**Absorption is not implemented on our side and should be.** Without it, a
story that develops over three days produces three separate clusters instead of
one issue that gains articles.

## 4. Generation — Writer → Critic → Refiner

From `ai_report_generator.py`. Three calls, JSON-mode output, descending
temperature (0.3 → 0.1 → 0.2):

1. **Writer** — "수석 기자", combines facts across sources, avoids any one
   outlet's subjective framing, produces `{title, contents}`
2. **Critic** — "뉴스 데스크 에디터", checks the draft against the raw sources
   on four axes, the first being **팩트 검증: 원본 소스에 없는 내용이 포함되었는가?**
   ("does it contain anything not in the sources?"), returns 3–5 specific fixes
   or "수정 사항 없음"
3. **Refiner** — "최종 편집장", applies the critique, strips multimedia
   references ("영상에서 보듯"), extracts an English search keyword

**The Critic's fact-check is the reason to copy this structure rather than a
single generation call.** For vaccine news an unsupported sentence is an
inaccuracy. For a legal directory an unsupported sentence about a named firm is
a defamation claim. Our `synthesize.py` keeps all three passes and adds
per-claim source indexes so the check is mechanical rather than impressionistic.

## 5. A bug worth knowing about

In `crawl_n_days`, the `try:` block sits at the same indentation as
`for page in range(...)` rather than inside it (source lines 215–221). The loop
assigns `list_url` `pages_per_day` times and then a single fetch runs against
the **last** value — so `pages_per_day` silently has no effect and only one page
per section per day is collected.

Not touched, since that project is reference only. Flagged because our
multi-day backfill should not inherit it, and because it explains any
lower-than-expected collection volume on that project.

## 6. Stack divergences

| | VaccineDailyReport | Legal League |
|---|---|---|
| Backend | FastAPI + SQLAlchemy, SQLite or Postgres via Docker | Python scripts → JSON, Supabase Postgres planned |
| Frontend | React (CRA), `npm start` | Next.js App Router on Vercel |
| Vector store | ChromaDB | none (TF-IDF) |
| LLM | OpenAI `gpt-4o-mini` | provider-configurable, see `backend/.env.example` |
| Deploy | local + Docker Compose | Vercel (frontend only), local pipeline |

The FastAPI layer is the piece we are deliberately not copying: the frontend is
static and reads committed JSON, so there is no server to run and nothing to
pay for until Supabase replaces the JSON files.
