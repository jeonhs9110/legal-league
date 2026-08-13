import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, SITE } from "@/lib/site";
import { ArticleList } from "@/components/news/ArticleList";
import {
  getBriefsMeta,
  getNewsSnapshotMeta,
  getRegionCounts,
  listBriefs,
  listNews,
} from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/news" },
  title: "Legal industry news",
  description:
    "Legal industry news from across the G20 and Asia, collected from permitted sources and linked back to the publisher that reported it.",
};

// Rebuilt on a schedule rather than per request; the collector writes on a cron,
// so per-visitor queries would buy nothing.
export const revalidate = 600;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export default async function NewsPage() {
  const [articles, meta, briefs, briefsMeta, regions] = await Promise.all([
    listNews(),
    getNewsSnapshotMeta(),
    listBriefs(),
    getBriefsMeta(),
    getRegionCounts(),
  ]);
  // The front page carries the lead plus a readable slice; the full archive
  // lives on the regional pages. 848 stories in one column is a database dump.
  const [lead, ...rest] = articles;
  const recent = rest.slice(0, 39);

  // Each brief is original reporting written by this publication, and it is the
  // only content here that is ours. Marking it as NewsArticle is what lets
  // Google News index it and what lets an answer engine quote it with an
  // attribution instead of paraphrasing it as an unsourced opinion. The
  // aggregated headlines below are deliberately NOT marked: they belong to the
  // publishers who wrote them and are linked, not claimed.
  const articleSchema = briefs.slice(0, 40).map((brief) => ({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": absoluteUrl(`/news#${brief.id}`),
    headline: brief.headline.slice(0, 110),
    description: brief.standfirst ?? undefined,
    datePublished: brief.generatedAt ?? meta.generatedAt,
    dateModified: brief.generatedAt ?? meta.generatedAt,
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: { "@id": absoluteUrl("/#organization") },
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    // Every source the brief was written from, so the claim is checkable and
    // the outlets that did the reporting are credited in the markup itself.
    citation: brief.sources.map((source) => ({
      "@type": "CreativeWork",
      name: source.name,
      url: source.url,
    })),
    articleSection: "Legal industry",
  }));

  return (
    <>
      <JsonLd data={articleSchema} />
    <EditorialShell
      kicker="Industry news"
      headline="What the legal press is reporting"
      standfirst="Collected from publishers whose feeds permit syndication, deduplicated by canonical URL and content hash, and linked back to the source. Headlines and short extracts only — the full article stays with the publisher who wrote it."
      illustration="/brand/news.webp"
      rail={[
        { label: "Items", value: String(meta.total) },
        { label: "Sources", value: String(meta.sourceCount) },
        { label: "Collected", value: `${formatStamp(meta.generatedAt)} UTC` },
        { label: "Briefs", value: String(briefsMeta.total) },
      ]}
    >
      {briefs.length > 0 ? (
        <section className="border-b border-rule py-14">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 className="editorial text-3xl text-ink lg:text-4xl">
              Where the coverage converges
            </h2>
            <span className="label text-ink-faint">
              {briefsMeta.total} {briefsMeta.total === 1 ? "brief" : "briefs"}
            </span>
          </div>

          <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
            Written by Legal League where two or more independent outlets covered
            the same event. Each brief is drafted from the sources, checked
            against them for unsupported claims, then revised — every statement
            below traces to the reporting listed with it.
          </p>

          <div className="mt-10 space-y-14">
            {briefs.map((brief) => (
              <article key={brief.id}>
                <p className="label text-oxblood">
                  Legal League brief · {brief.sources.length} sources
                </p>

                <h3 className="editorial mt-3 max-w-3xl text-3xl leading-[1.15] text-ink lg:text-4xl">
                  {brief.headline}
                </h3>

                {brief.standfirst ? (
                  <p className="editorial measure mt-4 text-lg leading-relaxed text-ink-muted">
                    {brief.standfirst}
                  </p>
                ) : null}

                <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="editorial measure space-y-4 text-base leading-relaxed text-ink">
                    {brief.body
                      .split(/\n{2,}/)
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                  </div>

                  <aside className="lg:border-l lg:border-rule lg:pl-8">
                    <h4 className="label border-b border-ink pb-2 text-ink">
                      Reported by
                    </h4>
                    <ol className="mt-4 space-y-3">
                      {brief.sources.map((source, index) => (
                        <li key={source.url}>
                          <span className="figure mr-2 text-xs text-ink-faint">
                            [{index}]
                          </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="editorial text-sm text-ink link-underline"
                          >
                            {source.name}
                          </a>
                        </li>
                      ))}
                    </ol>

                    {brief.claims.length > 0 ? (
                      <p className="label mt-5 text-ink-faint">
                        {brief.claims.length} claims, each cited
                      </p>
                    ) : null}
                  </aside>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lead ? (
        <article className="border-b border-rule py-14">
          <p className="label text-oxblood">
            {lead.sourceName} · {formatDate(lead.publishedAt)}
            {lead.author ? ` · ${lead.author}` : ""}
          </p>

          <h2 className="editorial mt-4 max-w-4xl text-3xl leading-[1.12] text-ink lg:text-5xl">
            <a
              href={lead.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="link-underline"
            >
              {lead.title}
            </a>
          </h2>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              {lead.summary ? (
                <p className="editorial text-lg leading-relaxed text-ink-muted">
                  {lead.summary}
                </p>
              ) : null}

              {lead.excerpt ? (
                <blockquote
                  className={`border-l-2 border-oxblood pl-5 ${lead.summary ? "mt-6" : ""}`}
                >
                  <p className="editorial text-base italic leading-relaxed text-ink-muted">
                    {lead.excerpt}
                  </p>
                  <cite className="label mt-2 block not-italic text-ink-faint">
                    Extract · {lead.sourceName}
                  </cite>
                </blockquote>
              ) : null}
            </div>

            {lead.entities.length > 0 ? (
              <div className="lg:border-l lg:border-rule lg:pl-8">
                <h3 className="label border-b border-ink pb-2 text-ink">
                  Firms named
                </h3>
                <ul className="mt-4 space-y-3">
                  {lead.entities.map((entity) => (
                    <li key={entity.firmSlug}>
                      <Link
                        href={`/firms/${entity.firmSlug}`}
                        className="editorial text-base text-ink link-underline"
                      >
                        {entity.firmName}
                      </Link>
                      <span className="figure ml-2 text-xs text-ink-faint">
                        {Math.round(entity.confidence * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </article>
      ) : null}

      <section className="border-b border-rule py-8">
        <h2 className="label text-ink-faint">Coverage by region</h2>
        <div className="mt-4 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map(({ region, count }) => (
            <Link
              key={region.slug}
              href={`/news/${region.slug}`}
              className="group flex items-baseline justify-between gap-4 border-b border-rule/60 pb-2"
            >
              <span className="editorial text-lg text-ink transition-colors group-hover:text-oxblood">
                {region.name}
              </span>
              <span className="rank-figure text-lg text-ink-faint">{count}</span>
            </Link>
          ))}
        </div>
      </section>

      <ArticleList articles={recent} />

      <div className="mt-10 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-rule pt-6">
        <span className="label text-ink-faint">
          Showing {recent.length + 1} of {meta.total} stories
        </span>
        {regions.map(({ region, count }) => (
          <Link
            key={region.slug}
            href={`/news/${region.slug}`}
            className="label text-oxblood link-underline"
          >
            All {count} from {region.name}
          </Link>
        ))}
      </div>

      <div className="measure mt-12 border-l-2 border-rule-strong pl-5">
        <p className="label text-ink-faint">How this feed is built</p>
        <p className="editorial mt-2 text-sm leading-relaxed text-ink-muted">
          Extracts are reproduced under short-quotation limits and capped at 320
          characters; full articles remain with the publisher. Sources are
          admitted only after their robots.txt and terms have been read — one
          publisher that disallows AI crawlers and one that refuses automated
          requests are recorded as excluded rather than worked around.
        </p>
        <p className="editorial mt-3 text-sm leading-relaxed text-ink-muted">
          Firm matching and plain-language summaries are not running yet. Both
          need a language model, and an invented summary would be worse than
          none.
        </p>
      </div>
    </EditorialShell>
    </>
  );
}
