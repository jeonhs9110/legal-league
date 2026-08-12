import type { MetadataRoute } from "next";
import { listCoveredJurisdictions, listFirms, getRankingsMeta } from "@/lib/data";
import { absoluteUrl } from "@/lib/site";

/**
 * Generated from the same data the pages render, so a jurisdiction that has no
 * page never appears here. A sitemap listing URLs that 404 is worse than no
 * sitemap: it teaches a crawler that the file is unreliable.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jurisdictions, firms, meta] = await Promise.all([
    listCoveredJurisdictions(),
    listFirms(),
    getRankingsMeta(),
  ]);

  const built = new Date(meta.generatedAt);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily" as const, priority: 1 },
    { url: absoluteUrl("/rankings"), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: absoluteUrl("/news"), changeFrequency: "daily" as const, priority: 0.9 },
    { url: absoluteUrl("/methodology"), changeFrequency: "monthly" as const, priority: 0.8 },
    { url: absoluteUrl("/for-firms"), changeFrequency: "monthly" as const, priority: 0.7 },
  ].map((route) => ({ ...route, lastModified: built }));

  return [
    ...staticRoutes,
    ...jurisdictions.map((j) => ({
      url: absoluteUrl(`/rankings/${j.slug}`),
      lastModified: built,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...firms.map((f) => ({
      url: absoluteUrl(`/firms/${f.slug}`),
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
