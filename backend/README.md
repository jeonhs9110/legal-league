# Legal League — backend (local only)

This half never deploys. It runs on your machine, on demand ("go"), and its only
output is static JSON/assets committed into `frontend/public/data/`, which Vercel
then serves for free. No AWS, no managed database, no always-on server.

```
you run it locally  →  writes JSON  →  git push  →  Vercel rebuilds the static site
```

## Layout

```
backend/
  pipelines/          # one folder per source (news, court opinions, existing rankings)
  data/
    raw/              # untouched fetch output, kept for auditability
    processed/        # normalized records
  exports/            # final JSON copied into frontend/public/data/
  requirements.txt
```

## Why raw is kept

The differentiator of this directory is an open methodology: anyone should be able
to re-derive a ranking from the same inputs. That only works if every fetch is
stored verbatim with its URL, retrieval timestamp, and license/robots status —
so `data/raw/` is the evidence trail, and `data/processed/` is what the scoring
code is allowed to read.

## Not built yet

Nothing here is implemented. The frontend was the first deliverable. Before writing
scrapers, decide:

1. Which sources are in scope, and whether each one's terms permit scraping or
   require an API/bulk-download route (court opinion bulk data usually does).
2. The record schema — a firm, a lawyer, a practice area, a jurisdiction, a ranking
   observation, a case citation.
3. Where AI is used vs. where deterministic code is. Entity resolution ("is this
   the same firm across four directories?") is the AI-shaped problem; scoring
   should stay deterministic so the published methodology is reproducible.
