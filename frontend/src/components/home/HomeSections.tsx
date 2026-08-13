import Link from "next/link";
import {
  formatUsd,
  getImportanceMeta,
  getMethodology,
  getRegionCounts,
  listCoveredJurisdictions,
  listHighlights,
} from "@/lib/data";

const CONTINENT_ORDER = [
  "Asia-Pacific",
  "Europe",
  "Americas",
  "Africa & Middle East",
];

/** Directory region name -> the news region slug covering the same ground. */
const NEWS_SLUG: Record<string, string> = {
  "Asia-Pacific": "asia-pacific",
  Europe: "europe",
  Americas: "americas",
  "Africa & Middle East": "africa-middle-east",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The two pillars, kept apart.
 *
 * This page previously ran "Where We Have Coverage", then a second section
 * called "Coverage", then a mixed list of press cuttings — three blocks saying
 * overlapping things, with the directory and the news bleeding into each other.
 * A reader could not tell what kind of thing they were looking at.
 *
 * Now: the directory, grouped by continent. Then the news, grouped by the same
 * continents. Same geography in both, so a reader who wants Asia gets the firms
 * and the reporting under one heading rather than learning two navigations.
 */
export async function HomeSections() {
  const [covered, highlights, methodology, regions, importance] =
    await Promise.all([
      listCoveredJurisdictions(),
      listHighlights(),
      getMethodology(),
      getRegionCounts(),
      getImportanceMeta(),
    ]);

  const directory = CONTINENT_ORDER.map((continent) => ({
    continent,
    newsSlug: NEWS_SLUG[continent],
    stories:
      regions.find((r) => r.region.slug === NEWS_SLUG[continent])?.count ?? 0,
    jurisdictions: covered
      .filter((j) => j.region === continent)
      .sort((a, b) => b.firmCount - a.firmCount),
  })).filter((group) => group.jurisdictions.length > 0);

  return (
    <div className="relative z-10 bg-paper text-ink">
      <div className="h-px w-full bg-rule" />

      {/* ---------------------------------------------------------- *
       * Pillar one: the directory
       * ---------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
          <h2 data-i18n="home.directory" className="editorial text-3xl text-ink lg:text-4xl">
            The Directory
          </h2>
          <Link href="/rankings" className="label text-oxblood link-underline" data-i18n="home.allJurisdictions">
            All 35 jurisdictions
          </Link>
        </div>

        <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
          Law firms by jurisdiction, grouped by continent. Every listing records
          the source it came from. Where two independent publishers agree on a
          firm it is ranked; otherwise the list is alphabetical and says so.
        </p>

        <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-2">
          {directory.map((group) => (
            <section key={group.continent}>
              <h3 className="editorial border-b border-ink pb-2 text-2xl text-ink">
                {group.continent}
              </h3>

              <ul className="mt-4 divide-y divide-rule/70">
                {group.jurisdictions.slice(0, 7).map((j) => (
                  <li key={j.slug}>
                    <Link
                      href={`/rankings/${j.slug}`}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
                      <span className="editorial text-base text-ink link-underline">
                        {j.name}
                      </span>
                      <span className="figure shrink-0 text-sm text-ink-faint">
                        {j.firmCount} firms
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {group.jurisdictions.length > 7 ? (
                <Link
                  href="/rankings"
                  className="label mt-3 inline-block text-ink-faint link-underline"
                >
                  {group.jurisdictions.length - 7} more in {group.continent}
                </Link>
              ) : null}
            </section>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- *
       * Pillar two: the news
       * ---------------------------------------------------------- */}
      <section className="border-y border-rule bg-paper-sunken">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 data-i18n="home.news" className="editorial text-3xl text-ink lg:text-4xl">
              The News
            </h2>
            <Link href="/news" className="label text-oxblood link-underline" data-i18n="home.allCoverage">
              All coverage
            </Link>
          </div>

          <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
            Legal industry reporting, grouped by the same continents. Collected
            from publishers whose feeds permit it and linked back to whoever
            wrote it.
          </p>

          <div className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {directory.map((group) => (
              <Link
                key={group.continent}
                href={`/news/${group.newsSlug}`}
                className="group flex items-baseline justify-between gap-3 border-b border-rule/60 pb-2"
              >
                <span className="editorial text-base text-ink transition-colors group-hover:text-oxblood">
                  {group.continent}
                </span>
                <span className="rank-figure text-base text-ink-faint">
                  {group.stories}
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
            <h3 className="editorial text-2xl text-ink">Highlights</h3>
            <span className="label text-ink-faint">
              Weighted by what is at stake
            </span>
          </div>

          <ol className="mt-6 grid gap-x-14 gap-y-8 lg:grid-cols-2">
            {highlights.map((article, index) => (
              <li key={article.id} className="flex gap-5">
                <span className="rank-figure shrink-0 text-2xl text-ink-faint">
                  {index + 1}
                </span>
                <div>
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <time
                      dateTime={article.publishedAt}
                      className="figure text-sm text-ink"
                    >
                      {formatDate(article.publishedAt)}
                    </time>
                    <span className="label text-ink-faint">
                      {article.sourceName}
                    </span>
                    {article.capitalUsd ? (
                      <span className="label text-oxblood">
                        {formatUsd(article.capitalUsd)} at stake
                      </span>
                    ) : null}
                  </p>
                  <h4 className="editorial mt-1.5 text-lg leading-snug text-ink">
                    <a
                      href={article.canonicalUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="link-underline"
                    >
                      {article.title}
                    </a>
                  </h4>
                </div>
              </li>
            ))}
          </ol>

          <p className="measure mt-8 border-l-2 border-rule-strong pl-5">
            <span className="label text-ink-faint">How These Six Are Chosen</span>
            <span className="editorial mt-2 block text-sm leading-relaxed text-ink-muted">
              Ranked by the capital at stake — every currency converted to US
              dollars — together with the seniority of the court, how far the
              matter reaches, and whether a firm in this directory is named.
              The six are then spread across jurisdictions, because India
              supplies two thirds of the corpus: it is where two of our three
              crawlable Asian sources report from, and without that spread it
              would fill the page on volume rather than merit.
            </span>
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- *
       * How it is put together
       * ---------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_360px] lg:gap-20">
          <div>
            <span className="label text-oxblood">
              Methodology · version {methodology.version}
            </span>
            <h2 className="editorial mt-4 text-3xl leading-tight text-ink lg:text-4xl">
              Every ranking published with the arithmetic attached
            </h2>
            <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
              Other directories publish a band and withhold the calculation
              behind it. This publishes both — and, for each jurisdiction, what
              the ranking does not rest on.
            </p>
            <Link
              href="/methodology"
              className="label mt-6 inline-block text-oxblood link-underline"
            >
              Read the full methodology
            </Link>
          </div>

          <dl className="divide-y divide-rule/70 border-y border-rule/70">
            {methodology.signals.map((signal) => (
              <div
                key={signal.key}
                className="flex items-baseline justify-between gap-4 py-3"
              >
                <dt className="editorial text-sm text-ink">{signal.label}</dt>
                <dd className="figure text-sm text-ink-faint">
                  {Math.round(signal.weight * 100)}%
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
