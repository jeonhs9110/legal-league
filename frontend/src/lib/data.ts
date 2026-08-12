/**
 * Data-access layer. Every page reads through these functions and nothing else
 * imports the data files directly.
 *
 * Everything served here is now real:
 *
 *   src/data/firms.json     ← backend/pipelines/directory/fetch_firms.py
 *   src/data/news.json      ← backend/pipelines/news/fetch_news.py
 *   src/data/rankings.json  ← backend/pipelines/rankings/build_rankings.py
 *
 * This remains the Supabase swap point: replacing the JSON reads with
 * PostgREST queries changes this file only. The signatures are already async
 * and return the shapes a query would.
 *
 *   listJurisdictions() →  select * from ranking_runs join firm_rankings ...
 *   listNews()          →  select * from news_articles
 *                          where status = 'published' order by published_at desc
 */

import rankingsSnapshot from "@/data/rankings.json";
import newsSnapshot from "@/data/news.json";
import briefsSnapshot from "@/data/briefs.json";
import { METHODOLOGY } from "./fixtures/methodology";
import type {
  DirectoryFirm,
  Jurisdiction,
  JurisdictionEntry,
  Methodology,
  NewsArticle,
  NewsSnapshot,
  RankingsSnapshot,
  Brief,
  BriefsSnapshot,
} from "./types";

const RANKINGS = rankingsSnapshot as RankingsSnapshot;
const NEWS_SNAPSHOT = newsSnapshot as NewsSnapshot;
const NEWS = NEWS_SNAPSHOT.articles;
const BRIEFS_SNAPSHOT = briefsSnapshot as BriefsSnapshot;

/**
 * True while no jurisdiction has cleared the evidence threshold. Drives the
 * site-wide disclosure. It is derived from the pipeline output rather than
 * hand-set, so it cannot fall out of step with what is actually published.
 */
export const RANKINGS_PUBLISHED = RANKINGS.summary.published > 0;

/**
 * Deterministic name ordering.
 *
 * Do NOT use `localeCompare` here. It resolves against the host's default
 * locale, which differs between the Node process rendering the HTML and the
 * browser hydrating it — the server produced one order and the client another,
 * which React reports as a hydration mismatch. Code-unit comparison is stable
 * everywhere.
 */
function byName(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Jurisdictions and firms
// ---------------------------------------------------------------------------

export async function getRankingsMeta() {
  return {
    generatedAt: RANKINGS.generatedAt,
    methodologyVersion: RANKINGS.methodologyVersion,
    minCoverage: RANKINGS.minCoverage,
    attribution: RANKINGS.attribution,
    ...RANKINGS.summary,
  };
}

export async function listJurisdictionEntries(): Promise<JurisdictionEntry[]> {
  return [...RANKINGS.jurisdictions].sort((a, b) => byName(a.name, b.name));
}

/** Jurisdictions that have at least one firm on file. */
export async function listCoveredJurisdictions(): Promise<JurisdictionEntry[]> {
  const all = await listJurisdictionEntries();
  return all.filter((j) => j.firmCount > 0);
}

export async function getJurisdictionBySlug(
  slug: string,
): Promise<JurisdictionEntry | null> {
  return RANKINGS.jurisdictions.find((j) => j.slug === slug) ?? null;
}

export async function listJurisdictions(): Promise<Jurisdiction[]> {
  const all = await listJurisdictionEntries();
  return all.map(({ isoNumeric, isoAlpha2, slug, name, region, g20 }) => ({
    isoNumeric,
    isoAlpha2,
    slug,
    name,
    region,
    g20,
  }));
}

export type FirmWithJurisdiction = DirectoryFirm & {
  jurisdiction: Jurisdiction;
};

export async function listFirms(): Promise<FirmWithJurisdiction[]> {
  const firms: FirmWithJurisdiction[] = [];
  for (const entry of RANKINGS.jurisdictions) {
    const { isoNumeric, isoAlpha2, slug, name, region, g20 } = entry;
    for (const firm of entry.firms) {
      firms.push({
        ...firm,
        jurisdiction: { isoNumeric, isoAlpha2, slug, name, region, g20 },
      });
    }
  }
  return firms.sort((a, b) => byName(a.name, b.name));
}

export async function getFirmBySlug(
  slug: string,
): Promise<FirmWithJurisdiction | null> {
  const firms = await listFirms();
  return firms.find((f) => f.slug === slug) ?? null;
}

export async function getFirmPeers(
  firm: FirmWithJurisdiction,
): Promise<DirectoryFirm[]> {
  const entry = await getJurisdictionBySlug(firm.jurisdiction.slug);
  if (!entry) return [];
  return entry.firms.filter((f) => f.slug !== firm.slug);
}

export async function getCoverage() {
  return {
    ...RANKINGS.summary,
    rankedIsoNumerics: RANKINGS.jurisdictions
      .filter((j) => j.firmCount > 0)
      .map((j) => j.isoNumeric),
  };
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export async function getNewsSnapshotMeta() {
  return {
    generatedAt: NEWS_SNAPSHOT.generatedAt,
    sourceCount: NEWS_SNAPSHOT.sourceCount,
    total: NEWS.length,
  };
}

export async function listNews(limit?: number): Promise<NewsArticle[]> {
  const sorted = [...NEWS].sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function listNewsForFirm(slug: string): Promise<NewsArticle[]> {
  const all = await listNews();
  return all.filter((article) =>
    article.entities.some((e) => e.firmSlug === slug),
  );
}

export async function getMethodology(): Promise<Methodology> {
  return METHODOLOGY;
}

/**
 * Synthesized briefs. Produced only where at least two independent outlets
 * covered the same event, then fact-checked against those sources before
 * publication — see backend/pipelines/news/synthesize.py.
 */
export async function listBriefs(limit?: number): Promise<Brief[]> {
  const sorted = [...BRIEFS_SNAPSHOT.briefs];
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getBriefsMeta() {
  return {
    generatedAt: BRIEFS_SNAPSHOT.generatedAt,
    model: BRIEFS_SNAPSHOT.currentModel,
    total: BRIEFS_SNAPSHOT.briefs.length,
  };
}
