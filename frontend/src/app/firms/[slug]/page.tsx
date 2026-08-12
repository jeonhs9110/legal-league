import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import {
  getFirmBySlug,
  getFirmPeers,
  getJurisdictionBySlug,
  listFirms,
} from "@/lib/data";
import { CONTACTS } from "@/lib/fixtures/commercial";
import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const firms = await listFirms();
  return firms.map((firm) => ({ slug: firm.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);
  if (!firm) return { title: "Not found — Legal League" };

  return {
    title: `${firm.name} — ${firm.jurisdiction.name} — Legal League`,
    description: `${firm.name}, a law firm recorded in ${firm.jurisdiction.name}. Entity record with source; no ranking published.`,
  };
}

export default async function FirmPage({ params }: Props) {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);

  if (!firm) notFound();

  const [peers, entry] = await Promise.all([
    getFirmPeers(firm),
    getJurisdictionBySlug(firm.jurisdiction.slug),
  ]);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: firm.name,
          url: absoluteUrl(`/firms/${firm.slug}`),
          ...(firm.foundedYear ? { foundingDate: String(firm.foundedYear) } : {}),
          address: {
            "@type": "PostalAddress",
            addressCountry: firm.jurisdiction.isoAlpha2,
          },
          // Points at the record's origin rather than asserting authorship of
          // the fact, which is what it actually is.
          subjectOf: {
            "@type": "WebPage",
            url: firm.sourceUrl,
            name: firm.sourceName,
          },
          // Deliberately no aggregateRating, ratingValue, or award: this firm
          // is not ranked, and emitting a rating property would manufacture a
          // rich-result star that nothing on the page supports.
        }}
      />
      <EditorialShell
      kicker={`${firm.jurisdiction.name}${firm.jurisdiction.g20 ? " · G20" : ""}`}
      headline={firm.name}
      standfirst={
        firm.score !== null
          ? undefined
          : `Entity record. ${firm.name} is listed in the ${firm.jurisdiction.name} directory; no ranking or score has been published for this jurisdiction yet.`
      }
      rail={[
        { label: "Jurisdiction", value: firm.jurisdiction.name },
        { label: "Founded", value: firm.foundedYear ? String(firm.foundedYear) : "Not recorded" },
        { label: "Score", value: firm.score !== null ? String(firm.score) : "Not published" },
        { label: "Press mentions", value: String(firm.pressMentions) },
      ]}
    >
      <div className="grid gap-16 py-14 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div>
          <section>
            <h2 className="label border-b-2 border-ink pb-2 text-ink">
              Record
            </h2>

            <table className="mt-2 w-full border-collapse">
              <tbody>
                <tr className="border-b border-rule/70">
                  <td className="label py-4 align-baseline text-ink-faint">
                    Jurisdiction
                  </td>
                  <td className="editorial py-4 text-right align-baseline text-base text-ink">
                    <Link
                      href={`/rankings/${firm.jurisdiction.slug}`}
                      className="link-underline"
                    >
                      {firm.jurisdiction.name}
                    </Link>
                  </td>
                </tr>
                <tr className="border-b border-rule/70">
                  <td className="label py-4 align-baseline text-ink-faint">
                    Founded
                  </td>
                  <td className="figure py-4 text-right align-baseline text-base text-ink">
                    {firm.foundedYear ?? "Not recorded"}
                  </td>
                </tr>
                <tr className="border-b border-rule/70">
                  <td className="label py-4 align-baseline text-ink-faint">
                    Region
                  </td>
                  <td className="editorial py-4 text-right align-baseline text-base text-ink">
                    {firm.jurisdiction.region}
                  </td>
                </tr>
                <tr className="border-b border-rule/70">
                  <td className="label py-4 align-baseline text-ink-faint">
                    Entity source
                  </td>
                  <td className="py-4 text-right align-baseline">
                    <a
                      href={firm.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="editorial inline-flex items-center gap-2 text-base text-ink link-underline"
                    >
                      {firm.sourceName}
                      <ExternalLink className="h-3.5 w-3.5 text-ink-faint" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="editorial measure mt-6 text-sm leading-relaxed text-ink-muted">
              This is an entity record, not an assessment. It states that the
              firm exists and practises in this jurisdiction, and points at where
              that came from. Nothing on this page ranks, rates, or compares it
              to another firm.
            </p>
          </section>

          {peers.length > 0 ? (
            <section className="mt-14">
              <h2 className="label border-b-2 border-ink pb-2 text-ink">
                Also on file in {firm.jurisdiction.name}
              </h2>

              <ul className="mt-2 columns-1 sm:columns-2">
                {peers.map((peer) => (
                  <li
                    key={peer.slug}
                    className="break-inside-avoid border-b border-rule/70 py-3"
                  >
                    <Link
                      href={`/firms/${peer.slug}`}
                      className="editorial text-base text-ink link-underline"
                    >
                      {peer.name}
                    </Link>
                    {peer.foundedYear ? (
                      <span className="figure ml-2 text-xs text-ink-faint">
                        {peer.foundedYear}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:border-l lg:border-rule lg:pl-8">
          <h2 className="label border-b-2 border-ink pb-2 text-ink">
            Ranking status
          </h2>
          <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
            {entry && entry.status === "ranked"
              ? "A ranking is published for this jurisdiction."
              : `No ranking is published for ${firm.jurisdiction.name}. Evidence coverage stands at ${Math.round((entry?.coverage ?? 0) * 100)}% against a ${Math.round((entry?.minCoverage ?? 0.5) * 100)}% threshold, so no score is shown here rather than an unfounded one.`}
          </p>

          <Link
            href="/methodology"
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            How scoring will work
          </Link>

          <h2 className="label mt-12 border-b-2 border-ink pb-2 text-ink">
            Is this your firm?
          </h2>
          <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
            Claim the profile to correct the record, add offices, practice areas
            and partners, and hold a right of reply on any placement. Free, and
            it buys no advantage in any ranking.
          </p>
          <a
            href={`mailto:${CONTACTS.claims}?subject=${encodeURIComponent(`Profile claim — ${firm.name}`)}&body=${encodeURIComponent(`Firm: ${firm.name}\nJurisdiction: ${firm.jurisdiction.name}\nProfile: https://legalleague.org/firms/${firm.slug}\n\nPlease describe your role at the firm so we can verify the claim.`)}`}
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            Claim this profile
          </a>

          <h2 className="label mt-12 border-b-2 border-ink pb-2 text-ink">
            Corrections
          </h2>
          <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
            Anyone may request correction of a factual error or removal of this
            record. Every entry carries the source it came from, and disputes are
            answered from that record.
          </p>
          <a
            href={`mailto:${CONTACTS.corrections}?subject=${encodeURIComponent(`Correction — ${firm.name}`)}`}
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            Request a correction
          </a>
        </aside>
      </div>
      </EditorialShell>
    </>
  );
}
