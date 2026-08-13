import { CoverageSection } from "@/components/coverage/CoverageSection";
import { HomeSections } from "@/components/home/HomeSections";
import { EditorialFooter } from "@/components/editorial/EditorialFooter";
import { Masthead } from "@/components/editorial/Masthead";
import {
  getCoverage,
  getNewsSnapshotMeta,
  listCoveredJurisdictions,
} from "@/lib/data";

export const revalidate = 600;

/**
 * The dateline is taken from the last collection run, not from the clock. A
 * front page that prints today's date while showing last week's reporting is
 * lying in a small way, and under ISR the clock would be stale anyway.
 */
function dateline(iso: string): string {
  return new Date(iso)
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export default async function Home() {
  const [rankings, coverage, news] = await Promise.all([
    listCoveredJurisdictions(),
    getCoverage(),
    getNewsSnapshotMeta(),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Masthead />

      {/* Nameplate. A publication announces itself in type, not in chrome. */}
      <header className="border-b-2 border-ink">
        <div className="mx-auto w-full max-w-[1180px] px-6 pb-8 pt-14 lg:px-10 lg:pt-20">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-rule pb-3">
            <span className="label text-ink-faint">{dateline(news.generatedAt)}</span>
            <span className="label text-ink-faint">leagueoflegals.com</span>
          </div>

          <h1 className="editorial mt-8 text-[13vw] font-normal leading-[0.86] tracking-[-0.02em] text-ink sm:text-[10vw] lg:text-[124px]">
            Legal League
          </h1>

          <div className="mt-7 flex flex-wrap items-baseline justify-between gap-x-10 gap-y-4 border-t border-rule pt-5">
            <p className="editorial text-lg italic leading-snug text-ink-muted lg:text-xl">
              A comprehensive legal media publication
            </p>
            <dl className="flex flex-wrap gap-x-9 gap-y-2">
              <div>
                <dd className="rank-figure text-2xl text-ink">{coverage.jurisdictions}</dd>
                <dt className="label mt-0.5 text-ink-faint">Jurisdictions</dt>
              </div>
              <div>
                <dd className="rank-figure text-2xl text-ink">{coverage.firms}</dd>
                <dt className="label mt-0.5 text-ink-faint">Firms listed</dt>
              </div>
              <div>
                <dd className="rank-figure text-2xl text-ink">{news.total}</dd>
                <dt className="label mt-0.5 text-ink-faint">Articles tracked</dt>
              </div>
            </dl>
          </div>
        </div>
      </header>

      {/* Coverage map. Framed as a section of the paper, not as a splash. */}
      <section className="border-b border-rule bg-paper-sunken">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-14 lg:px-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <h2 className="editorial text-3xl text-ink lg:text-4xl">
              Where we have coverage
            </h2>
            <span className="label text-ink-faint">
              {coverage.withFirms} of {coverage.jurisdictions} with firms listed
            </span>
          </div>

          <p className="editorial measure mt-5 text-base leading-relaxed text-ink-muted">
            Select a jurisdiction to see the firms on file for it. Marked
            jurisdictions have a directory listing; none carries a published
            ranking yet, and the listings are alphabetical rather than ordered.
          </p>

          <div className="mt-10">
            <CoverageSection entries={rankings} coverage={coverage} />
          </div>
        </div>
      </section>

      <HomeSections />
      <EditorialFooter />
    </div>
  );
}
