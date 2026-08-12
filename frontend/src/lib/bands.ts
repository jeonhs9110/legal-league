/**
 * Band definitions.
 *
 * Documentation only for now. Bands are how this category communicates
 * standing — a reader who knows Chambers reads "Band 1" instantly, where a raw
 * score of 94 means nothing without context. The methodology page publishes
 * these thresholds so they are on the record before any firm is placed in one.
 *
 * Nothing applies them yet: `build_rankings.py` withholds scores until evidence
 * coverage clears its threshold, so no firm currently carries a band.
 */
export const BANDS = [
  { label: "Band 1", min: 90, note: "Consistent first choice across every signal." },
  { label: "Band 2", min: 84, note: "Strong across most signals, with a clear specialism." },
  { label: "Band 3", min: 0, note: "Recognised in the market for defined work." },
] as const;

export function bandFor(score: number): (typeof BANDS)[number] {
  return BANDS.find((band) => score >= band.min) ?? BANDS[BANDS.length - 1];
}
