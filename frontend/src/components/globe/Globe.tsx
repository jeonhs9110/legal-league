"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  geoContains,
  geoCentroid,
  geoGraticule10,
  geoOrthographic,
  geoPath,
} from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";

type CountryProps = { name: string };
type Country = Feature<Geometry, CountryProps> & { id: string };

const SENSITIVITY = 0.25;
const SPIN_PER_MS = 0.006;

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null, name: string | null) => void;
  /** ISO 3166-1 numeric ids that have a published ranking. */
  rankedIds: string[];
};

export function Globe({ selectedId, onSelect, rankedIds }: Props) {
  const ranked = useMemo(() => new Set(rankedIds), [rankedIds]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [countries, setCountries] = useState<Country[] | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Mutable render state — deliberately kept out of React so the animation
  // loop never triggers a re-render.
  const rotation = useRef<[number, number]>([-10, -15]);
  const target = useRef<[number, number] | null>(null);
  const dragging = useRef(false);
  const lastPointer = useRef<[number, number] | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);

  selectedRef.current = selectedId;
  hoveredRef.current = hoveredId;

  useEffect(() => {
    let cancelled = false;
    fetch("/data/countries-50m.json")
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const fc = feature(
          topo,
          topo.objects.countries,
        ) as unknown as FeatureCollection<Geometry, CountryProps>;
        setCountries(fc.features as Country[]);
      })
      .catch(() => {
        /* Globe stays empty; the country list remains usable. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Swing the selected country into view, wherever the selection came from.
  useEffect(() => {
    if (!selectedId || !countries) {
      target.current = null;
      return;
    }
    const match = countries.find((c) => c.id === selectedId);
    if (!match) return;
    const [lon, lat] = geoCentroid(match);
    target.current = [-lon, -lat];
  }, [selectedId, countries]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let size = 0;
    const projection = geoOrthographic().precision(0.4);
    const path = geoPath(projection, ctx);
    const graticule = geoGraticule10();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = wrap.clientWidth;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      projection.fitExtent(
        [
          [2, 2],
          [size - 2, size - 2],
        ],
        { type: "Sphere" },
      );
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);

    let frame = 0;
    let previous = performance.now();

    const draw = (now: number) => {
      const elapsed = now - previous;
      previous = now;

      if (target.current) {
        // Ease toward the selected country, then hold there.
        const [tx, ty] = target.current;
        const [rx, ry] = rotation.current;
        let dx = tx - rx;
        while (dx > 180) dx -= 360;
        while (dx < -180) dx += 360;
        const next: [number, number] = [rx + dx * 0.08, ry + (ty - ry) * 0.08];
        rotation.current = next;
        if (Math.abs(dx) < 0.15 && Math.abs(ty - ry) < 0.15) {
          rotation.current = [tx, ty];
          target.current = null;
        }
      } else if (!dragging.current && !selectedRef.current) {
        rotation.current = [
          rotation.current[0] + elapsed * SPIN_PER_MS,
          rotation.current[1],
        ];
      }

      projection.rotate(rotation.current);
      ctx.clearRect(0, 0, size, size);

      // Ocean.
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = "rgba(20,22,26,0.03)";
      ctx.fill();

      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = "rgba(20,22,26,0.10)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (countries) {
        for (const country of countries) {
          const isSelected = country.id === selectedRef.current;
          const isHovered = country.id === hoveredRef.current;
          const hasData = ranked.has(country.id);

          ctx.beginPath();
          path(country);
          ctx.fillStyle = isSelected
            ? "rgba(122,34,48,0.90)"
            : isHovered
              ? "rgba(20,22,26,0.32)"
              : hasData
                ? "rgba(20,22,26,0.20)"
                : "rgba(20,22,26,0.07)";
          ctx.fill();
          ctx.strokeStyle = isSelected
            ? "rgba(122,34,48,0.95)"
            : "rgba(20,22,26,0.22)";
          ctx.lineWidth = isSelected ? 1 : 0.4;
          ctx.stroke();
        }

        // Mark covered jurisdictions so small ones stay findable.
        for (const country of countries) {
          if (!ranked.has(country.id)) continue;
          const isSelected = country.id === selectedRef.current;
          ctx.beginPath();
          path.pointRadius(isSelected ? 9 : 1.6);
          path({ type: "Point", coordinates: geoCentroid(country) });
          if (isSelected) {
            // Ring, so a small jurisdiction still reads as the chosen one.
            ctx.strokeStyle = "rgba(122,34,48,0.80)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
          } else {
            ctx.fillStyle = "rgba(122,34,48,0.55)";
            ctx.fill();
          }
        }
        path.pointRadius(1.6);
      }

      // Limb.
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.strokeStyle = "rgba(20,22,26,0.30)";
      ctx.lineWidth = 1;
      ctx.stroke();

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    const locate = (event: PointerEvent): Country | null => {
      if (!countries) return null;
      const rect = canvas.getBoundingClientRect();
      const point = projection.invert?.([
        event.clientX - rect.left,
        event.clientY - rect.top,
      ]);
      if (!point) return null;
      return countries.find((c) => geoContains(c, point)) ?? null;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging.current = true;
      lastPointer.current = [event.clientX, event.clientY];
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (dragging.current && lastPointer.current) {
        const [px, py] = lastPointer.current;
        lastPointer.current = [event.clientX, event.clientY];
        const [rx, ry] = rotation.current;
        rotation.current = [
          rx + (event.clientX - px) * SENSITIVITY,
          Math.max(-90, Math.min(90, ry - (event.clientY - py) * SENSITIVITY)),
        ];
        target.current = null;
        return;
      }
      const hit = locate(event);
      setHoveredId(hit?.id ?? null);
      canvas.style.cursor = hit && ranked.has(hit.id) ? "pointer" : "grab";
    };

    const onPointerUp = (event: PointerEvent) => {
      const wasDragging = dragging.current;
      const start = lastPointer.current;
      dragging.current = false;
      lastPointer.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      // A drag that barely moved is a click.
      if (wasDragging && start) {
        const moved =
          Math.abs(event.clientX - start[0]) + Math.abs(event.clientY - start[1]);
        if (moved > 4) return;
      }
      const hit = locate(event);
      if (hit && ranked.has(hit.id)) {
        onSelect(hit.id, hit.properties.name);
      } else {
        onSelect(null, null);
      }
    };

    const onPointerLeave = () => setHoveredId(null);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [countries, onSelect, ranked]);

  const hoveredName = useCallback(() => {
    if (!hoveredId || !countries) return null;
    return countries.find((c) => c.id === hoveredId)?.properties.name ?? null;
  }, [hoveredId, countries])();

  return (
    <div className="flex w-full max-w-[380px] flex-col items-center">
      <div className="w-full" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="w-full touch-none select-none"
          role="img"
          aria-label="Interactive globe. Select a jurisdiction to see its ranked firms."
        />
      </div>
      <span className="label mt-3 text-ink-faint">
        {hoveredName ?? "Drag to rotate · Select a jurisdiction"}
      </span>
    </div>
  );
}
