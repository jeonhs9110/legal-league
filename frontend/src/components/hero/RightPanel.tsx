"use client";

import Link from"next/link";
import {
  ArrowRight,
  Gavel,
  Globe2,
  Instagram,
  Linkedin,
  Scale,
  Sparkles,
  Twitter,
} from"lucide-react";
import type { JurisdictionEntry } from"@/lib/types";

const SOCIALS = [
  { label:"Twitter", href:"#", Icon: Twitter },
  { label:"LinkedIn", href:"#", Icon: Linkedin },
  { label:"Instagram", href:"#", Icon: Instagram },
];

const METHOD_CARDS = [
  {
 title:"Signal Reconciliation",
 description:"AI matches the same firm across every public directory.",
    Icon: Scale,
 href:"/methodology",
  },
  {
 title:"Court Record",
 description:"Outcomes parsed from published judgments, not surveys.",
    Icon: Gavel,
 href:"/methodology",
  },
];

const FIRMS_SHOWN = 6;

type Props = {
 entry: JurisdictionEntry | null;
 entries: JurisdictionEntry[];
 onSelect: (iso: string | null) => void;
};

export function RightPanel({ entry, entries, onSelect }: Props) {
 return (
    <div className="flex w-full flex-col px-8 py-10 lg:w-[48%] lg:px-12 lg:py-12">
      <div className="flex items-center justify-between">
        <div className="border border-rule bg-paper-sunken flex items-center gap-4 rounded-full px-5 py-2.5">
          {SOCIALS.map(({ label, href, Icon }) => (
            <a
 key={label}
 href={href}
 aria-label={label}
 className="text-ink transition-colors hover:text-ink-muted"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
          <ArrowRight className="h-4 w-4 text-ink-muted" />
        </div>

        <div className="flex items-center gap-2">
          <button
 type="button"
 aria-label="AI assist"
 className="border border-rule bg-paper-sunken flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform hover:scale-105"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
 type="button"
 className="border border-rule bg-paper-sunken rounded-full px-5 py-2.5 text-sm text-ink transition-transform hover:scale-105"
          >
            Account
          </button>
        </div>
      </div>

      {/* The big box: whatever jurisdiction the globe has selected. */}
      <div className="border border-rule bg-paper-sunken mt-8 flex-1 rounded-[2.5rem] p-6 lg:p-7">
        {entry ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-ink-faint">
                  Firms on file · {entry.isoAlpha2}
                </span>
                <h2 className="mt-2 text-3xl tracking-[-0.04em] text-ink">
                  {entry.name}
                </h2>
              </div>
              <button
 type="button"
 onClick={() => onSelect(null)}
 className="border border-rule bg-paper-sunken rounded-full px-4 py-2 text-xs text-ink-muted transition-transform hover:scale-105"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="border border-rule bg-paper-sunken rounded-full px-3 py-1.5 text-[11px] text-ink-muted">
                {entry.firmCount} firms
              </span>
              <span className="border border-rule bg-paper-sunken rounded-full px-3 py-1.5 text-[11px] text-ink-muted">
                {entry.status ==="ranked"
                  ?"Ranking published"
 :"No ranking published"}
              </span>
            </div>

            <ul className="mt-6 space-y-2">
              {entry.firms.slice(0, FIRMS_SHOWN).map((firm) => (
                <li key={firm.slug}>
                  <Link
 href={`/firms/${firm.slug}`}
 className="border border-rule bg-paper-sunken flex items-center gap-4 rounded-2xl px-4 py-3 transition-transform hover:scale-[1.02]"
                  >
                    <span className="flex-1 text-sm text-ink">{firm.name}</span>
                    <span className="text-xs tabular-nums text-ink-faint">
                      {firm.foundedYear ??""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
 href={`/rankings/${entry.slug}`}
 className="border border-rule bg-paper-sunken mt-5 flex items-center justify-between gap-3 rounded-full px-5 py-2.5 text-xs text-ink-muted transition-transform hover:scale-105"
            >
              {entry.firmCount > FIRMS_SHOWN
                ? `All ${entry.firmCount} firms in ${entry.name}`
 : `Open the ${entry.name} record`}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
              Listed alphabetically. Inclusion is not an endorsement, and no
 ranking is published for this jurisdiction yet.
            </p>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06]">
              <Globe2 className="h-4 w-4 text-ink" />
            </span>
            <h2 className="mt-5 text-2xl tracking-[-0.04em] text-ink">
              Select a jurisdiction
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
              Rotate the globe and choose a highlighted jurisdiction to see the
 firms on file, the evidence held, and whether a ranking has been
 published.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {entries.map((country) => (
                <button
 key={country.isoNumeric}
 type="button"
 onClick={() => onSelect(country.isoNumeric)}
 className="border border-rule bg-paper-sunken rounded-full px-3.5 py-2 text-xs text-ink-muted transition-transform hover:scale-105"
                >
                  {country.name}
                  <span className="ml-1.5 text-ink-faint">{country.firmCount}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div id="methodology" className="mt-4 flex gap-4">
        {METHOD_CARDS.map(({ title, description, Icon, href }) => (
          <Link
 key={title}
 href={href}
 className="border border-rule bg-paper-sunken flex-1 rounded-3xl p-5 transition-transform hover:scale-105"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.06]">
              <Icon className="h-4 w-4 text-ink" />
            </span>
            <h3 className="mt-4 text-sm text-ink">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
