import Link from "next/link";
import { RANKINGS_PUBLISHED } from "@/lib/data";

const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/news", label: "News" },
  { href: "/methodology", label: "Methodology" },
  { href: "/for-firms", label: "For firms" },
  { href: "/", label: "The Globe" },
];

export function EditorialFooter() {
  return (
    <footer className="border-t border-rule bg-paper-sunken">
      <div className="mx-auto w-full max-w-[1180px] px-6 py-12 lg:px-10">
        {!RANKINGS_PUBLISHED ? (
          <div className="border-l-2 border-oxblood pl-5">
            <p className="label text-oxblood">No ranking is published yet</p>
            <p className="editorial measure mt-2 text-sm leading-relaxed text-ink-muted">
              Firms and news on this site are real and carry their sources. No ranking has been published: a score requires directory, court-record and submission evidence that has not been collected, and an unfounded number would be worse than none. Firm listings are alphabetical and imply no order.
            </p>
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-6 border-t border-rule pt-6">
          <div>
            <p className="editorial text-lg tracking-[0.14em] text-ink">
              LEGAL LEAGUE
            </p>
            <p className="label mt-1.5 text-ink-faint">legalleague.org</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-2">
            {LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="label text-ink-muted transition-colors hover:text-oxblood"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
