import type { Methodology } from "@/lib/types";

/**
 * The scorer and the public methodology page read this same object. That is the
 * point: if the weights drift from what is published, the product's one claim
 * stops being true. In Postgres this becomes a row in `methodologies`, with
 * `weights` as jsonb.
 */
export const METHODOLOGY: Methodology = {
  version: "2026.1",
  title: "How Legal League ranks law firms",
  effectiveFrom: "2026-01-01",
  signals: [
    {
      key: "directoryConsensus",
      label: "Directory consensus",
      weight: 0.35,
      description:
        "Where existing directories agree, that agreement is evidence. Each placement is recorded as a dated, sourced observation — never a copy of the publisher's table — and firms are matched across directories by AI entity resolution. Disagreement between directories lowers the signal rather than averaging it away.",
      sourceTypes: ["Published directory rankings", "Awards and shortlists"],
    },
    {
      key: "courtRecord",
      label: "Court record",
      weight: 0.3,
      description:
        "Appearances and outcomes parsed from published judgments in official court sources. Weighted by forum seniority and matter complexity, not raw volume, so a high-turnover practice does not outrank a selective one. Commercial reporters' headnotes are excluded; only the judgment itself is read.",
      sourceTypes: ["Official court portals", "Bulk judgment data"],
    },
    {
      key: "submissions",
      label: "Verified submissions",
      weight: 0.2,
      description:
        "Matters and deals submitted by the firm, counted only where an independent trace exists — a filing, a registry entry, or a referee who responded. Unverifiable submissions score zero rather than being taken on trust.",
      sourceTypes: ["Firm submissions", "Corporate registries", "Referees"],
    },
    {
      key: "peerReview",
      label: "Peer and client review",
      weight: 0.15,
      description:
        "Structured responses from opposing counsel and in-house clients. Responses from a firm about itself, or from anyone with a disclosed commercial relationship to it, are discarded before scoring.",
      sourceTypes: ["Peer surveys", "Client interviews"],
    },
  ],
  exclusions: [
    "Advertising spend, sponsorship, or any commercial relationship with Legal League.",
    "Firm size and revenue on their own — scale is not quality.",
    "Submissions that no independent source corroborates.",
    "Survey responses from a party with an undisclosed interest in the outcome.",
    "Any signal a firm can buy, in any form.",
  ],
  changelog: [
    {
      version: "2026.1",
      date: "2026-01-01",
      note: "First published methodology. Four weighted signals, published exclusions, per-placement evidence trail.",
    },
  ],
};
