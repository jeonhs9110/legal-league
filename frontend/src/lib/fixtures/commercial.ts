/**
 * Commercial policy, kept as data so the /for-firms page and the methodology
 * page render the same rules from one place.
 *
 * The firewall clauses are the product, not boilerplate. A directory that sells
 * to the firms it ranks has exactly one asset — the belief that the two are
 * separate — and the only way to hold that belief up is to write the separation
 * down before any money changes hands, then publish it where advertisers and
 * readers both see it.
 */

export const CONTACTS = {
  claims: "firms@legalleague.org",
  submissions: "submissions@legalleague.org",
  corrections: "corrections@legalleague.org",
  advertising: "advertising@legalleague.org",
};

export type FirmOffer = {
  key: string;
  name: string;
  price: string;
  summary: string;
  includes: string[];
  affectsRanking: false;
  contact: string;
};

export const FIRM_OFFERS: FirmOffer[] = [
  {
    key: "claim",
    name: "Claim your profile",
    price: "Free, always",
    summary:
      "Verify that you control the firm and take editorial ownership of the entity record: correct the founding year, add offices, practice areas, and the partners who lead them.",
    includes: [
      "Verified badge against the firm record",
      "Correct and extend the factual profile",
      "Add lawyers, practice areas and offices",
      "Right of reply on any placement",
    ],
    affectsRanking: false,
    contact: CONTACTS.claims,
  },
  {
    key: "submit",
    name: "Submit evidence",
    price: "Free, always",
    summary:
      "Send matters, deals and referees for the research cycle. Submissions are counted only where an independent trace exists — a filing, a registry entry, or a referee who responds.",
    includes: [
      "Matter and deal submissions per cycle",
      "Referee nominations",
      "Confidential matters accepted and never published",
      "Counted at 20% weight when corroborated",
    ],
    affectsRanking: false,
    contact: CONTACTS.submissions,
  },
  {
    key: "advertise",
    name: "Advertise",
    price: "Rate card on request",
    summary:
      "Reach in-house counsel and the legal press across the news feed and jurisdiction pages. Every placement is labelled, and none of it touches the ranking.",
    includes: [
      "Labelled placements in the news feed",
      "Jurisdiction and practice-area sponsorship",
      "Recruitment and lateral-hire listings",
      "Quarterly readership reporting",
    ],
    affectsRanking: false,
    contact: CONTACTS.advertising,
  },
];

export const FIREWALL = [
  {
    rule: "Advertising never affects placement",
    detail:
      "Commercial spend is not an input to any signal, and the scorer has no access to advertiser records. This is enforceable, not aspirational: the ranking is computed from the evidence tables alone and the calculation is published.",
  },
  {
    rule: "Advertisers see rankings when everyone else does",
    detail:
      "No pre-publication access, no embargoed preview, no opportunity to respond before a run goes live. A firm that buys advertising learns its placement from the website.",
  },
  {
    rule: "Commercial content is always labelled",
    detail:
      "Sponsored placements carry a visible label, are excluded from editorial feeds, and are never styled to resemble a ranking, an award, or a news item.",
  },
  {
    rule: "No advertising on the pages that rank the advertiser",
    detail:
      "A firm's own ranking table and profile carry no commercial placements, from that firm or its competitors. The appearance of influence is as damaging as influence.",
  },
  {
    rule: "Claiming a profile buys nothing",
    detail:
      "Verification and submissions are free and always will be. A firm that pays nothing can reach the top of a table; a firm that pays cannot buy its way up one.",
  },
  {
    rule: "Revenue is disclosed in aggregate",
    detail:
      "Each edition states what share of revenue came from firms that appear in that edition's rankings. Readers can judge the exposure for themselves.",
  },
];
