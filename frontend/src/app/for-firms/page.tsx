import type { Metadata } from "next";
import Link from "next/link";
import { EditorialShell } from "@/components/editorial/EditorialShell";
import { FIRM_OFFERS, FIREWALL } from "@/lib/fixtures/commercial";
import { getRankingsMeta } from "@/lib/data";

export const metadata: Metadata = {
  alternates: { canonical: "/for-firms" },
  title: "For law firms — Legal League",
  description:
    "Claim your profile, submit evidence, or advertise. What each one does, what it costs, and the rules that keep commercial spend away from the rankings.",
};

export default async function ForFirmsPage() {
  const meta = await getRankingsMeta();

  return (
    <EditorialShell
      kicker="For law firms"
      headline="Work with us, without buying a placement"
      standfirst="Three ways for a firm to engage. Two are free and always will be. The third is advertising, and the rules below set out exactly what it can and cannot reach — because a directory that sells to the firms it ranks has one asset, and that asset is the belief that the two are separate."
      rail={[
        { label: "Firms on file", value: String(meta.firms) },
        { label: "Jurisdictions", value: String(meta.jurisdictions) },
        { label: "Method", value: `Version ${meta.methodologyVersion}` },
        { label: "Paid ranking factors", value: "None" },
      ]}
    >
      <section className="py-14">
        <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
          I. What you can do
        </h2>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {FIRM_OFFERS.map((offer) => (
            <article
              key={offer.key}
              className="flex flex-col border-t-2 border-ink pt-5"
            >
              <h3 className="editorial text-2xl leading-tight text-ink">
                {offer.name}
              </h3>
              <p className="label mt-2 text-oxblood">{offer.price}</p>

              <p className="editorial mt-4 text-sm leading-relaxed text-ink-muted">
                {offer.summary}
              </p>

              <ul className="mt-5 flex-1">
                {offer.includes.map((item) => (
                  <li
                    key={item}
                    className="editorial border-b border-rule/70 py-2.5 text-sm leading-snug text-ink-muted"
                  >
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href={`mailto:${offer.contact}?subject=${encodeURIComponent(offer.name)}`}
                className="label mt-5 inline-block text-oxblood link-underline"
              >
                {offer.contact}
              </a>
            </article>
          ))}
        </div>

        <p className="editorial measure mt-10 text-sm leading-relaxed text-ink-muted">
          Verification and submissions carry no charge at any volume. A firm that
          pays nothing can reach the top of a table; a firm that pays cannot buy
          its way up one.
        </p>
      </section>

      <section className="border-t border-rule py-14">
        <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
          II. The firewall
        </h2>

        <p className="editorial measure mt-6 text-base leading-relaxed text-ink-muted">
          These rules bind us. They are published here so that an advertiser
          knows what they are not buying, and a reader knows what a placement
          cannot mean.
        </p>

        <ol className="mt-8">
          {FIREWALL.map((clause, index) => (
            <li
              key={clause.rule}
              className="grid gap-2 border-b border-rule/70 py-6 sm:grid-cols-[3rem_1fr] sm:gap-6"
            >
              <span className="rank-figure text-xl text-oxblood">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="editorial text-xl leading-snug text-ink">
                  {clause.rule}
                </h3>
                <p className="editorial measure mt-2 text-sm leading-relaxed text-ink-muted">
                  {clause.detail}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-rule py-14">
        <h2 className="editorial border-b-2 border-ink pb-3 text-3xl text-ink">
          III. What we will not do
        </h2>

        <ul className="mt-6 space-y-4">
          {[
            "Sell a ranking position, a band, an award, or an editorial mention.",
            "Offer paid review, expedited assessment, or preferential research attention.",
            "Withhold a placement, favourable or otherwise, pending a commercial conversation.",
            "Charge for the right to correct a factual error about your firm.",
            "Publish a ranking derived from anything a firm can purchase.",
          ].map((item) => (
            <li
              key={item}
              className="editorial border-l-2 border-oxblood pl-5 text-base leading-relaxed text-ink-muted"
            >
              {item}
            </li>
          ))}
        </ul>

        <div className="measure mt-10 border-t border-rule pt-6">
          <p className="editorial text-base leading-relaxed text-ink-muted">
            The methodology sets out the four weighted signals and the exclusions
            that apply to every score. Advertising appears in neither, by
            construction.
          </p>
          <Link
            href="/methodology"
            className="label mt-4 inline-block text-oxblood link-underline"
          >
            Read the methodology
          </Link>
        </div>
      </section>
    </EditorialShell>
  );
}
