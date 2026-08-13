import { getBriefsMeta, listBriefs } from "@/lib/data";
import { absoluteUrl, SITE } from "@/lib/site";

/**
 * Google News sitemap.
 *
 * A separate file from sitemap.xml on purpose: Google News reads the
 * <news:news> extension and only accepts items published in the last 48 hours,
 * so mixing it with the 294-URL general sitemap would mean submitting 294 URLs
 * to News that it will reject.
 *
 * Only the briefs appear here. They are the one thing on this site that is our
 * own reporting. The 818 aggregated headlines belong to the publishers who
 * wrote them and are linked out, not claimed — submitting them to Google News
 * would be asking to be indexed for other people's work, which is both wrong
 * and the fastest way to be removed from the index.
 */

export const revalidate = 600;
export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(): Promise<Response> {
  const [briefs, meta] = await Promise.all([listBriefs(), getBriefsMeta()]);

  const entries = briefs
    .slice(0, 100)
    .map((brief) => {
      const published = brief.generatedAt ?? meta.generatedAt;
      return `  <url>
    <loc>${escapeXml(absoluteUrl(`/news#${brief.id}`))}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE.name)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${published}</news:publication_date>
      <news:title>${escapeXml(brief.headline)}</news:title>
    </news:news>
  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate",
    },
  });
}
