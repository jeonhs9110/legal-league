# Legal League

An open-methodology legal directory. Where Chambers, Legal 500, and Law.asia publish
rankings without showing their work, this one publishes the inputs: aggregated
third-party rankings, public court records, and the scoring code that turns them
into a placement.

## Repo split

| Folder      | Runs where             | Purpose                                                                 |
| ----------- | ---------------------- | ----------------------------------------------------------------------- |
| `frontend/` | Vercel (deployed)      | Next.js static site. The only thing that is ever hosted.                 |
| `backend/`  | Your machine (local)   | Scraping, normalization, AI entity-resolution, scoring. Emits JSON only. |

The cost model is deliberate: all compute happens locally, the output is committed
as static JSON, and Vercel serves it. Nothing here needs AWS or a running database.

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Next.js 16 (App Router) + Tailwind + lucide-react. Deploy by pointing a Vercel
project at this repo with **root directory = `frontend`**; the defaults handle the
rest.

### Current state

A single landing page: liquid-glass morphism, strict grayscale, Poppins with
Source Serif 4 for italic accents.

- **Left panel** — an interactive globe (`src/components/globe/Globe.tsx`). Canvas +
  d3-geo orthographic projection, auto-rotating, drag to spin, click a highlighted
  country to select it. Covered jurisdictions carry a dot so small but significant
  markets (Singapore, Hong Kong) stay findable.
- **Right panel** — the selected jurisdiction's ranked firms, the number of
  directories reconciled, and the judgment count behind the score. Falls back to a
  country list when nothing is selected, so the page works without the globe.
- Selection is shared state in `HeroShell.tsx`; the globe swings to center whichever
  country is chosen, from either side.

**The rankings are fake on purpose.** `src/lib/rankings.ts` holds invented firm
names, and the panel carries a visible "illustrative sample data" label. Read the
header comment in that file before replacing it with real firms.

Placeholder asset: `public/logo.svg`, authored for this project, used at 32×32 in
the nav. Swap in your real mark.

## Commercial clearance

[LICENSES.md](LICENSES.md) is the audit: every dependency's license, what was
removed and why (the CDN background video had no license and is gone), and the five
data-side risks that actually matter for a ranking business.

## Architecture

[docs/architecture.md](docs/architecture.md) — how the Next.js frontend, Supabase,
and the Python ETL workers interact; the auth model; the scraping pipeline; and the
phased build order.

SQL lives in [backend/supabase/migrations/](backend/supabase/migrations/) and is
applied with `supabase db push`:

| Migration | Contents |
| --- | --- |
| `0001_directory.sql` | Firms, lawyers, evidence, versioned ranking runs |
| `0002_news.sql` | Ingest staging, published feed, entity links, ingest RPCs |
| `0003_auth_rls.sql` | Profiles, roles, row-level security |

## Backend

See [backend/README.md](backend/README.md). Schema written; pipeline not yet
implemented.

## Open questions before the data work starts

- Source-by-source: scraping permitted, API available, or bulk download only?
- Ranking-aggregation licensing — reproducing another directory's ranking as a data
  point is a different legal question from linking to it.
- Naming: the domain is intended to be the project name + `.org`.
