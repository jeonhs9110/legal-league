import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { ArticleList } from "@/components/news/ArticleList";
import {
  getNewsSnapshotMeta,
  getRegionBySlug,
  getRegionCounts,
  listNewsByRegion,
} from "@/lib/data";

type Props = { params: Promise<{ region: string }> };

export async function generateStaticParams() {
  const counts = await getRegionCounts();
  return counts.map(({ region }) => ({ region: region.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: slug } = await params;
  const region = getRegionBySlug(slug);
  if (!region) return { title: "Not found" };

  const articles = await listNewsByRegion(slug);
  return {
    alternates: { canonical: `/news/${slug}` },
    title: `${region.name} legal news`,
    description: `${articles.length} legal industry stories from ${region.name}, collected from permitted sources and linked back to the publisher that reported each one.`,
  };
}

export const revalidate = 600;

export default async function RegionNewsPage({ params }: Props) {
  const { region: slug } = await params;
  const region = getRegionBySlug(slug);
  if (!region) notFound();

  const [articles, counts, meta] = await Promise.all([
    listNewsByRegion(slug),
    getRegionCounts(),
    getNewsSnapshotMeta(),
  ]);

  if (articles.length === 0) notFound();

  const sources = new Set(articles.map((a) => a.sourceName));

  return (
    <EditorialShell
      kicker="Industry news"
      headline={`${region.name} legal news`}
      standfirst={region.blurb}
      rail={[
        { label: "Stories", value: String(articles.length) },
        { label: "Sources", value: String(sources.size) },
        { label: "Region", value: region.name },
        { label: "Of all coverage", value: `${Math.round((articles.length / meta.total) * 100)}%` },
      ]}
    >
      <nav
        aria-label="Other regions"
        className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-rule py-6"
      >
        <Link href="/news" className="label text-ink-muted link-underline">
          All coverage
        </Link>
        {counts
          .filter((c) => c.region.slug !== slug)
          .map(({ region: other, count }) => (
            <Link
              key={other.slug}
              href={`/news/${other.slug}`}
              className="label text-ink-muted transition-colors hover:text-oxblood"
            >
              {other.name}{" "}
              <span className="figure text-ink-faint">{count}</span>
            </Link>
          ))}
      </nav>

      <ArticleList articles={articles} />

      <p className="measure mt-12 border-l-2 border-rule-strong pl-5">
        <span className="label text-ink-faint">How this page is built</span>
        <span className="editorial mt-2 block text-sm leading-relaxed text-ink-muted">
          A story is placed in {region.name} by the jurisdiction its publisher
          covers, recorded when the source was admitted — not by reading the
          article. Extracts are capped at 320 characters and the full article
          stays with the publisher who wrote it.
        </span>
      </p>
    </EditorialShell>
  );
}

export const dynamicParams = false;
