"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Globe } from "@/components/globe/Globe";
import { FlatMap } from "@/components/globe/FlatMap";
import type { JurisdictionEntry } from "@/lib/types";

const FIRMS_SHOWN = 8;

type PracticeGuide = {
  title: string;
  url: string;
  year: number | null;
  firmSlug: string;
  firmName: string;
  jurisdiction: string;
};

type Props = {
  entries: JurisdictionEntry[];
  coverage: { jurisdictions: number; withFirms: number; firms: number };
  guides: PracticeGuide[];
  guideCounts: Record<string, number>;
};

/**
 * Replaces the two hero panels the homepage inherited from the landing-page
 * design. Those were built to fill a dark viewport and carried their own
 * navigation bar, their own logo and a pill-button toolbar; dropped into the
 * editorial page they rendered a second masthead, squeezed the globe to 179px
 * and set body copy about ten characters wide.
 *
 * This gives the globe a column of its own that grows with the viewport, and
 * puts the jurisdiction list beside it as a table rather than a card.
 */
export function CoverageSection({
  entries,
  coverage,
  guides,
  guideCounts,
}: Props) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const byIso = useMemo(
    () => new Map(entries.map((e) => [e.isoNumeric, e])),
    [entries],
  );
  const rankedIds = useMemo(
    () => entries.map((e) => e.isoNumeric),
    [entries],
  );
  const handleSelect = useCallback((iso: string | null) => {
    setSelectedIso(iso);
  }, []);

  const entry = selectedIso ? byIso.get(selectedIso) ?? null : null;

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
      <div className="flex flex-col items-center">
        <Globe
          selectedId={selectedIso}
          onSelect={handleSelect}
          rankedIds={rankedIds}
        />

        {/* The globe cannot serve Hong Kong, Singapore or Macao at any zoom.
            This can, and both drive the same selection. */}
        <div className="mt-8 w-full border-t border-rule pt-6">
          <FlatMap
            selectedId={selectedIso}
            onSelect={handleSelect}
            rankedIds={rankedIds}
          />
        </div>
      </div>

      <div className="lg:border-l lg:border-rule lg:pl-12">
        {entry ? (
          <div>
            <p className="label text-oxblood">
              Firms on file · {entry.isoAlpha2}
            </p>
            <h3 className="editorial mt-2 text-3xl text-ink lg:text-4xl">
              {entry.name}
            </h3>

            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 border-y border-rule py-4">
              <div>
                <dt className="label text-ink-faint">Firms Listed</dt>
                <dd className="rank-figure mt-1 text-2xl text-ink">
                  {entry.firmCount}
                </dd>
              </div>
              <div>
                <dt className="label text-ink-faint">Ranking</dt>
                <dd className="editorial mt-1 text-base text-ink">
                  {entry.status === "ranked" ? "Published" : "Not published"}
                </dd>
              </div>
            </dl>

            {entry.firms.length > 0 ? (
              <ul className="mt-5 divide-y divide-rule/70">
                {entry.firms.slice(0, FIRMS_SHOWN).map((firm) => (
                  <li key={firm.slug}>
                    <Link
                      href={`/firms/${firm.slug}`}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
                      <span className="editorial text-base text-ink link-underline">
                        {firm.name}
                      </span>
                      {firm.consensusDetail ? (
                        <span className="label shrink-0 text-oxblood">
                          Band {firm.band} · {firm.consensusDetail.publisherCount}{" "}
                          publishers
                        </span>
                      ) : firm.verified ? (
                        <span className="label shrink-0 text-ink-faint">Verified</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="editorial mt-5 text-sm leading-relaxed text-ink-muted">
                No firms are on file for {entry.name} yet.
              </p>
            )}

            {/* What a general counsel actually opens this page for: how to do
                business here, written by a firm that practises here. */}
            {guides.filter((g) => g.jurisdiction === entry.slug).length > 0 ? (
              <div className="mt-7 border-t border-rule pt-5">
                <h4 className="label text-ink">
                  Doing Business in {entry.name}
                </h4>
                <p className="editorial mt-1.5 text-xs leading-relaxed text-ink-faint">
                  Published by firms practising here. Where several publish a
                  guide, all are listed.
                </p>
                <ul className="mt-3 space-y-2.5">
                  {guides
                    .filter((g) => g.jurisdiction === entry.slug)
                    .slice(0, 4)
                    .map((guide) => (
                      <li key={guide.url}>
                        <a
                          href={guide.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="editorial block text-sm leading-snug text-ink link-underline"
                        >
                          {guide.title}
                        </a>
                        <span className="label mt-0.5 block text-ink-faint">
                          {guide.firmName}
                          {guide.year ? ` · ${guide.year}` : ""}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            {/* The method differs by jurisdiction, so it is stated here rather
                than left to a single site-wide claim. */}
            <div className="mt-7 border-t border-rule pt-5">
              <h4 className="label text-ink">How {entry.name} Is Ranked</h4>
              <p className="editorial mt-2 text-xs leading-relaxed text-ink-muted">
                {entry.methodology.basis}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href={`/rankings/${entry.slug}`}
                className="label text-oxblood link-underline"
              >
                {entry.firmCount > FIRMS_SHOWN
                  ? `All ${entry.firmCount} firms in ${entry.name}`
                  : `Open the ${entry.name} record`}
              </Link>
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="label text-ink-faint transition-colors hover:text-ink"
              >
                Clear selection
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="editorial text-2xl text-ink lg:text-3xl">
              Select a Jurisdiction
            </h3>
            <p className="editorial mt-3 text-sm leading-relaxed text-ink-muted">
              Rotate the globe and choose a marked jurisdiction, or pick one
              from the list. {coverage.withFirms} of {coverage.jurisdictions}{" "}
              have firms on file; none carries a published ranking yet.
            </p>

            <ul className="mt-6 grid grid-cols-2 gap-x-6 border-t border-rule pt-4 sm:grid-cols-3 lg:grid-cols-2">
              {entries.map((country) => (
                <li key={country.isoNumeric}>
                  <button
                    type="button"
                    onClick={() => handleSelect(country.isoNumeric)}
                    className="editorial flex w-full items-baseline justify-between gap-3 py-1.5 text-left text-sm text-ink transition-colors hover:text-oxblood"
                  >
                    <span className="truncate">{country.name}</span>
                    <span className="figure shrink-0 text-xs text-ink-faint">
                      {guideCounts[country.slug] ? "· guide " : ""}
                      {country.firmCount}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
