import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { getJurisdictionBySlug, listCoveredJurisdictions } from "@/lib/data";
import { METHODOLOGY } from "@/lib/fixtures/methodology";
import { CONTACTS } from "@/lib/fixtures/commercial";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ jurisdiction: string }> };

export async function generateStaticParams() {
  const covered = await listCoveredJurisdictions();
  return covered.map((j) => ({ jurisdiction: j.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { jurisdiction } = await params;
  const entry = await getJurisdictionBySlug(jurisdiction);
  if (!entry) return { title: "Not found" };

  return {
    title: `Law firms in ${entry.name}`,
    description: `${entry.firmCount} law firms recorded in ${entry.name}, each traceable to its source. Ranking status: ${entry.status === "ranked" ? "published" : "withheld pending evidence"}.`,
  };
}

export default async function JurisdictionPage({ params }: Props) {
  const { jurisdiction } = await params;
  const entry = await getJurisdictionBySlug(jurisdiction);

  if (!entry || entry.firmCount === 0) notFound();

  const evidenceRows = METHODOLOGY.signals.map((signal) => ({
    label: signal.label,
    weight: signal.weight,
    count: entry.evidence[signal.key] ?? 0,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Law firms in ${entry.name}`,
          description:
            entry.status === "ranked"
              ? `Ranked law firms in ${entry.name}.`
              : `Law firms recorded in ${entry.name}, listed alphabetically. No ranking published; the order implies nothing.`,
          url: absoluteUrl(`/rankings/${entry.slug}`),
          numberOfItems: entry.firmCount,
          // Unordered is the literal truth while rankings are withheld, and it
          // stops a rich result presenting position 1 as "the best firm".
          itemListOrder:
            entry.status === "ranked"
              ? "https://schema.org/ItemListOrderDescending"
              : "https://schema.org/ItemListUnordered",
          itemListElement: entry.firms.map((firm, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "Organization",
              name: firm.name,
              url: absoluteUrl(`/firms/${firm.slug}`),
              ...(firm.foundedYear ? { foundingDate: String(firm.foundedYear) } : {}),
              address: {
                "@type": "PostalAddress",
                addressCountry: entry.isoAlpha2,
              },
            },
          })),
        }}
      />
      <EditorialShell
      kicker={`Jurisdiction · ${entry.isoAlpha2}${entry.g20 ? " · G20" : ""}`}
      headline={`Law firms in ${entry.name}`}
      standfirst={
        entry.status === "ranked"
          ? `Ranked against methodology version ${METHODOLOGY.version}.`
          : `${entry.firmCount} firms on file, listed alphabetically. No ranking is published for ${entry.name} yet — the evidence behind a score does not exist, and the order below implies nothing.`
      }
      rail={[
        { label: "Firms on file", value: String(entry.firmCount) },
        { label: "Region", value: entry.region },
        {
          label: "Evidence coverage",
          value: `${Math.round(entry.coverage * 100)}% of ${Math.round(entry.minCoverage * 100)}% needed`,
        },
        { label: "Press mentions", value: String(entry.pressMentions) },
      ]}
    >
      <div className="grid gap-16 py-14 lg:grid-cols-[1fr_280px] lg:gap-20">
        <div>
          <div className="flex items-baseline justify-between gap-6 border-b-2 border-ink pb-2">
            <h2 className="editorial text-2xl text-ink">
              {entry.status === "ranked" ? "Ranked firms" : "Firms on file"}
            </h2>
            <span className="label text-ink-faint">A–Z</span>
          </div>

          <table className="mt-4 w-full border-collapse">
            <thead>
              <tr className="border-b border-rule">
                <th className="label py-2 text-left text-ink-faint">Firm</th>
                <th className="label hidden py-2 text-right text-ink-faint sm:table-cell">
                  Founded
                </th>
                <th className="label py-2 text-right text-ink-faint">
                  {entry.status === "ranked" ? "Score" : "Press"}
                </th>
              </tr>
            </thead>
            <tbody>
              {entry.firms.map((firm) => (
                <tr
                  key={firm.slug}
                  className="border-b border-rule/70 transition-colors hover:bg-paper-sunken"
                >
                  <td className="py-4 align-baseline">
                    <Link
                      href={`/firms/${firm.slug}`}
                      className="editorial text-xl leading-tight text-ink link-underline"
                    >
                      {firm.name}
                    </Link>
                  </td>
                  <td className="figure hidden py-4 text-right align-baseline text-sm text-ink-muted sm:table-cell">
                    {firm.foundedYear ?? "—"}
                  </td>
                  <td className="figure py-4 text-right align-baseline text-base text-ink">
                    {entry.status === "ranked"
                      ? (firm.score ?? "—")
                      : firm.pressMentions || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="editorial measure mt-6 text-sm leading-relaxed text-ink-muted">
            Every firm above is a real entity with a source recorded against it.
            Inclusion is not an endorsement and the order is alphabetical.
            Founding years are shown only where a source states one.
          </p>
        </div>

        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <h2 className="label border-b-2 border-ink pb-2 text-ink">
            Evidence held
          </h2>

          <table className="mt-4 w-full border-collapse">
            <tbody>
              {evidenceRows.map((row) => (
                <tr key={row.label} className="border-b border-rule/60">
                  <td className="editorial py-3 pr-2 align-baseline text-sm leading-snug text-ink">
                    {row.label}
                    <span className="figure ml-1.5 text-xs text-ink-faint">
                      {Math.round(row.weight * 100)}%
                    </span>
                  </td>
                  <td className="figure py-3 text-right align-baseline text-sm text-ink">
                    {row.count || "none"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="editorial mt-5 text-sm leading-relaxed text-ink-muted">
            {entry.status === "ranked"
              ? "Coverage clears the threshold, so a ranking is published for this jurisdiction."
              : `Coverage is ${Math.round(entry.coverage * 100)}% against a ${Math.round(entry.minCoverage * 100)}% threshold. Until collectors for these signals run, this page is a directory and nothing more.`}
          </p>

          <Link
            href="/methodology"
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            Read the methodology
          </Link>

          <h2 className="label mt-12 border-b-2 border-ink pb-2 text-ink">
            Firms in this market
          </h2>
          <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
            Missing from this list, or listed with the wrong details? Claiming a
            profile and submitting evidence are both free, and neither buys a
            placement.
          </p>
          <a
            href={`mailto:${CONTACTS.submissions}?subject=${encodeURIComponent(`Submission — ${entry.name}`)}`}
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            Submit evidence
          </a>

          <h2 className="label mt-12 border-b-2 border-ink pb-2 text-ink">
            Elsewhere
          </h2>
          <Link
            href="/rankings"
            className="editorial mt-4 block text-sm text-ink-muted link-underline"
          >
            All covered jurisdictions
          </Link>
        </aside>
      </div>
      </EditorialShell>
    </>
  );
}
