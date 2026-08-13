# Legal League

An open-methodology legal directory. Chambers, The Legal 500 and Law.asia publish
rankings without showing their work. This publishes the work: where every fact came
from, what evidence a ranking rests on, and — per jurisdiction — what it does *not*
rest on.

**No ranking of our own is published.** Firms are ordered by a reconciliation of
what other publishers have said, and where that evidence does not exist the listing
is alphabetical and says so. That is a deliberate position, not an unfinished one:
an unfounded number would be worse than none, and it is the only thing that
distinguishes this from the directories it aggregates.

## Repo split

| Folder      | Runs where           | Purpose                                                        |
| ----------- | -------------------- | -------------------------------------------------------------- |
| `frontend/` | Vercel (deployed)    | Next.js static site. The only thing ever hosted.                |
| `backend/`  | Local machine        | Collection, clustering, reconciliation. Emits JSON only.        |

All compute happens locally, output is committed as static JSON, Vercel serves it.
No database to run, no cloud bill.

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Next.js 16 (App Router) + Tailwind. Deploy by pointing a Vercel project at this repo
with **root directory = `frontend`**.

Every page reads through `src/lib/data.ts`. Nothing else imports the data files, so
that one module is where a Postgres backend would be swapped in.

## The pipelines

```bash
python backend/update.py              # everything, then a report of what CHANGED
python backend/update.py --news-only
python backend/update.py --dry-run
```

`update.py` snapshots the ranking inputs before the run and diffs after, so the
output says which firms entered a jurisdiction, whose headcount moved, and whether
any jurisdiction crossed the evidence threshold — rather than just "done".

| Pipeline | What it does |
| --- | --- |
| `news/fetch_news.py` | RSS from permitted sources; robots.txt read before any source is added |
| `news/backfill_archive.py` | Sitemap crawl back to January 2025 |
| `news/synthesize.py` | Clusters coverage; writes a brief only where **two or more outlets** covered the same event, through a writer → critic → refiner chain |
| `directory/fetch_firm_details.py` | Contact details, headcount and practice areas from each firm's **own website**, with the source page recorded per field |
| `directory/fetch_firm_awards.py` | External recognitions, cited from firms' own announcements — never scraped from the ranking tables themselves |
| `directory/fetch_firm_logos.py` | Firm marks, behind a manual review gate |
| `courts/fetch_court_records.py` | Judgments and ministry notices from official sources; `--probe` verifies before collecting |
| `rankings/build_rankings.py` | Merges firm sources, reconciles rankings, writes the per-jurisdiction methodology |

## How the reconciliation works

`backend/pipelines/rankings/reconcile.py`.

Ten publishers' tier vocabularies are normalised to one 0–1 scale — Band 1, Tier 1
and Firm of the Year all mean the top of that publisher's scale. One score per
publisher rather than per recognition, so a firm cannot lift its standing by
announcing the same band across six practice areas. Publishers are weighted by
whether they research or give awards. **Two independent publishers are required**
before any figure publishes, the same corroboration rule the news pipeline uses.

Each jurisdiction carries its own methodology note, generated from what is actually
held there. One site-wide statement could not be honest: Singapore firms publicise
recognitions in English and can be reconciled; Korean firms largely do not, and two
of the largest block crawlers outright.

## What is deliberately not done

- **Ranking tables are never reproduced.** The facts inside them are not protected;
  their selection and arrangement are. Recognitions are read from firms' own
  announcements instead.
- **robots.txt is respected**, including where it costs us. 34 firms and 4 court
  sources refuse this crawler and are recorded as excluded rather than worked
  around. No browser User-Agent spoofing.
- **Full judgment text is never stored or republished** — case name, court, date,
  citation and a link only.
- **No `aggregateRating` in the structured data**, because nothing on the page
  supports a star rating.

## Documentation

- [docs/architecture.md](docs/architecture.md) — planes, auth model, build order
- [docs/pipeline-reference.md](docs/pipeline-reference.md) — collection patterns
- [docs/brand-asset-prompts.md](docs/brand-asset-prompts.md) — generation prompts
- [LICENSES.md](LICENSES.md) — dependency audit and the data-side risks

## Known gaps

Stated plainly because the site states them plainly too.

- **No jurisdiction has a published ranking.** Directory consensus alone is 35% of
  methodology weight; 50% is required.
- **Court records are collected but not attributed to firms**, so no judgment feeds
  any firm's position. 3 of 27 official sources parse; 8 more fetch cleanly and need
  per-source parsers.
- **Recognition coverage is uneven by construction** — it reflects which firms
  publicise rankings, not who was ranked.
- **No named editor and no review queue.** Briefs naming real people in live
  proceedings publish unreviewed. This is the gap I would close first.
- Corrections and claims addresses are published on the site; the mailboxes need to
  exist before launch.
