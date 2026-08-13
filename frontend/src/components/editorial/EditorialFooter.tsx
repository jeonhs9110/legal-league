import Link from "next/link";
import { RANKINGS_PUBLISHED, getNewsSnapshotMeta, getRankingsMeta } from "@/lib/data";

const LINKS = [
  { href: "/rankings", label: "Rankings" },
  { href: "/news", label: "News" },
  { href: "/methodology", label: "Methodology" },
  { href: "/for-firms", label: "For firms" },
  { href: "/", label: "The Globe" },
];

/**
 * Every timestamp is rendered in UTC with an explicit locale. A footer that
 * formats in the visitor's locale would print a different string on the server
 * than in the browser and fail hydration — the exact bug that bit this project
 * once already.
 */
function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export async function EditorialFooter() {
  const [news, rankings] = await Promise.all([
    getNewsSnapshotMeta(),
    getRankingsMeta(),
  ]);

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
              LEAGUE OF LEGALS
            </p>
            <p className="label mt-1.5 text-ink-faint">leagueoflegals.com</p>
            <dl className="mt-4 space-y-1">
              <div className="flex gap-2">
                <dt className="label text-ink-faint">News updated</dt>
                <dd className="figure text-[11px] text-ink-muted">
                  {stamp(news.generatedAt)} UTC
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="label text-ink-faint">Directory updated</dt>
                <dd className="figure text-[11px] text-ink-muted">
                  {stamp(rankings.generatedAt)} UTC
                </dd>
              </div>
            </dl>
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
