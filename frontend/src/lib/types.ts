/**
 * Domain types. These mirror the Postgres schema in
 * `backend/supabase/migrations/`, so when the data layer moves to Supabase the
 * generated types line up and the components do not change.
 */

export type Jurisdiction = {
  /** ISO 3166-1 numeric, zero-padded. Joins to the globe's Natural Earth ids. */
  isoNumeric: string;
  isoAlpha2: string;
  slug: string;
  name: string;
  region: string;
  g20: boolean;
};

export type DirectoryFirm = {
  slug: string;
  name: string;
  foundedYear: number | null;
  /** Where the entity record came from. Every firm carries its origin. */
  sourceUrl: string;
  sourceName: string;
  /** Times this firm was matched in the collected press. */
  pressMentions: number;
  /** Null until the jurisdiction has enough evidence to publish a ranking. */
  score: number | null;
  rank: number | null;
  band: string | null;
};

/** Evidence held per methodology signal, by count of records. */
export type EvidenceCounts = {
  directoryConsensus: number;
  courtRecord: number;
  submissions: number;
  peerReview: number;
};

export type JurisdictionEntry = Jurisdiction & {
  /** `ranked` once evidence coverage clears the threshold; else directory only. */
  status: "ranked" | "directory_only";
  /** Share of methodology weight backed by real evidence, 0–1. */
  coverage: number;
  minCoverage: number;
  evidence: EvidenceCounts;
  pressMentions: number;
  firmCount: number;
  firms: DirectoryFirm[];
};

export type RankingsSnapshot = {
  generatedAt: string;
  methodologyVersion: string;
  minCoverage: number;
  newsSnapshot: string | null;
  attribution: { source: string; license: string; note: string } | null;
  summary: {
    jurisdictions: number;
    withFirms: number;
    firms: number;
    published: number;
    directoryOnly: number;
  };
  jurisdictions: JurisdictionEntry[];
};

export type NewsArticle = {
  id: string;
  title: string;
  /** Short extract only. The published table has no body column by design. */
  excerpt: string | null;
  /**
   * Written in our own words, so it is a separate work rather than a copy.
   * Null until the LLM pass runs — which needs an API key, so the collector
   * leaves it empty rather than inventing one.
   */
  summary: string | null;
  author: string | null;
  publishedAt: string;
  sourceName: string;
  sourceSlug?: string;
  canonicalUrl: string;
  jurisdictionIso: string | null;
  language?: string;
  retrievedAt?: string;
  entities: { firmSlug: string; firmName: string; confidence: number }[];
};

export type NewsSnapshot = {
  generatedAt: string;
  sourceCount: number;
  articles: NewsArticle[];
};

/** Weighted signals behind a score. Keys match `methodologies.weights`. */
export type ScoreBreakdown = {
  directoryConsensus: number;
  courtRecord: number;
  submissions: number;
  peerReview: number;
};

export type MethodologySignal = {
  key: keyof ScoreBreakdown;
  label: string;
  weight: number;
  description: string;
  sourceTypes: string[];
};

export type Methodology = {
  version: string;
  title: string;
  effectiveFrom: string;
  signals: MethodologySignal[];
  exclusions: string[];
  changelog: { version: string; date: string; note: string }[];
};

/** A synthesized brief: several outlets' coverage of one event, in our words. */
export type Brief = {
  id: string;
  headline: string;
  standfirst: string;
  body: string;
  claims: { statement: string; source_indexes: number[] }[];
  sources: { name: string; title: string; url: string }[];
  generatedAt: string;
  model: string;
};

export type BriefsSnapshot = {
  generatedAt: string;
  archiveModel: string;
  currentModel: string;
  briefs: Brief[];
};
