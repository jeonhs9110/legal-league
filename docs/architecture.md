# League of Legals — system architecture

Dual-engine platform: an authoritative legal directory, and an automated news
aggregator that feeds it. Both sit on one Postgres database and share one entity
graph — that shared graph is the reason to build them together rather than as two
products.

- **Directory engine** — firms, lawyers, evidence, versioned ranking runs.
- **News engine** — scheduled ETL that lands articles, deduplicates them, and
  links them to firms and lawyers already in the directory.

Schema lives in [`backend/supabase/migrations/`](../backend/supabase/migrations/).
Commercial and licensing analysis is in [LICENSES.md](../LICENSES.md).

---

## 1. System architecture

### Planes, not tiers

Three independent paths reach the database, each with its own credential and
blast radius.

```
              ┌──────────────────────────────────────────┐
              │  Vercel — Next.js App Router             │
  visitor ───▶│  RSC + ISR, anon key, RLS enforced       │──┐
              │  no service_role, ever                   │  │
              └──────────────────────────────────────────┘  │
                                                            │
              ┌──────────────────────────────────────────┐  │   ┌─────────────┐
   staff ────▶│  /admin — Supabase Auth session          │──┼──▶│  Supabase   │
              │  role claim from profiles table          │  │   │  Postgres   │
              └──────────────────────────────────────────┘  │   │  + RLS      │
                                                            │   │  + Auth     │
              ┌──────────────────────────────────────────┐  │   └─────────────┘
Cloud         │  GCP Cloud Run Job — Python ETL          │  │
Scheduler ───▶│  service_role key from Secret Manager    │──┘
  (cron)      │  writes ONLY via ingest_news_item()      │
              └──────────────────────────────────────────┘
```

**Why the scraper talks to Postgres directly** rather than posting to a Next.js
API route: an API route adds a hop, a cold start, and a second place to keep
auth logic, and buys nothing — PostgREST already is the API. The discipline that
matters is not *where* the write goes but *what* it is allowed to do, which is
enforced by `ingest_news_item()` (see §3).

### Authentication — three credentials, three trust levels

| Credential | Held by | Bypasses RLS | Rules |
| --- | --- | --- | --- |
| `anon` key | Every browser | No | Public. Assume it is compromised; RLS is the only real control. Safe in `NEXT_PUBLIC_*`. |
| User JWT | Signed-in staff / firm admins | No | Issued by Supabase Auth. Authorization comes from `profiles.role`, read via the `has_role()` security-definer helper. |
| `service_role` key | Cloud Run Job only | **Yes** | Full bypass. Never in a `NEXT_PUBLIC_` var, never in a client component, never in the repo. Lives in GCP Secret Manager, injected as an env var at job start. |

Three rules that keep this from going wrong:

1. **RLS on every table, deny by default.** [`0003_auth_rls.sql`](../backend/supabase/migrations/0003_auth_rls.sql)
   enables RLS on all 27 public tables and grants back only what a visitor may
   legitimately read: published firms, published lawyers, placements belonging to
   a *published* ranking run, and published articles. `news_ingest` — which holds
   raw scraped HTML — has no public policy at all.
2. **Roles live in a table, not in JWT metadata.** User-editable metadata is
   attacker-editable. `profiles.role` is a column an ordinary user cannot write:
   the update policy pins `role` to its current value via `current_role()`.
3. **The service key never enters a request path a user can reach.** If a future
   feature needs elevated writes from the web app, it goes in a Server Action or
   Route Handler with its own check, not in anything shipped to the browser.

### Rendering and freshness

- Directory pages (`/firms/[slug]`, `/rankings/[jurisdiction]`) are static with
  ISR. Rankings change on publish, not continuously.
- The news feed uses ISR at ~10 minutes, or a Supabase webhook calling
  `revalidateTag('news')` on insert if you want it faster. Do not use client-side
  polling — it converts a static page into per-visitor database load.
- The globe reads a small `/api/coverage` payload (or a build-time JSON) of
  `iso_numeric → jurisdiction slug` for countries with published runs. The
  `jurisdictions.iso_numeric` column is zero-padded to three digits specifically
  so it joins to the Natural Earth feature ids the globe already renders.

### What runs where, and what it costs

| Piece | Home | Cost at your scale |
| --- | --- | --- |
| Next.js frontend | Vercel Hobby | $0 |
| Postgres + Auth + Storage | Supabase Free (500MB) | $0 until ~50k articles |
| ETL worker | Cloud Run Job, ~90s/day | Cents/month, inside free tier |
| Cron | Cloud Scheduler (3 jobs free) | $0 |
| Secrets | GCP Secret Manager | ~$0.06/month |

Supabase Free pauses a project after a week of inactivity — a daily cron keeps it
warm, which is a real (if accidental) benefit of this design. Budget for the Pro
tier ($25/mo) when raw HTML retention pushes past 500MB; the fix before that is a
retention policy on `news_ingest.raw_html`, not a bigger plan.

---

## 2. Database schema

Three migrations, applied in order:

| File | Contents |
| --- | --- |
| [`0001_directory.sql`](../backend/supabase/migrations/0001_directory.sql) | Jurisdictions, practice areas, firms, lawyers, evidence tables, methodologies, ranking runs, corrections |
| [`0002_news.sql`](../backend/supabase/migrations/0002_news.sql) | News sources, ingest staging, published articles, entity links, ingest RPCs |
| [`0003_auth_rls.sql`](../backend/supabase/migrations/0003_auth_rls.sql) | Profiles, roles, RLS policies, grants |

Apply with `supabase db push`, or paste into the SQL editor in order.

### The three decisions worth defending

**Rankings are immutable and versioned.** A `ranking_run` binds a
`methodology` version to a jurisdiction and practice area. `firm_rankings` rows
belong to a run; publishing a new ranking means a new run, never an `UPDATE` of
last year's score. A partial unique index enforces one live run per market:

```sql
create unique index ranking_runs_live_idx on ranking_runs
  (jurisdiction_id, coalesce(practice_area_id, '000...0'::uuid))
  where status = 'published';
```

This costs storage and buys three things: the methodology page can show exactly
what produced a placement, a firm that disputes its position gets an audit trail
rather than an argument, and `score_breakdown` jsonb lets you answer "why am I
Band 3" with numbers. For a directory whose entire pitch is open methodology,
mutable scores would undercut the product.

**Evidence is separated from conclusions.** `ranking_observations` records what a
third-party directory published as a dated, sourced fact — *"source X placed firm
Y in Band 2 on date Z, retrieved from URL, hash H"*. It never stores a copy of
their table. `case_records` + `case_participations` hold the court side;
`submission_matters` the firm-provided side. `ranking_evidence` joins each
published placement back to the specific rows that fed it. This is the structural
difference between aggregating facts and copying a database.

**Scraped text and published text are different tables.** `news_ingest` is
private: raw HTML, full extracted text, hashes. `news_articles` is public: title,
≤320-character excerpt, author, date, canonical URL, and an AI summary in our own
words. There is no body column on the public table, so no code path can
accidentally publish one. The 320-character cap is a database `CHECK`, not a
config value, because the EU press publishers' right (DSM Art. 15) protects
snippets beyond "very short extracts", and a limit someone can edit at 2am is not
a control.

### Entity graph at a glance

```
jurisdictions ──< firm_offices >── firms ──< firm_rankings >── ranking_runs
      │                              │                              │
      │                              │                       methodologies
      │                        lawyers ──< lawyer_positions
      │                              │
practice_areas                       └──< news_article_entities >── news_articles
                                                                          │
                                                                    news_ingest
                                                                          │
sources ──< news_sources ─────────────────────────────────────────────────┘
   │
   ├──< ranking_observations >── firms
   └──< case_records >── case_participations ── firms / lawyers
```

`sources` is the compliance root: every collector checks `permitted_use` before
it fetches, and `ingest_news_item()` re-checks it in the database so a
misconfigured worker still cannot land data from a prohibited source.

---

## 3. Scraping workflow

### Source policy comes before source code

For each target, record a `sources` row and set `permitted_use` **before** writing
a collector. The order of preference is not stylistic — it tracks legal risk:

1. `api` / `bulk_download` — official, documented, terms accepted. Court bulk
   data usually lives here.
2. `feed` — RSS/Atom the publisher offers precisely so you syndicate headlines.
   Most legal-news targets have one; this covers the majority of your sources.
3. `scrape_permitted` — robots.txt and ToS reviewed by a human and found
   permissive.
4. `scrape_prohibited` / `unknown` — **collection blocked.** `is_enabled` stays
   false and the database RPC refuses the write.

On anti-bot measures, the honest engineering answer: **a site that actively blocks
you is telling you it has not granted permission.** Building evasion turns a
copyright question into a contract-breach and computer-misuse question, and it
produces a brittle pipeline that fails silently. The durable moves are: use the
RSS feed, request access, or license the content. Where that fails, drop the
source and note why in `license_note`. What you *should* do is be a well-behaved
client — a real User-Agent naming the project with a contact URL, robots.txt
honored, `Crawl-delay` respected, conditional GET so unchanged feeds cost one
304, and concurrency of 1–2 per host. That combination is what keeps you off
block lists in the first place.

### Pipeline stages

```
discover ──▶ fetch ──▶ extract ──▶ normalize ──▶ dedupe ──▶ link ──▶ promote
```

**Discover.** Read enabled `news_sources`. RSS/Atom via `feedparser`; sitemaps via
`<lastmod>` filtering; HTML index pages last. Watermark on
`news_sources.last_fetched_at` so each run only looks at what is new.

**Fetch.** `httpx` with HTTP/2, `If-None-Match`/`If-Modified-Since` from the
stored ETag, per-host semaphore, exponential backoff on 429/5xx, and a circuit
breaker that disables a source after N consecutive failures. Reserve **Playwright
for the few sources that genuinely render client-side** — it needs ~2GB of
container memory and a browser image, roughly 10× the cost of an HTTP fetch. In
practice fewer than one source in five needs it.

**Extract.** `trafilatura` (Apache-2.0) for main-content extraction — it beats
hand-written BeautifulSoup selectors and does not break when a publisher reskins.
Fall back to per-source CSS selectors only where extraction quality demands it.
Pull `<link rel="canonical">`, JSON-LD `NewsArticle` (author, `datePublished`),
and OpenGraph as metadata, in that priority order.

**Normalize.** Canonicalize the URL — lowercase scheme and host, strip
`utm_*`/`fbclid`, resolve redirects, drop trailing slash — then
`sha256` it into `url_hash`. Normalize whitespace and hash the body into
`content_hash`. Parse dates to UTC with the source's timezone as fallback.

**Dedupe, three layers**, because legal news is heavily syndicated:

1. `url_hash` unique constraint — same article, same URL.
2. `content_hash` within a 7-day window — same wire copy, different outlet.
3. Title similarity via `pg_trgm` on a 72-hour window — same story, rewritten
   headline. This one is a review-queue signal, not an automatic reject.

Layers 1 and 2 run inside `ingest_news_item()`, so they cannot be skipped.

**Link.** Entity resolution is the step where AI genuinely earns its place, and
it runs in two passes. First a cheap deterministic pass: exact and trigram match
of firm names against `firms.display_name`, plus known aliases. Only what fails
that goes to an LLM with a *candidate list* from the database and instructions to
return `null` when unsure — never open-ended "who is mentioned here". Write the
result to `news_article_entities` with a `confidence` and `method`. Anything
below ~0.8 waits for human verification. Getting this wrong publishes a story
about the wrong firm, which is a defamation vector, not a UX bug.

**Promote.** Deliberately a separate function the crawler never calls. Publishing
is an editorial act: `promote_news_item()` writes the excerpt and summary into
`news_articles` at status `review`, and a human (or, later, a rule you trust)
moves it to `published`.

### Scheduling and idempotency

Cloud Scheduler → Cloud Run Job, once or twice daily. Every run opens an
`ingest_runs` row and closes it with stats, so "the scraper is broken" becomes a
query rather than a hunch. The whole pipeline is idempotent: re-running the same
window inserts nothing new. Alert on **zero-yield runs** — a scraper that returns
0 articles for two consecutive days is the normal failure mode, and it is silent
unless you watch for it.

### Retention

Keep `raw_html` for 90 days (long enough to re-parse after a bug), then null it
and keep `extracted_text` + hashes. This is what holds you inside the Supabase
free tier, and it limits how much third-party content you are sitting on.

---

## 4. Implementation plan

### Start here

**Move `frontend/src/lib/rankings.ts` into Postgres and point the globe at it.**
One vertical slice — migration, seed, query, render — proves the entire chain
before you build anything on top of it. It is a day of work and it de-risks
every later phase.

### Sequence

**Phase 0 — Foundations (½ day).**
Create the Supabase project. Apply the three migrations. Wire
`supabase gen types typescript` into an npm script so the frontend is typed off
the real schema. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
to Vercel. Put the service key nowhere yet.

**Phase 1 — Directory read path (3–4 days).**
Seed `jurisdictions` from the Natural Earth ids the globe already uses, plus
`practice_areas` and `ranking_tiers`. Seed the 12 sample jurisdictions with the
existing placeholder firms. Replace the static import in `RightPanel.tsx` with a
Supabase query. Add `/firms/[slug]` and `/rankings/[jurisdiction]`.
*Exit test:* clicking Korea on the globe renders rows that came from Postgres.

**Phase 2 — Editorial write path (3–4 days).**
Supabase Auth, `/admin` behind a role check, CRUD for firms and lawyers. Verify
RLS by hitting PostgREST with a raw anon key and confirming a draft firm is
invisible. *Do this before the scraper* — the news pipeline needs a review queue
to write into, and the queue needs auth.

**Phase 3 — News pipeline v1, local only (1 week).**
Three RSS sources with `permitted_use = 'feed'`. Full pipeline through
`ingest_news_item()`, run from your laptop with `python -m pipelines.news`.
Review queue in `/admin`, feed at `/news`. No GCP yet: running locally while the
parsers are still wrong costs nothing and iterates in seconds.

**Phase 4 — Promote to Cloud Run (1–2 days).**
Containerize, push to Artifact Registry, Cloud Run Job, service key in Secret
Manager, Cloud Scheduler cron, zero-yield alert. This is a deployment task, not a
development task, precisely because phase 3 kept the code environment-agnostic.

**Phase 5 — Methodology and ranking engine (1–2 weeks).**
`sources`, `ranking_observations`, `case_records`. Write the scorer as a pure
function of `methodologies.weights` + evidence rows → `firm_rankings`. Publish
the methodology page from the same JSON the scorer consumes, so they cannot drift.
*Exit test:* re-running a published run reproduces its scores exactly.

**Phase 6 — Entity linking (1 week).**
Deterministic matcher, then the constrained LLM pass. Firm profiles start showing
related news. This is the moment the two engines become one product.

**Phase 7 — Rights and claims, before real names go live (1 week).**
Profile claims, corrections intake wired to the `corrections` table, a published
correction policy, and a documented right of reply. Then, and only then, replace
the invented firm names.

### The gate

Phases 1–6 run entirely on invented firm names. **Do not publish a ranking of
real, named firms until phase 7 is done and each placement cites its evidence.**
That ordering is not caution for its own sake: a ranking you cannot trace is the
one that draws the letter, and the audit trail you would need to answer it has to
exist *before* the placement is published, not after the complaint arrives.
