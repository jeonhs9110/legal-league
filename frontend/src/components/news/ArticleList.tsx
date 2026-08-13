import Link from "next/link";
import type { NewsArticle } from "@/lib/types";

/**
 * The article feed, shared by /news and every /news/[region] page so the two
 * cannot drift into rendering the same story two different ways.
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ArticleList({ articles }: { articles: NewsArticle[] }) {
  return (
    <div className="grid gap-x-16 lg:grid-cols-2">
      {articles.map((article) => (
        <article key={article.id} className="border-b border-rule/70 py-8">
          <p className="label text-ink-faint">
            {article.sourceName} · {formatDate(article.publishedAt)}
          </p>

          <h2 className="editorial mt-3 text-2xl leading-snug text-ink">
            <a
              href={article.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="link-underline"
            >
              {article.title}
            </a>
          </h2>

          {article.summary ? (
            <p className="editorial mt-3 text-base leading-relaxed text-ink-muted">
              {article.summary}
            </p>
          ) : null}

          {article.excerpt ? (
            <p className="editorial mt-3 border-l-2 border-rule-strong pl-4 text-sm italic leading-relaxed text-ink-faint">
              {article.excerpt}
            </p>
          ) : null}

          {article.entities.length > 0 || article.author ? (
            <p className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {article.entities.map((entity) => (
                <Link
                  key={entity.firmSlug}
                  href={`/firms/${entity.firmSlug}`}
                  className="label text-oxblood link-underline"
                >
                  {entity.firmName}
                </Link>
              ))}
              {article.author ? (
                <span className="label text-ink-faint">{article.author}</span>
              ) : null}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
