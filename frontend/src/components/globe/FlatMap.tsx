"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoCentroid, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";

type CountryProps = { name: string };
type Country = Feature<Geometry, CountryProps> & { id: string };

/**
 * Flat companion to the globe, for jurisdictions the globe cannot serve.
 *
 * Hong Kong, Singapore and Macao are a few pixels of coastline on a sphere;
 * no amount of zoom makes them a reasonable click target, and on a rotating
 * globe they are hidden half the time. Here every covered jurisdiction is a
 * dot with a generous hit radius, so a territory is exactly as clickable as a
 * continent — which is the right answer for a legal directory, where Singapore
 * matters more than most landmasses.
 *
 * Selection is shared with the globe: clicking either updates both.
 */

const HIT_RADIUS = 13;
const DOT_RADIUS = 3.2;

type Props = {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** ISO 3166-1 numeric ids that carry a listing. */
  rankedIds: string[];
};

export function FlatMap({ selectedId, onSelect, rankedIds }: Props) {
  const ranked = useMemo(() => new Set(rankedIds), [rankedIds]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Screen positions of every covered jurisdiction, recomputed on resize and
  // reused for both drawing and hit-testing so the two can never disagree.
  const points = useRef<{ id: string; name: string; x: number; y: number }[]>([]);

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
        /* The jurisdiction list below remains usable without the map. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !countries) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const projection = geoNaturalEarth1();
    const path = geoPath(projection, ctx);

    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = wrap.clientWidth;
      const height = Math.round(width * 0.46);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      projection.fitExtent(
        [
          [4, 4],
          [width - 4, height - 4],
        ],
        { type: "Sphere" },
      );
      ctx.clearRect(0, 0, width, height);

      for (const country of countries) {
        ctx.beginPath();
        path(country);
        ctx.fillStyle = ranked.has(country.id)
          ? "rgba(20,22,26,0.16)"
          : "rgba(20,22,26,0.05)";
        ctx.fill();
        ctx.strokeStyle = "rgba(20,22,26,0.14)";
        ctx.lineWidth = 0.4;
        ctx.stroke();
      }

      points.current = [];
      for (const country of countries) {
        if (!ranked.has(country.id)) continue;
        const xy = projection(geoCentroid(country));
        if (!xy) continue;
        const [x, y] = xy;
        points.current.push({ id: country.id, name: country.properties.name, x, y });

        const isSelected = country.id === selectedId;
        const isHovered = country.id === hovered;
        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 6 : isHovered ? 5 : DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? "rgba(122,34,48,0.95)"
          : isHovered
            ? "rgba(122,34,48,0.75)"
            : "rgba(122,34,48,0.45)";
        ctx.fill();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(122,34,48,0.55)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);

    const nearest = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      let best: { id: string; name: string } | null = null;
      let bestDistance = HIT_RADIUS;
      for (const point of points.current) {
        const distance = Math.hypot(point.x - px, point.y - py);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = { id: point.id, name: point.name };
        }
      }
      return best;
    };

    const onMove = (event: PointerEvent) => {
      const hit = nearest(event);
      setHovered(hit?.id ?? null);
      canvas.style.cursor = hit ? "pointer" : "default";
    };
    const onClick = (event: PointerEvent) => {
      const hit = nearest(event);
      onSelect(hit ? hit.id : null);
    };
    const onLeave = () => setHovered(null);

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onClick);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      observer.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onClick);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [countries, ranked, selectedId, hovered, onSelect]);

  const hoveredName =
    points.current.find((p) => p.id === hovered)?.name ?? null;

  return (
    <div className="w-full">
      <div ref={wrapRef} className="w-full">
        <canvas
          ref={canvasRef}
          className="w-full touch-none select-none"
          role="img"
          aria-label="Flat world map. Every covered jurisdiction is a marker; select one to see its firms."
        />
      </div>
      <p className="label mt-2 text-ink-faint">
        {hoveredName ?? "Every jurisdiction is a marker — including the small ones"}
      </p>
    </div>
  );
}
