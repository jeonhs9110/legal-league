import { Backdrop } from "@/components/hero/Backdrop";
import { HeroShell } from "@/components/hero/HeroShell";
import { HomeSections } from "@/components/home/HomeSections";
import { EditorialFooter } from "@/components/editorial/EditorialFooter";
import { getCoverage, listCoveredJurisdictions } from "@/lib/data";

export default async function Home() {
  const [rankings, coverage] = await Promise.all([
    listCoveredJurisdictions(),
    getCoverage(),
  ]);

  return (
    <>
      {/* Dark brand surface: full viewport, then the page continues into paper. */}
      <section className="relative min-h-screen overflow-hidden">
        <Backdrop />
        <HeroShell rankings={rankings} coverage={coverage} />

        {/* Tells the reader the page continues; without it the hero reads as
            the whole site. */}
        <span className="pointer-events-none absolute inset-x-0 bottom-3 z-20 hidden text-center text-[10px] uppercase tracking-[0.2em] text-white/35 lg:block">
          Scroll for coverage
        </span>
      </section>

      <HomeSections />
      <EditorialFooter />
    </>
  );
}
