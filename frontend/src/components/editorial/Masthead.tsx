import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/site";

const NAV = [
  { href: "/rankings", label: "Rankings", i18n: "nav.rankings" },
  { href: "/news", label: "News", i18n: "nav.news" },
  { href: "/methodology", label: "Methodology", i18n: "nav.methodology" },
  { href: "/for-firms", label: "For firms", i18n: "nav.forFirms" },
];

/**
 * Newspaper masthead rather than an app nav bar: a thin standing-head rule
 * carrying edition metadata, the wordmark centred beneath it, then section
 * navigation on its own rule. The metadata strip is doing real work — it is the
 * first credibility signal a skeptical reader looks for.
 */
export function Masthead() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto w-full max-w-[1180px] px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4 border-b border-rule/70 py-2.5">
          {/* The publishing year, not the methodology version. "Edition 2026.2"
              read as a second edition of the paper; it was only ever the
              version of the scoring weights, which belongs on the methodology
              page and nowhere else. */}
          <span className="label text-ink-faint">Edition 2026–27</span>
          <span className="label hidden text-ink-faint sm:block">
            Methodology published in full
          </span>
          <Link
            href="/"
            className="label text-ink-muted transition-colors hover:text-oxblood"
          >
            The Globe ↗
          </Link>
        </div>

        <div className="flex flex-col items-center gap-1 py-7">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/monogram.webp"
              alt=""
              width={26}
              height={26}
              className="opacity-80"
            />
            <span className="editorial text-3xl tracking-[0.16em] text-ink lg:text-4xl">
              {SITE.name.toUpperCase()}
            </span>
          </Link>
          <p className="label text-ink-faint">{SITE.slogan}</p>
        </div>

        <nav className="flex items-center justify-center gap-8 border-t border-rule/70 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-i18n={item.i18n}
              className="label text-ink-muted transition-colors hover:text-oxblood"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
