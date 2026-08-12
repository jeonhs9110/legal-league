# Third-party licenses and commercial clearance

Audit of everything shipped in `frontend/`. Not legal advice — it is a record of
what was checked and what was removed, so counsel can review it quickly.

## Cleared for commercial use

| Component | License | Commercial | Attribution required |
| --- | --- | --- | --- |
| Next.js, React, React DOM | MIT | Yes | No (notice retained in `node_modules`) |
| Tailwind CSS, PostCSS, Autoprefixer | MIT | Yes | No |
| lucide-react (icons) | ISC | Yes | No |
| d3-geo, topojson-client | ISC | Yes | No |
| world-atlas (map topology) | ISC (code) | Yes | Copyright notice retained |
| Natural Earth (underlying map data) | Public domain | Yes | None required |
| Poppins | SIL Open Font License 1.1 | Yes | No, but OFL text must travel with the font files |
| Source Serif 4 | SIL Open Font License 1.1 | Yes | Same |

Notes:

- **Fonts are self-hosted.** `next/font/google` downloads Poppins and Source Serif 4
  at build time and serves them from your own origin. Nothing is requested from
  `fonts.googleapis.com` at runtime, which also removes the EU visitor-IP problem
  that has produced GDPR fines for sites hot-linking Google Fonts.
- **OFL forbids selling the fonts themselves**, not selling a site that uses them.
  Bundling inside a web app is expressly permitted.
- The world-atlas copyright line is preserved at
  `frontend/public/data/world-atlas-LICENSE.txt`.

## Removed as unclear

| Removed | Why |
| --- | --- |
| `d8j0ntlcm91z4.cloudfront.net/...mp4` background video | Third-party CDN under someone else's user ID. No license, no author, no grant of commercial use. Unknown provenance is the single most common source of a takedown or infringement claim on a commercial site. Replaced with `Backdrop.tsx`, a pure-CSS animated gradient with an inline `feTurbulence` grain — nothing downloaded, nothing to license. |
| "MARCUS AURELIO" pull quote | An invented quotation attributed to a name closely resembling a real historical figure. Fabricated attributions are a false-light risk and, in a legal-industry product, a credibility one. |
| "bloom" name and floral imagery | Belonged to the source design spec, not this product. |
| Flower thumbnail asset | Not needed after the rebrand. |

## First-party assets

`frontend/public/logo.svg` was authored for this project. No copyright is carried
in from anywhere else. Replace it with your real mark before launch and get the
wordmark trademark-searched in your filing jurisdictions.

## The real exposure is the data, not the code

The frontend is clean. The commercial risk in this product lives in `backend/`,
and none of it is solved by the current placeholder content:

1. **Republishing other directories' rankings.** Facts are not copyrightable, but a
   *selection and arrangement* of rankings can be protected as a compilation in
   the US, and the EU sui generis database right protects substantial extraction
   from a database even when individual facts are free. Citing that "Chambers
   placed firm X in Band 1" as a sourced data point is defensible; ingesting their
   full tables and re-publishing them is the thing that draws a letter.
2. **Terms of service.** Scraping usually breaches a site's ToS regardless of
   copyright. That is contract, not IP, and it is the more common basis for action.
   Prefer APIs and bulk downloads; record per-source what was permitted.
3. **Defamation and unfair competition.** Publishing that a real firm ranks below
   another is an actionable statement in many jurisdictions if it cannot be traced
   to a verifiable source. This is why `frontend/src/lib/rankings.ts` uses invented
   firm names and the UI carries a visible "illustrative sample data" label. Keep
   both until real placements each cite an origin.
4. **Court records.** Judgment text is generally free to use (US federal opinions
   are uncopyrightable government edicts), but headnotes, syllabi, and star
   pagination added by commercial reporters are not. Pull from official court
   sources, not from a commercial database.
5. **Personal data.** Named lawyers are identifiable individuals; GDPR/UK GDPR and
   Korea's PIPA apply to profiles built about them, including a right to erasure.
   Plan for a correction-and-removal process before launch, not after.

Before taking money: get counsel to review items 1–5 against your actual source
list, and publish the methodology page — an open method is both the product
differentiator and the strongest defense that a placement is fair comment on
verifiable facts.
