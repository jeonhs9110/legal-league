import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

/**
 * Crawler policy.
 *
 * AI crawlers are allowed deliberately, not by omission. Being quoted by an
 * answer engine is a distribution channel for a directory whose value is being
 * cited — and having excluded a publisher from our own collection because its
 * robots.txt disallows AI crawlers, we owe readers an explicit statement of our
 * own position rather than a silent default.
 *
 * The exception is /api and Next internals, which have nothing to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
