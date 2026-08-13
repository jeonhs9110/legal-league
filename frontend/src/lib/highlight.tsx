import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ALL_FIRMS } from "@/lib/data";

/**
 * Bolds and links firm names where they appear in a headline or extract.
 *
 * A legal reader scans a feed for the firms they care about, so the firm name
 * is the thing that should carry weight — not the outlet, not the date.
 *
 * The matching is deliberately timid, because the failure mode is not a
 * cosmetic one. Attaching the wrong firm to a story about a fraud trial is a
 * defamation vector, and it is the kind of error nobody reports and everybody
 * remembers. So:
 *
 *   * A name must be at least eight characters and contain a space. "Lin",
 *     "Gall" and "Racine" are real firms and also ordinary words; single-token
 *     names are never matched in running text.
 *   * Matching is on word boundaries, longest name first, so "Bae, Kim & Lee"
 *     wins over "Kim" and a matched span is never re-matched.
 *   * Punctuation and case are normalised, so "Kim & Chang" still matches
 *     "Kim and Chang" and "KIM & CHANG".
 */

const AMPERSAND = /\s*(?:&|and)\s*/gi;
const PUNCT = /[.,'’"()]/g;

/**
 * Single-word firm names safe to match in running text.
 *
 * Curated by hand rather than derived, because no heuristic separates
 * "Trilegal" from "Matheson". Both are eight letters and one word; the first
 * is a coinage that means nothing else, the second is a surname that will turn
 * up in judgments about people who are not the Irish firm. Linking a story
 * about a Judge Matheson to a law firm is the exact failure this module exists
 * to prevent, so a name joins this list only if it has no ordinary use.
 *
 * Deliberately absent: Matheson, Luther, Noerr, Delphi, Vinge, Racine, Gall,
 * Stibbe, Skrine, Bomchil, Aelex — all real firms, all also surnames or words.
 */
const DISTINCTIVE_SINGLE_WORD = new Set([
  "trilegal", "linklaters", "freshfields", "macfarlanes", "skadden",
  "milbank", "wongpartnership", "ensafrica", "tozzinifreire", "bonellierede",
  "nautadutilh", "cuatrecasas", "garrigues", "chiomenti", "legance",
  "wachtell", "cravath", "debevoise", "wilmerhale", "mishcon", "bristows",
  "azb", "khaitan", "induslaw", "nishimura", "yulchon", "jipyong",
  "allbright", "junhe", "fangda", "hankun", "zhonglun", "haiwen",
  "hengeler", "homburger", "pestalozzi", "houthoff", "stikeman", "torys",
  "goodmans", "fasken", "allens", "minterellison", "corrs", "bowmans",
  "werksmans", "accralaw", "romulo", "tilleke", "weerawong", "assegaf",
  "makarim", "ykvn", "vilaf", "paksoy", "marval", "bruchou", "galicia",
  "demarest", "lefosse",
]);

type Candidate = { slug: string; name: string; pattern: RegExp };

function toPattern(name: string): RegExp | null {
  const cleaned = name.replace(PUNCT, "").trim();
  const single = !cleaned.includes(" ");
  if (single) {
    if (!DISTINCTIVE_SINGLE_WORD.has(cleaned.toLowerCase())) return null;
  } else if (cleaned.length < 8) {
    return null;
  }

  // "Kim & Chang" and "Kim and Chang" are the same firm to a reader and should
  // be the same firm to us.
  const escaped = cleaned
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(AMPERSAND, "\\s*(?:&|and)\\s*")
    .replace(/\s+/g, "\\s+");

  try {
    return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i");
  } catch {
    return null;
  }
}

// Longest first: a firm whose name contains another firm's name must win.
const CANDIDATES: Candidate[] = ALL_FIRMS.map((firm) => ({
  slug: firm.slug,
  name: firm.name,
  pattern: toPattern(firm.name) as RegExp,
}))
  .filter((c) => c.pattern)
  .sort((a, b) => b.name.length - a.name.length);

/**
 * Returns the text with firm names wrapped. `link` is off inside headlines
 * that are already a link, because an anchor inside an anchor is invalid HTML
 * and browsers resolve it by dropping one at random.
 */
export function highlightFirms(text: string, link = true): ReactNode {
  if (!text) return text;

  type Hit = { start: number; end: number; slug: string };
  const hits: Hit[] = [];

  for (const candidate of CANDIDATES) {
    const match = candidate.pattern.exec(text);
    if (!match || match.index === undefined) continue;
    const start = match.index;
    const end = start + match[0].length;
    // Never overlap an already-claimed span.
    if (hits.some((h) => start < h.end && end > h.start)) continue;
    hits.push({ start, end, slug: candidate.slug });
  }

  if (hits.length === 0) return text;
  hits.sort((a, b) => a.start - b.start);

  const out: ReactNode[] = [];
  let cursor = 0;
  hits.forEach((hit, index) => {
    if (hit.start > cursor) out.push(text.slice(cursor, hit.start));
    const label = text.slice(hit.start, hit.end);
    out.push(
      link ? (
        <Link
          key={`${hit.slug}-${index}`}
          href={`/firms/${hit.slug}`}
          className="font-semibold text-ink link-underline"
        >
          {label}
        </Link>
      ) : (
        <strong key={`${hit.slug}-${index}`} className="font-semibold">
          {label}
        </strong>
      ),
    );
    cursor = hit.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));

  return (
    <>
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  );
}
