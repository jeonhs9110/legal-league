/**
 * Single source of truth for brand and canonical URLs.
 *
 * Everything that search engines and answer engines read — titles, canonicals,
 * sitemap, robots, structured data — derives from here, so the site cannot end
 * up describing itself two different ways in two different places. That
 * consistency is most of technical SEO, and all of what makes a page quotable
 * by an answer engine.
 */

export const SITE = {
  name: "League of Legals",
  slogan: "A comprehensive legal media publication",
  /**
   * The reader-facing promise, used where a claim needs backing rather than
   * stating. Kept separate from the slogan so the two can be edited
   * independently — the slogan positions, this one commits.
   */
  promise: "Rankings you can check.",
  /**
   * The meta description — what Google prints under the title, and the first
   * thing a managing partner reads. It said this directory "ranks law firms"
   * with "the evidence behind every placement"; no ranking and no placement is
   * published. An overclaim survives longer here than anywhere else on a site,
   * because nobody looks at it again after launch.
   */
  descriptor:
    "A comprehensive legal media publication. A directory of law firms across 35 jurisdictions, with the source published for every listing.",
  /** Short form for cards and structured data, under 120 characters. */
  shortDescriptor:
    "Law firm directory and legal industry coverage across 35 jurisdictions, with every source published.",
  url: "https://www.leagueoflegals.com",
  locale: "en",
  /** Localisations planned; see docs/architecture.md. */
  plannedLocales: ["en", "ko", "ja", "zh"],
  contactEmail: "editor@leagueoflegals.com",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE.url).toString();
}

/** Page title in the form "Thing — League of Legals". */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.slogan}`;
}
