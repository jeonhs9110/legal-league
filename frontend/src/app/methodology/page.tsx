import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { getMethodology } from "@/lib/data";
import { BANDS } from "@/lib/bands";

export const metadata: Metadata = {
  alternates: { canonical: "/methodology" },
  title: "Ranking methodology",
  description:
    "How Legal League assesses law firms: the signals, their weights, and the evidence a jurisdiction must hold before any ranking is published.",
};

export default async function MethodologyPage() {
  const methodology = await getMethodology();

  return (
    <EditorialShell
      kicker={`Methodology · version ${methodology.version}`}
      headline={methodology.title}
      standfirst="Directories that withhold their method ask you to trust the result. This is the whole calculation: four weighted signals, what feeds each one, what is excluded outright, and how a placement can be disputed. The scorer reads the same definition this page renders, so the two cannot drift apart."
      illustration="/brand/method.webp"
      rail={[
        { label: "Version", value: methodology.version },
        { label: "Effective from", value: methodology.effectiveFrom },
        { label: "Signals", value: String(methodology.signals.length) },
        { label: "Exclusions", value: String(methodology.exclusions.length) },
      ]}
    >
      <div className="grid gap-16 py-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-20">
        <div>
          <section>
            <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
              I. Weighted signals
            </h2>

            <table className="mt-6 w-full border-collapse">
              <thead>
                <tr className="border-b border-rule">
                  <th className="label py-2 text-left text-ink-faint">Signal</th>
                  <th className="label py-2 text-right text-ink-faint">Weight</th>
                </tr>
              </thead>
              <tbody>
                {methodology.signals.map((signal) => (
                  <tr key={signal.key} className="border-b border-rule/60">
                    <td className="editorial py-2.5 text-base text-ink">
                      {signal.label}
                    </td>
                    <td className="figure py-2.5 text-right text-base text-ink">
                      {Math.round(signal.weight * 100)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink">
                  <td className="label py-2.5 text-ink">Total</td>
                  <td className="figure py-2.5 text-right text-base text-ink">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-12 space-y-12">
              {methodology.signals.map((signal, index) => (
                <article key={signal.key}>
                  <div className="flex items-baseline gap-4">
                    <span className="rank-figure text-2xl text-oxblood">
                      {index + 1}
                    </span>
                    <h3 className="editorial text-2xl text-ink">
                      {signal.label}
                      <span className="figure ml-3 text-base text-ink-faint">
                        {Math.round(signal.weight * 100)}%
                      </span>
                    </h3>
                  </div>

                  <p className="editorial measure mt-4 text-base leading-relaxed text-ink-muted">
                    {signal.description}
                  </p>

                  <p className="label mt-4 text-ink-faint">
                    Sources · {signal.sourceTypes.join(" · ")}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
              II. Excluded from every score
            </h2>

            <ol className="mt-6">
              {methodology.exclusions.map((exclusion, index) => (
                <li
                  key={exclusion}
                  className="flex gap-5 border-b border-rule/70 py-4"
                >
                  <span className="rank-figure text-base text-oxblood">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="editorial text-base leading-relaxed text-ink-muted">
                    {exclusion}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-20">
            <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
              III. Bands
            </h2>

            <table className="mt-6 w-full border-collapse">
              <thead>
                <tr className="border-b border-rule">
                  <th className="label py-2 text-left text-ink-faint">Band</th>
                  <th className="label py-2 text-left text-ink-faint">
                    Composite
                  </th>
                  <th className="label hidden py-2 text-left text-ink-faint sm:table-cell">
                    Meaning
                  </th>
                </tr>
              </thead>
              <tbody>
                {BANDS.map((band) => (
                  <tr key={band.label} className="border-b border-rule/60">
                    <td className="editorial py-3 text-base text-ink">
                      {band.label}
                    </td>
                    <td className="figure py-3 text-sm text-ink-muted">
                      {band.min > 0 ? `${band.min} and above` : "Below 84"}
                    </td>
                    <td className="editorial hidden py-3 text-sm text-ink-muted sm:table-cell">
                      {band.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-20">
            <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
              IV. Revision and dispute
            </h2>

            <p className="editorial measure mt-6 text-base leading-relaxed text-ink-muted">
              Published rankings are never edited in place. A change to this
              methodology produces a new version and a new ranking run; earlier
              runs stay readable, so any past placement can be reproduced from
              its inputs. Every placement carries an evidence trail linking it to
              the specific observations, judgments, and verified submissions that
              produced it.
            </p>

            <p className="editorial measure mt-4 text-base leading-relaxed text-ink-muted">
              A firm that disputes a placement, or an individual who wishes to
              correct or remove personal information, may write to us. Disputes
              are answered from the evidence trail rather than from editorial
              judgment.
            </p>

            <h3 className="label mt-10 text-ink">Version history</h3>
            <table className="mt-3 w-full border-collapse">
              <tbody>
                {methodology.changelog.map((entry) => (
                  <tr key={entry.version} className="border-b border-rule/70">
                    <td className="figure w-24 py-3 align-baseline text-sm text-ink">
                      {entry.version}
                    </td>
                    <td className="figure w-32 py-3 align-baseline text-sm text-ink-faint">
                      {entry.date}
                    </td>
                    <td className="editorial py-3 align-baseline text-sm text-ink-muted">
                      {entry.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <h2 className="label border-b-2 border-ink pb-2 text-ink">
            Why this is public
          </h2>
          <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
            A ranking nobody can check is an opinion with a number attached.
            Publishing the weights, the exclusions, and the evidence behind each
            placement is what separates a directory of record from a marketing
            exercise.
          </p>

          <h2 className="label mt-12 border-b-2 border-ink pb-2 text-ink">
            See it applied
          </h2>
          <ul className="mt-4 space-y-2">
            <li>
              <Link
                href="/rankings"
                className="editorial text-sm text-ink link-underline"
              >
                Rankings by jurisdiction
              </Link>
            </li>
            <li>
              <Link
                href="/firms/cyril-amarchand-mangaldas"
                className="editorial text-sm text-ink link-underline"
              >
                A worked example profile — Cyril Amarchand Mangaldas
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </EditorialShell>
  );
}
