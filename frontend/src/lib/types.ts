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

/**
 * Reconciliation of what other publishers say about a firm. Not Legal League's
 * own assessment — see backend/pipelines/rankings/reconcile.py.
 */
export type ConsensusDetail = {
  consensus: number;
  publisherCount: number;
  publishers: string[];
  byPublisher: Record<string, number>;
  practiceAreas: string[];
  latestEdition: number | null;
  method: string;
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
  /** True when the record was confirmed against the firm's own website. */
  verified?: boolean;
  /** 0-1 reconciliation across publishers; null until two of them agree. */
  consensus?: number | null;
  consensusDetail?: ConsensusDetail | null;
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

/**
 * Fields read from a firm's own website by the directory crawler. Every one is
 * optional: a firm that does not publish its headcount is listed without one,
 * and `sources` records the page each value came from so a disputed figure can
 * be traced without asking us.
 */
export type FirmDetails = {
  slug: string;
  name: string;
  jurisdiction: string;
  website: string;
  emails: string[];
  phones: string[];
  practiceAreas: string[];
  headcount: number | null;
  headcountQuote: string | null;
  sources: Partial<Record<"emails" | "phones" | "headcount" | "practiceAreas", string>>;
  checkedAt: string;
};

/**
 * An external publisher's assessment, as the firm itself states it. Not a
 * Legal League ranking, and not taken from the publisher's own tables — the
 * quote and sourceUrl point at the firm's own announcement.
 */
export type Recognition = {
  publisher: string;
  tier: string | null;
  practiceAreas: string[];
  edition: number | null;
  quote: string;
  sourceUrl: string;
};

export type FirmAwards = {
  slug: string;
  name: string;
  jurisdiction: string;
  recognitions: Recognition[];
  checkedAt: string;
};
