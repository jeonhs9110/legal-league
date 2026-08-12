"use client";

import { useCallback, useMemo, useState } from "react";
import type { JurisdictionEntry } from "@/lib/types";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

type Props = {
  rankings: JurisdictionEntry[];
  coverage: { jurisdictions: number; withFirms: number; firms: number };
};

export function HeroShell({ rankings, coverage }: Props) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  const byIso = useMemo(
    () => new Map(rankings.map((r) => [r.isoNumeric, r])),
    [rankings],
  );

  const rankedIds = useMemo(
    () => rankings.map((r) => r.isoNumeric),
    [rankings],
  );

  const handleSelect = useCallback((iso: string | null) => {
    setSelectedIso(iso);
  }, []);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-16">
      <LeftPanel
        selectedId={selectedIso}
        onSelect={handleSelect}
        rankedIds={rankedIds}
        coverage={coverage}
      />
      <RightPanel
        entry={selectedIso ? (byIso.get(selectedIso) ?? null) : null}
        entries={rankings}
        onSelect={handleSelect}
      />
    </div>
  );
}
