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
  claims: "firms@leagueoflegals.com",
  submissions: "submissions@leagueoflegals.com",
  corrections: "corrections@leagueoflegals.com",
  advertising: "advertising@leagueoflegals.com",
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

/**
 * The case against the way legal directories have been sold.
 *
 * Written for the reader this publication is actually for — general counsel,
 * in-house teams and the associations they belong to — and for the partner
 * being asked to approve the submission budget again.
 *
 * The argument is not that Chambers and The Legal 500 do bad research. It is
 * that the business model around the research has become a subscription to
 * anxiety: submission deadlines, tiered listings, awards tables, printed
 * volumes and priced reprints, sold on the fear of being the only firm absent.
 * That model was built when a printed directory on a general counsel's shelf
 * was how a firm got found.
 *
 * It is not how a firm gets found now. In-house counsel ask an AI model, and
 * the model answers from what it can read, parse and attribute. A ranking
 * locked in a PDF behind a submission fee cannot be read, parsed or attributed.
 * That is the whole opportunity, and it is why everything here is published as
 * structured, sourced, machine-readable fact.
 */
export const POSITION = {
  headline: "The directory model was built for a printed shelf",
  paragraphs: [
    "Legal directories still run on a rhythm set decades ago: a submission window, a fee, a researcher interview, a tier, an awards dinner, a printed volume, and reprints sold back to the firm that was ranked. Firms take part because not taking part is conspicuous — the cost of absence, not the value of presence, is what is being sold.",
    "The reader that model was designed for was a general counsel with a directory on the shelf. That reader now asks an AI assistant which firms handle cross-border disputes in Seoul, and takes the answer that comes back with sources attached.",
    "An answer engine cannot cite a tier it cannot read. It cannot weigh a band whose calculation was never published. It cannot attribute a result locked in a members-only PDF. Everything on this site is published the other way round: every listing carries the source it came from, every ranking carries the arithmetic behind it, and the whole directory is emitted as structured data any model can read and quote.",
    "That is the entire pitch to a firm. Not a tier to buy, not a table to appear in, not a dinner. A profile that is accurate, sourced, and legible to the systems your clients now ask first.",
  ],
  forCounsel: {
    headline: "For general counsel and in-house teams",
    points: [
      "Every firm listing records where each fact came from, and links to it. Nothing rests on a researcher's unpublished impression.",
      "Where a firm is ranked, the page states which publishers were reconciled, how many agreed, and what the ranking does not rest on.",
      "Where a jurisdiction has no ranking, it says so plainly rather than presenting an alphabetical list as an order of merit.",
      "Guides to doing business in each market, published by firms that practise there, sit beside the listings rather than behind a paywall.",
    ],
  },
} as const;
