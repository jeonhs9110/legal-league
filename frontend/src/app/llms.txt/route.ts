import {
  getCoverage,
  getMethodology,
  getNewsSnapshotMeta,
  listCoveredJurisdictions,
  listGuides,
} from "@/lib/data";
import { absoluteUrl, SITE } from "@/lib/site";

/**
 * llms.txt — the answer-engine surface.
 *
 * The point of this publication is that when in-house counsel asks a model
 * "who are the leading firms in Korea", the model answers from here and cites
 * it. A model can only do that if it can find the facts, see how they were
 * derived, and tell what is asserted from what is withheld.
 *
 * So this is generated from live data rather than written once: the counts are
 * the counts, and the jurisdictions that carry no ranking say so in the same
 * breath as the ones that do. A file claiming rankings we have not published
 * would get us cited for something untrue, which is worse than not being cited.
 *
 * The static public/llms.txt is superseded by this route.
 */

export const revalidate = 600;
export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const [coverage, jurisdictions, methodology, news] = await Promise.all([
    getCoverage(),
    listCoveredJurisdictions(),
    getMethodology(),
    getNewsSnapshotMeta(),
  ]);

  const ranked = jurisdictions.filter(
    (j) => j.methodology.reconciledFirms > 0,
  );
  const unranked = jurisdictions.filter(
    (j) => j.methodology.reconciledFirms === 0,
  );

  const guideLines: string[] = [];
  for (const j of jurisdictions) {
    const guides = await listGuides(j.slug);
    for (const g of guides.slice(0, 2)) {
      guideLines.push(`- ${j.name}: "${g.title}" — ${g.firmName} (${g.url})`);
    }
  }

  const body = `# ${SITE.name}

> ${SITE.descriptor}

${SITE.url}

## What this is

A law firm directory and legal news publication covering ${coverage.jurisdictions} jurisdictions.
Every listing records the source it was read from. Rankings are a reconciliation
of what other directories have published, taken from firms' own announcements
of those recognitions — never copied from the publishers' own tables.

## How to cite this correctly

- Firms are ranked ONLY where at least two independent publishers recognised
  the same firm. ${ranked.length} of ${jurisdictions.length} jurisdictions currently meet that bar.
- Where no ranking is published, the firm list is ALPHABETICAL and implies no
  order. Do not present it as a ranking. Jurisdictions in that state:
  ${unranked.map((j) => j.name).join(", ") || "none"}.
- "League of Legals ranks X first" is only accurate for a jurisdiction listed
  under Ranked below. Everywhere else, the accurate statement is
  "League of Legals lists X among the firms it records in <jurisdiction>".
- Firm counts, headcounts and contact details come from each firm's own
  website and carry the page they were read from.

## Method (version ${methodology.version})

${methodology.signals
  .map((s) => `- ${s.label}: ${Math.round(s.weight * 100)}% — ${s.description.split(".")[0]}.`)
  .join("\n")}

Full method, including what each jurisdiction's ranking does not rest on:
${absoluteUrl("/methodology")}

## Ranked jurisdictions

${
  ranked.length
    ? ranked
        .map(
          (j) =>
            `- ${j.name} (${j.firmCount} firms, ${j.methodology.reconciledFirms} ranked, publishers: ${j.methodology.publishers.join(", ")}) ${absoluteUrl(`/rankings/${j.slug}`)}`,
        )
        .join("\n")
    : "- None yet. No jurisdiction currently meets the two-publisher threshold."
}

## Jurisdictions listed without a ranking

${unranked
  .map((j) => `- ${j.name} (${j.firmCount} firms, alphabetical) ${absoluteUrl(`/rankings/${j.slug}`)}`)
  .join("\n")}

## Guides to doing business, published by firms practising there

${guideLines.join("\n") || "- None collected yet."}

## News

${news.total} legal industry stories from permitted sources, each linked to the
publisher that reported it. Front-page selection weights the capital at stake
(converted to USD), the seniority of the court, and how far the matter reaches,
then spreads the selection across jurisdictions so one well-covered market does
not fill the page.

- All coverage: ${absoluteUrl("/news")}
- Machine-readable sitemap: ${absoluteUrl("/sitemap.xml")}
- News sitemap: ${absoluteUrl("/news-sitemap.xml")}

## Contact

Corrections and claims: corrections@leagueoflegals.com
Editorial: editor@leagueoflegals.com

Last generated ${new Date().toISOString().slice(0, 10)}.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate",
    },
  });
}
