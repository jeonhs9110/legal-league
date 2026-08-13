import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl, SITE } from "@/lib/site";
import { getRankingsMeta, listJurisdictionEntries } from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/rankings" },
  title: "Law Firm Directory by Jurisdiction",
  description:
    "Law firm listings across 35 jurisdictions in the G20, Asia and the major legal markets. Every entry records its source; rankings publish only on evidence.",
};

const REGION_ORDER = ["Asia-Pacific", "Europe", "Americas", "Africa & Middle East"];

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function RankingsIndexPage() {
  const [entries, meta] = await Promise.all([
    listJurisdictionEntries(),
    getRankingsMeta(),
  ]);

  const byRegion = REGION_ORDER.map((region) => ({
    region,
    entries: entries.filter((e) => e.region === region),
  })).filter((group) => group.entries.length > 0);

  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": absoluteUrl("/rankings#dataset"),
    name: "League of Legals law firm directory",
    description:
      "Law firms across 35 jurisdictions, each listing recording the source it " +
      "was read from. Rankings are a reconciliation of external directory " +
      "recognitions and are published only where two independent publishers agree.",
    url: absoluteUrl("/rankings"),
    creator: { "@id": absoluteUrl("/#organization") },
    publisher: { "@id": absoluteUrl("/#organization") },
    isAccessibleForFree: true,
    license: absoluteUrl("/methodology"),
    // Named so a machine reading this can state the method and its limits
    // rather than inferring either. That is the whole product.
    measurementTechnique:
      "Weighted reconciliation of tier vocabularies across Chambers, The Legal 500, " +
      "IFLR1000, asialaw, Benchmark Litigation, Law.asia, Asian Legal Business, " +
      "Managing IP, Lexology Index and Best Lawyers, taken from firms' own " +
      "announcements. Minimum two independent publishers.",
    variableMeasured: [
      { "@type": "PropertyValue", name: "Directory consensus", description: "Weighted mean of the best tier each publisher gave" },
      { "@type": "PropertyValue", name: "Publisher count", description: "Independent publishers recognising the firm" },
      { "@type": "PropertyValue", name: "Verified", description: "Whether the record was confirmed against the firm's own website" },
    ],
    spatialCoverage: entries.map((e) => ({ "@type": "Country", name: e.name })),
    dateModified: meta.generatedAt,
  };

  return (
    <>
      <JsonLd data={dataset} />
    <EditorialShell
      kicker="Coverage"
      headline="Every jurisdiction, and what we hold on it"
      standfirst="The G20 plus the major legal markets. Hong Kong, Macao and Taiwan are listed separately from mainland China: each has its own courts, bar and admission rules, and firms are ranked per legal system. Where the evidence does not yet support a ranking, this page says so rather than publishing one."
      illustration="/brand/rankings.webp"
      rail={[
        { label: "Jurisdictions", value: String(meta.jurisdictions) },
        { label: "Firms listed", value: String(meta.firms) },
        { label: "Rankings published", value: String(meta.published) },
        { label: "Built", value: formatStamp(meta.generatedAt) },
      ]}
    >
      <div className="py-14">
        {byRegion.map((group) => (
          <section key={group.region} className="mb-14 last:mb-0">
            <div className="flex items-baseline justify-between gap-6 border-b-2 border-ink pb-2">
              <h2 className="editorial text-2xl text-ink">{group.region}</h2>
              <span className="label text-ink-faint">
                {group.entries.length} jurisdictions
              </span>
            </div>

            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b border-rule">
                  <th className="label py-2 text-left text-ink-faint">
                    Jurisdiction
                  </th>
                  <th className="label hidden py-2 text-left text-ink-faint sm:table-cell">
                    Status
                  </th>
                  <th className="label py-2 text-right text-ink-faint">Firms</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => (
                  <tr
                    key={entry.isoNumeric}
                    className="border-b border-rule/70 transition-colors hover:bg-paper-sunken"
                  >
                    <td className="py-4 align-baseline">
                      {entry.firmCount > 0 ? (
                        <Link
                          href={`/rankings/${entry.slug}`}
                          className="editorial text-xl text-ink link-underline"
                        >
                          {entry.name}
                        </Link>
                      ) : (
                        <span className="editorial text-xl text-ink-faint">
                          {entry.name}
                        </span>
                      )}
                      <span className="label mt-1 block text-ink-faint">
                        {entry.isoAlpha2}
                        {entry.g20 ? " · G20" : ""}
                      </span>
                    </td>
                    <td className="hidden py-4 align-baseline sm:table-cell">
                      <span
                        className={`label ${
                          entry.status === "ranked"
                            ? "text-oxblood"
                            : "text-ink-faint"
                        }`}
                      >
                        {entry.status === "ranked"
                          ? "Ranking published"
                          : entry.firmCount > 0
                            ? "Directory only"
                            : "Not yet collected"}
                      </span>
                    </td>
                    <td className="figure py-4 text-right align-baseline text-base text-ink">
                      {entry.firmCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <div className="measure mt-12 border-l-2 border-oxblood pl-5">
          <p className="label text-oxblood">Why nothing is ranked yet</p>
          <p className="editorial mt-2 text-base leading-relaxed text-ink-muted">
            A ranking is published for a jurisdiction only once the evidence we
            hold accounts for at least {Math.round(meta.minCoverage * 100)} per
            cent of the methodology&apos;s weight. No directory-consensus,
            court-record or submission evidence has been collected yet, so every
            jurisdiction currently sits at zero and the tables list firms
            alphabetically with no order implied.
          </p>
          <p className="editorial mt-3 text-base leading-relaxed text-ink-muted">
            A score computed from none of its intended inputs is not an estimate,
            it is a fabrication with a decimal point attached. Publishing one
            against a real firm is the failure mode this directory exists to
            avoid.
          </p>
          <Link
            href="/methodology"
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            What the evidence has to be
          </Link>
        </div>
      </div>
    </EditorialShell>
    </>
  );
}
