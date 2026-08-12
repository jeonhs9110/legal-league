import { Masthead } from "./Masthead";
import { EditorialFooter } from "./EditorialFooter";

type Props = {
  children: React.ReactNode;
  /** Kicker above the headline: section, jurisdiction, or date line. */
  kicker?: string;
  headline?: string;
  standfirst?: string;
  /** Credibility metadata: as-of date, method version, source counts. */
  rail?: { label: string; value: string }[];
};

export function EditorialShell({
  children,
  kicker,
  headline,
  standfirst,
  rail,
}: Props) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Masthead />

      <main className="mx-auto w-full max-w-[1180px] px-6 pb-24 lg:px-10">
        {headline ? (
          <div className="border-b border-rule py-12 lg:py-16">
            {kicker ? (
              <span className="label text-oxblood">{kicker}</span>
            ) : null}

            <h1 className="editorial mt-4 text-4xl leading-[1.08] tracking-[-0.015em] text-ink lg:text-6xl">
              {headline}
            </h1>

            {standfirst ? (
              <p className="editorial measure mt-6 text-lg leading-relaxed text-ink-muted lg:text-xl">
                {standfirst}
              </p>
            ) : null}

            {rail && rail.length > 0 ? (
              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-rule/70 pt-5">
                {rail.map((item) => (
                  <div key={item.label}>
                    <dt className="label text-ink-faint">{item.label}</dt>
                    <dd className="figure mt-1.5 text-sm text-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}

        {children}
      </main>

      <EditorialFooter />
    </div>
  );
}
