"use client";

import Link from "next/link";
import {
  ArrowRight,
  Gavel,
  Globe2,
  Instagram,
  Linkedin,
  Scale,
  Sparkles,
  Twitter,
} from "lucide-react";
import type { JurisdictionEntry } from "@/lib/types";

const SOCIALS = [
  { label: "Twitter", href: "#", Icon: Twitter },
  { label: "LinkedIn", href: "#", Icon: Linkedin },
  { label: "Instagram", href: "#", Icon: Instagram },
];

const METHOD_CARDS = [
  {
    title: "Signal Reconciliation",
    description: "AI matches the same firm across every public directory.",
    Icon: Scale,
    href: "/methodology",
  },
  {
    title: "Court Record",
    description: "Outcomes parsed from published judgments, not surveys.",
    Icon: Gavel,
    href: "/methodology",
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
        <div className="liquid-glass flex items-center gap-4 rounded-full px-5 py-2.5">
          {SOCIALS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              className="text-white transition-colors hover:text-white/80"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
          <ArrowRight className="h-4 w-4 text-white/60" />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="AI assist"
            className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="liquid-glass rounded-full px-5 py-2.5 text-sm text-white transition-transform hover:scale-105"
          >
            Account
          </button>
        </div>
      </div>

      {/* The big box: whatever jurisdiction the globe has selected. */}
      <div className="liquid-glass mt-8 flex-1 rounded-[2.5rem] p-6 lg:p-7">
        {entry ? (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-white/50">
                  Firms on file · {entry.isoAlpha2}
                </span>
                <h2 className="mt-2 text-3xl tracking-[-0.04em] text-white">
                  {entry.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="liquid-glass rounded-full px-4 py-2 text-xs text-white/80 transition-transform hover:scale-105"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="liquid-glass rounded-full px-3 py-1.5 text-[11px] text-white/70">
                {entry.firmCount} firms
              </span>
              <span className="liquid-glass rounded-full px-3 py-1.5 text-[11px] text-white/70">
                {entry.status === "ranked"
                  ? "Ranking published"
                  : "No ranking published"}
              </span>
            </div>

            <ul className="mt-6 space-y-2">
              {entry.firms.slice(0, FIRMS_SHOWN).map((firm) => (
                <li key={firm.slug}>
                  <Link
                    href={`/firms/${firm.slug}`}
                    className="liquid-glass flex items-center gap-4 rounded-2xl px-4 py-3 transition-transform hover:scale-[1.02]"
                  >
                    <span className="flex-1 text-sm text-white">{firm.name}</span>
                    <span className="text-xs tabular-nums text-white/40">
                      {firm.foundedYear ?? ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <Link
              href={`/rankings/${entry.slug}`}
              className="liquid-glass mt-5 flex items-center justify-between gap-3 rounded-full px-5 py-2.5 text-xs text-white/80 transition-transform hover:scale-105"
            >
              {entry.firmCount > FIRMS_SHOWN
                ? `All ${entry.firmCount} firms in ${entry.name}`
                : `Open the ${entry.name} record`}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <p className="mt-4 text-[11px] leading-relaxed text-white/40">
              Listed alphabetically. Inclusion is not an endorsement, and no
              ranking is published for this jurisdiction yet.
            </p>
          </>
        ) : (
          <div className="flex h-full flex-col justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Globe2 className="h-4 w-4 text-white" />
            </span>
            <h2 className="mt-5 text-2xl tracking-[-0.04em] text-white">
              Select a jurisdiction
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
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
                  className="liquid-glass rounded-full px-3.5 py-2 text-xs text-white/80 transition-transform hover:scale-105"
                >
                  {country.name}
                  <span className="ml-1.5 text-white/40">{country.firmCount}</span>
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
            className="liquid-glass flex-1 rounded-3xl p-5 transition-transform hover:scale-105"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Icon className="h-4 w-4 text-white" />
            </span>
            <h3 className="mt-4 text-sm text-white">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/60">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
