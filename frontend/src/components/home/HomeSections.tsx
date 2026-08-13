import Link from "next/link";
import {
  getMethodology,
  getRankingsMeta,
  listCoveredJurisdictions,
  listNews,
} from "@/lib/data";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The editorial half of the home page. The dark hero establishes the brand; this
 * is where a reader who scrolls finds actual content — coverage, the latest
 * stories, and the methodology — without having to guess at the navigation.
 */
export async function HomeSections() {
  const [covered, news, methodology, meta] = await Promise.all([
    listCoveredJurisdictions(),
    listNews(4),
    getMethodology(),
    getRankingsMeta(),
  ]);

  const featured = [...covered]
    .sort((a, b) => b.firmCount - a.firmCount)
    .slice(0, 8);

  return (
    <div className="relative z-10 bg-paper text-ink">
      {/* Transition strip: carries the eye from the dark hero into the paper. */}
      <div className="h-px w-full bg-rule" />

      <section className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
          <h2 className="editorial text-3xl text-ink lg:text-4xl">Coverage</h2>
          <Link href="/rankings" className="label text-oxblood link-underline">
            All {meta.jurisdictions} jurisdictions
          </Link>
        </div>

        <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
          {meta.firms} firms on file across {meta.withFirms} jurisdictions, each
          traceable to its source. {meta.published === 0
            ? "No ranking is published yet: the evidence a score requires has not been collected, and an unfounded number is worse than none."
            : `${meta.published} jurisdictions have a published ranking.`}
        </p>

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="border-b border-rule">
              <th className="label py-2 text-left text-ink-faint">Jurisdiction</th>
              <th className="label hidden py-2 text-left text-ink-faint sm:table-cell">
                Region
              </th>
              <th className="label py-2 text-right text-ink-faint">Firms</th>
            </tr>
          </thead>
          <tbody>
            {featured.map((entry) => (
              <tr
                key={entry.isoNumeric}
                className="border-b border-rule/70 transition-colors hover:bg-paper-sunken"
              >
                <td className="py-4 align-baseline">
                  <Link
                    href={`/rankings/${entry.slug}`}
                    className="editorial text-xl text-ink link-underline"
                  >
                    {entry.name}
                  </Link>
                </td>
                <td className="label hidden py-4 align-baseline text-ink-faint sm:table-cell">
                  {entry.region}
                </td>
                <td className="figure py-4 text-right align-baseline text-base text-ink">
                  {entry.firmCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="border-t border-rule bg-paper-sunken">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 className="editorial text-3xl text-ink lg:text-4xl">
              Latest from the legal press
            </h2>
            <Link href="/news" className="label text-oxblood link-underline">
              All coverage
            </Link>
          </div>

          <div className="mt-2 grid gap-x-16 lg:grid-cols-2">
            {news.map((article) => (
              <article key={article.id} className="border-b border-rule/70 py-6">
                <p className="label text-ink-faint">
                  {article.sourceName} · {formatDate(article.publishedAt)}
                </p>
                <h3 className="editorial mt-2 text-xl leading-snug text-ink">
                  <a
                    href={article.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="link-underline"
                  >
                    {article.title}
                  </a>
                </h3>
                {article.summary ?? article.excerpt ? (
                  <p className="editorial mt-2 text-sm leading-relaxed text-ink-muted">
                    {article.summary ?? article.excerpt}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-16 lg:px-10 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_1fr] lg:gap-20">
            <div>
              <span className="label text-oxblood">
                Methodology · version {methodology.version}
              </span>
              <h2 className="editorial mt-4 text-3xl leading-tight text-ink lg:text-4xl">
                Every ranking published with the arithmetic attached
              </h2>
              <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
                Existing directories publish a band and withhold the calculation
                behind it. Legal League publishes both — and publishes nothing at
                all until the evidence exists to support it.
              </p>
              <Link
                href="/methodology"
                className="label mt-6 inline-block text-oxblood link-underline"
              >
                Read the full methodology
              </Link>
            </div>

            <table className="h-fit w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="label py-2 text-left text-ink">Signal</th>
                  <th className="label py-2 text-right text-ink">Weight</th>
                  <th className="label py-2 text-right text-ink">Held</th>
                </tr>
              </thead>
              <tbody>
                {methodology.signals.map((signal) => (
                  <tr key={signal.key} className="border-b border-rule/70">
                    <td className="editorial py-3.5 text-base text-ink">
                      {signal.label}
                    </td>
                    <td className="figure py-3.5 text-right text-base text-ink">
                      {Math.round(signal.weight * 100)}%
                    </td>
                    <td className="label py-3.5 text-right text-ink-faint">
                      none
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink">
                  <td className="label py-3 text-ink">Excluded outright</td>
                  <td
                    className="figure py-3 text-right text-base text-ink-muted"
                    colSpan={2}
                  >
                    {methodology.exclusions.length} rules
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
