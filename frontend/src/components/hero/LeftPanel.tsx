"use client";

import Image from"next/image";
import Link from"next/link";
import { ArrowRight, Menu } from"lucide-react";
import { Globe } from"@/components/globe/Globe";

const PILLS = [
  { label:"Open Methodology", href:"/methodology" },
  { label:"Court-Record Evidence", href:"/methodology" },
  { label:"Industry News", href:"/news" },
];

type Props = {
 selectedId: string | null;
 onSelect: (iso: string | null) => void;
 rankedIds: string[];
 coverage: { jurisdictions: number; withFirms: number; firms: number };
};

export function LeftPanel({ selectedId, onSelect, rankedIds, coverage }: Props) {
 return (
    <div className="relative flex w-full flex-col lg:w-[52%]">
      {/* Frosted slab the whole left column sits on. */}
      <div className="border border-rule bg-paper pointer-events-none absolute inset-4 rounded-3xl lg:inset-6" />

      <div className="relative z-10 flex flex-1 flex-col px-8 py-10 lg:px-12 lg:py-12">
        <nav className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Legal League" width={32} height={32} priority />
            <span className="text-2xl font-semibold tracking-tighter text-ink">
 legal league
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
 href="/methodology"
 className="border border-rule bg-paper-sunken hidden rounded-full px-4 py-2 text-sm text-ink transition-transform hover:scale-105 sm:block"
            >
              Methodology
            </Link>
            <Link
 href="/rankings"
 className="border border-rule bg-paper-sunken flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink transition-transform hover:scale-105"
            >
              <Menu className="h-4 w-4" />
              Menu
            </Link>
          </div>
        </nav>

        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <h1 className="text-4xl tracking-[-0.05em] text-ink lg:text-5xl">
            Ranking the world&apos;s
            <br />
 law firms, <em className="font-serif text-ink-muted">in the open</em>
          </h1>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-muted">
            Every placement traces back to a public source: existing directory
 rankings, reconciled by AI, weighed against the court record.
          </p>

          <div className="mt-8 flex justify-center">
            <Globe
 selectedId={selectedId}
 onSelect={onSelect}
 rankedIds={rankedIds}
            />
          </div>

          <Link
 href="/rankings"
 className="border border-rule bg-paper mt-10 flex items-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm text-ink transition-transform hover:scale-105 active:scale-95"
          >
            Explore Rankings
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/10">
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {PILLS.map((pill) => (
              <Link
 key={pill.label}
 href={pill.href}
 className="border border-rule bg-paper-sunken rounded-full px-4 py-2 text-xs text-ink-muted transition-transform hover:scale-105"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="text-xs uppercase tracking-widest text-ink-faint">
            Coverage in preview
          </span>

          <p className="mt-4 text-2xl text-ink lg:text-3xl">
            <span className="font-display">{coverage.firms} firms, </span>
            <span className="font-serif italic text-ink-muted">{coverage.jurisdictions} jurisdictions.</span>
          </p>

          <div className="mt-6 flex w-full items-center justify-center gap-4">
            <span className="h-px w-16 bg-ink/10" />
            <span className="text-xs uppercase tracking-widest text-ink-muted">
              LegalLeague.org
            </span>
            <span className="h-px w-16 bg-ink/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
