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
  name: "Legal League",
  slogan: "A comprehensive legal media publication",
  /**
   * The reader-facing promise, used where a claim needs backing rather than
   * stating. Kept separate from the slogan so the two can be edited
   * independently — the slogan positions, this one commits.
   */
  promise: "Rankings you can check.",
  /** Longer descriptor for meta descriptions and structured data. */
  descriptor:
    "An open legal directory ranking law firms across the G20 and the major legal markets, with the methodology and the evidence behind every placement published in full.",
  url: "https://legalleague.org",
  locale: "en",
  /** Localisations planned; see docs/architecture.md. */
  plannedLocales: ["en", "ko", "ja", "zh"],
  contactEmail: "editor@legalleague.org",
} as const;

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE.url).toString();
}

/** Page title in the form "Thing — Legal League". */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${SITE.name}` : `${SITE.name} — ${SITE.slogan}`;
}
