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
    total: NEWS.filter((a) => (a.language ?? "en") === "en" && isRealArticle(a)).length,
  };
}

/**
 * English only. The project standard is that everything is collected and
 * published in English, and translation happens at export; showing a Korean
 * headline in an otherwise English feed is not multilingual, it is broken.
 * The non-English articles stay in the corpus for the clustering step, which
 * reads them, and are simply not displayed.
 */
/**
 * Boilerplate and section-index pages the sitemap crawler swept up alongside
 * real articles: "Terms of Use", "Privacy Policy", "Litigation News". They were
 * rendering as headlines on the homepage of a legal publication, which is the
 * single most damaging thing a reader could see there.
 *
 * A published article has a headline slug in its URL; a section index has a
 * label. That, plus a short title, is the pair of signals that separates them —
 * neither is reliable alone, since real articles can have short headlines and
 * real slugs can be short.
 */
/**
 * Publishers serve headlines HTML-escaped. Stored raw and handed to React,
 * which escapes again, "Law &amp; Policy" reaches the reader as literal
 * "Law &amp; Policy" — on 221 of 848 articles, a quarter of the feed.
 * Decoded once here, at the boundary, so no page has to remember to do it.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  ndash: "–", mdash: "—", hellip: "…", rupee: "₹",
};

function decodeEntities(value: string): string {
  // Twice: several publishers double-encode, so one pass turns "&amp;#x27;"
  // into "&#x27;" and stops one step short of an apostrophe.
  return decodeOnce(decodeOnce(value));
}

function decodeOnce(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * A published article has a headline slug in its URL. A section index has a
 * label: /news, /columns, /law-firms/corporate.
 *
 * The URL is the whole test. An earlier version also accepted any title over
 * seventy characters, which let every section page straight back in — Bar &
 * Bench titles its landing pages "Legal News: Live updates on Legal News from
 * Supreme Court, High Courts and Tribunals", and those were running as
 * headlines on the home page of a legal publication.
 *
 * Measured across the corpus this removes thirty of 848, every one a section
 * or boilerplate path, and no real article.
 */
function isRealArticle(article: NewsArticle): boolean {
  const path = article.canonicalUrl.split("?")[0].replace(/\/$/, "");
  const last = path.slice(path.lastIndexOf("/") + 1);
  return (last.match(/-/g) ?? []).length >= 3;
}

export async function listNews(limit?: number): Promise<NewsArticle[]> {
  const sorted = NEWS.filter(
    (a) => (a.language ?? "en") === "en" && isRealArticle(a),
  )
    .map((a) => ({
      ...a,
      title: decodeEntities(a.title),
      excerpt: a.excerpt ? decodeEntities(a.excerpt) : a.excerpt,
      summary: a.summary ? decodeEntities(a.summary) : a.summary,
    }))
    .sort(
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

import firmDetailsSnapshot from "@/data/firm_details.json";
import type { FirmDetails } from "@/lib/types";

const FIRM_DETAILS = firmDetailsSnapshot as { generatedAt: string; firms: FirmDetails[] };

function detailKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const DETAILS_BY_KEY = new Map<string, FirmDetails>(
  FIRM_DETAILS.firms.flatMap((firm) => [
    [detailKey(firm.slug), firm] as const,
    [detailKey(firm.name), firm] as const,
  ]),
);

/**
 * Detail records are keyed by the crawler's own slug, which is derived from the
 * firm's name and does not always match the directory slug the site routes on
 * ("bae-kim-lee" against "bae-kim-and-lee"). Matching on a punctuation-stripped
 * key covers both without maintaining a mapping table by hand.
 */
export async function getFirmDetails(
  slug: string,
  name?: string,
): Promise<FirmDetails | null> {
  return (
    DETAILS_BY_KEY.get(detailKey(slug)) ??
    (name ? DETAILS_BY_KEY.get(detailKey(name)) : undefined) ??
    null
  );
}

export async function getFirmDetailsMeta() {
  return {
    generatedAt: FIRM_DETAILS.generatedAt,
    total: FIRM_DETAILS.firms.length,
    withPhone: FIRM_DETAILS.firms.filter((f) => f.phones.length > 0).length,
    withHeadcount: FIRM_DETAILS.firms.filter((f) => f.headcount !== null).length,
  };
}

import firmAwardsSnapshot from "@/data/firm_awards.json";
import type { FirmAwards } from "@/lib/types";

const FIRM_AWARDS = firmAwardsSnapshot as {
  generatedAt: string;
  disclaimer: string;
  byPublisher: Record<string, number>;
  firms: FirmAwards[];
};

const AWARDS_BY_KEY = new Map<string, FirmAwards>(
  FIRM_AWARDS.firms.flatMap((firm) => [
    [detailKey(firm.slug), firm] as const,
    [detailKey(firm.name), firm] as const,
  ]),
);

export async function getFirmAwards(
  slug: string,
  name?: string,
): Promise<FirmAwards | null> {
  return (
    AWARDS_BY_KEY.get(detailKey(slug)) ??
    (name ? AWARDS_BY_KEY.get(detailKey(name)) : undefined) ??
    null
  );
}

export async function getAwardsMeta() {
  return {
    generatedAt: FIRM_AWARDS.generatedAt,
    disclaimer: FIRM_AWARDS.disclaimer,
    byPublisher: FIRM_AWARDS.byPublisher,
    firmCount: FIRM_AWARDS.firms.length,
  };
}

/* ------------------------------------------------------------------ *
 * Regional grouping
 *
 * 848 articles in one column is an archive, not a front page. A reader
 * covering Indian courts should not scroll past four hundred English
 * solicitor stories to reach them. Region comes from the article's
 * jurisdiction, which the collector records from the source registry, so no
 * article is placed by guesswork.
 * ------------------------------------------------------------------ */

export type NewsRegion = {
  slug: string;
  name: string;
  /** Plain-language line for the region index and its metadata. */
  blurb: string;
};

export const NEWS_REGIONS: NewsRegion[] = [
  { slug: "asia-pacific", name: "Asia-Pacific",
    blurb: "Courts, regulators and firms across Asia and the Pacific." },
  { slug: "europe", name: "Europe",
    blurb: "The English and European legal professions, their regulators and their courts." },
  { slug: "americas", name: "Americas",
    blurb: "North and South American practice, firms and litigation." },
  { slug: "africa-middle-east", name: "Africa & Middle East",
    blurb: "Legal markets across Africa and the Middle East." },
  { slug: "international", name: "International",
    blurb: "Coverage that belongs to no single jurisdiction." },
];

const REGION_SLUG: Record<string, string> = {
  "Asia-Pacific": "asia-pacific",
  Europe: "europe",
  Americas: "americas",
  "Africa & Middle East": "africa-middle-east",
};

// jurisdiction ISO numeric -> region slug, built from the directory so the two
// can never drift apart.
const REGION_BY_ISO = new Map<string, string>(
  RANKINGS.jurisdictions.map((j) => [
    j.isoNumeric,
    REGION_SLUG[j.region] ?? "international",
  ]),
);

export function regionOf(article: NewsArticle): string {
  const iso = article.jurisdictionIso;
  return (iso && REGION_BY_ISO.get(iso)) || "international";
}

export async function listNewsByRegion(
  slug: string,
  limit?: number,
): Promise<NewsArticle[]> {
  const all = await listNews();
  const filtered = all.filter((a) => regionOf(a) === slug);
  return limit ? filtered.slice(0, limit) : filtered;
}

export async function getRegionCounts(): Promise<
  { region: NewsRegion; count: number }[]
> {
  const all = await listNews();
  const counts = new Map<string, number>();
  for (const article of all) {
    const slug = regionOf(article);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return NEWS_REGIONS.map((region) => ({
    region,
    count: counts.get(region.slug) ?? 0,
  })).filter((r) => r.count > 0);
}

export function getRegionBySlug(slug: string): NewsRegion | null {
  return NEWS_REGIONS.find((r) => r.slug === slug) ?? null;
}

/**
 * Every firm in the directory, flattened. Used by the headline highlighter,
 * which needs the whole set in one list rather than nested by jurisdiction.
 */
export const ALL_FIRMS: { slug: string; name: string }[] =
  RANKINGS.jurisdictions.flatMap((j) =>
    (j.firms ?? []).map((f) => ({ slug: f.slug, name: f.name })),
  );

/* ------------------------------------------------------------------ *
 * Article importance and the front-page highlights
 * ------------------------------------------------------------------ */

import importanceSnapshot from "@/data/news_importance.json";

const IMPORTANCE = importanceSnapshot as {
  generatedAt: string;
  method: string;
  currencyNote: string;
  highlightIds: string[];
  scores: Record<string, number>;
  capitalUsd: Record<string, number>;
};

export type ScoredArticle = NewsArticle & {
  importance: number;
  capitalUsd: number | null;
};

function withScore(article: NewsArticle): ScoredArticle {
  return {
    ...article,
    importance: IMPORTANCE.scores[article.id] ?? 0,
    capitalUsd: IMPORTANCE.capitalUsd[article.id] ?? null,
  };
}

/**
 * The six stories the front page leads on, chosen by importance and then
 * spread across jurisdictions so one well-covered market cannot fill the page.
 * The selection is computed in the pipeline, not here, so the site renders the
 * same six the methodology describes.
 */
export async function listHighlights(): Promise<ScoredArticle[]> {
  const all = await listNews();
  const byId = new Map(all.map((a) => [a.id, a]));
  return IMPORTANCE.highlightIds
    .map((id) => byId.get(id))
    .filter((a): a is NewsArticle => Boolean(a))
    .map(withScore);
}

export async function getImportanceMeta() {
  return {
    generatedAt: IMPORTANCE.generatedAt,
    method: IMPORTANCE.method,
    currencyNote: IMPORTANCE.currencyNote,
    withCapital: Object.keys(IMPORTANCE.capitalUsd).length,
  };
}

/** Compact USD, so a reader compares magnitudes rather than counting zeros. */
export function formatUsd(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(value >= 1e10 ? 0 : 1)}bn`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(value >= 1e8 ? 0 : 1)}m`;
  return `$${Math.round(value / 1e3)}k`;
}

/* ------------------------------------------------------------------ *
 * Practice guides
 * ------------------------------------------------------------------ */

import guidesSnapshot from "@/data/practice_guides.json";

export type PracticeGuide = {
  title: string;
  url: string;
  year: number | null;
  firmSlug: string;
  firmName: string;
  jurisdiction: string;
};

const GUIDES = guidesSnapshot as {
  generatedAt: string;
  method: string;
  guides: PracticeGuide[];
};

function tidyGuideTitle(title: string): string {
  return decodeEntities(title)
    .replace(/^\d{4}\.\d{2}\.\d{2}\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Guides for a jurisdiction, newest first. Duplicates are deliberately kept:
 * where several firms publish a guide to the same market, that competition is
 * itself worth showing to a general counsel choosing between them.
 */
export async function listGuides(jurisdiction: string): Promise<PracticeGuide[]> {
  return GUIDES.guides
    .filter((g) => g.jurisdiction === jurisdiction)
    .map((g) => ({ ...g, title: tidyGuideTitle(g.title) }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export async function getGuideCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const g of GUIDES.guides) {
    counts[g.jurisdiction] = (counts[g.jurisdiction] ?? 0) + 1;
  }
  return counts;
}

/** Every guide, for surfaces that filter client-side (the coverage panel). */
export async function listAllGuides(): Promise<PracticeGuide[]> {
  return GUIDES.guides.map((g) => ({ ...g, title: tidyGuideTitle(g.title) }));
}
