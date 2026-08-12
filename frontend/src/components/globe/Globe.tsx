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
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

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

  // Zoom lives in a ref for the same reason rotation does — the render loop
  // reads it every frame and must not re-render React to do so. The state
  // mirror exists only so the buttons and readout can show the current level.
  const zoom = useRef(1);
  const baseScale = useRef(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Active pointers, so two fingers on a touchscreen can pinch.
  const pointers = useRef(new Map<number, [number, number]>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  const applyZoom = useCallback((next: number) => {
    const clamped = clampZoom(next);
    zoom.current = clamped;
    setZoomLevel(clamped);
  }, []);

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
      // fitExtent has just solved for the scale that fills the canvas. That is
      // zoom 1; every zoom level is a multiple of it, so it has to be captured
      // after each resize rather than computed once.
      baseScale.current = projection.scale();
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

      projection.rotate(rotation.current).scale(baseScale.current * zoom.current);
      ctx.clearRect(0, 0, size, size);

      // Zoomed in, the sphere overflows the canvas. Clip to it so the globe
      // stays a disc instead of bleeding across the section.
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.clip();

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

      ctx.restore();

      // Limb. Drawn as the clip circle rather than the projected sphere: once
      // zoomed in the sphere's edge is off-canvas, and the disc edge is what
      // the reader actually sees.
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
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

    const spread = (): number => {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return 0;
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };

    const onWheel = (event: WheelEvent) => {
      // Not passive: the page must not scroll while the reader is zooming the
      // globe. Exponential so each notch is the same proportional step
      // whether you are at 1x or at 6x.
      event.preventDefault();
      applyZoom(zoom.current * Math.exp(-event.deltaY * 0.0016));
    };

    const onPointerDown = (event: PointerEvent) => {
      pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
      canvas.setPointerCapture(event.pointerId);
      if (pointers.current.size === 2) {
        pinchStart.current = { distance: spread(), zoom: zoom.current };
        dragging.current = false;
        return;
      }
      dragging.current = true;
      lastPointer.current = [event.clientX, event.clientY];
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointers.current.has(event.pointerId)) {
        pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
      }

      // Two fingers: pinch to zoom, and no rotation while pinching.
      if (pointers.current.size === 2 && pinchStart.current) {
        const distance = spread();
        if (distance > 0 && pinchStart.current.distance > 0) {
          applyZoom(
            pinchStart.current.zoom * (distance / pinchStart.current.distance),
          );
        }
        return;
      }

      if (dragging.current && lastPointer.current) {
        const [px, py] = lastPointer.current;
        lastPointer.current = [event.clientX, event.clientY];
        const [rx, ry] = rotation.current;
        // Divided by zoom: at 6x a pixel of drag covers a sixth of the arc it
        // covers at 1x, so without this the globe becomes unusable zoomed in.
        const step = SENSITIVITY / zoom.current;
        rotation.current = [
          rx + (event.clientX - px) * step,
          Math.max(-90, Math.min(90, ry - (event.clientY - py) * step)),
        ];
        target.current = null;
        return;
      }
      const hit = locate(event);
      setHoveredId(hit?.id ?? null);
      canvas.style.cursor = hit && ranked.has(hit.id) ? "pointer" : "grab";
    };

    const onPointerUp = (event: PointerEvent) => {
      const wasPinching = pointers.current.size === 2;
      pointers.current.delete(event.pointerId);
      const wasDragging = dragging.current;
      const start = lastPointer.current;
      dragging.current = false;
      lastPointer.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      if (wasPinching) {
        // Lifting one finger of a pinch is not a click on a country.
        pinchStart.current = null;
        return;
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
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [countries, onSelect, ranked, applyZoom]);

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
      <div className="mt-3 flex w-full items-center justify-between gap-4">
        <span className="label text-ink-faint">
          {hoveredName ?? "Drag to rotate · Scroll to zoom"}
        </span>

        {/* Buttons as well as the wheel: pinch covers touch, but a trackpad
            user who has disabled gestures and a keyboard user both need a
            control they can reach. */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => applyZoom(zoom.current / 1.4)}
            disabled={zoomLevel <= MIN_ZOOM}
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center border border-rule text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink-muted"
          >
            <span aria-hidden="true">−</span>
          </button>
          <span className="figure w-12 text-center text-[11px] text-ink-faint">
            {zoomLevel.toFixed(1)}×
          </span>
          <button
            type="button"
            onClick={() => applyZoom(zoom.current * 1.4)}
            disabled={zoomLevel >= MAX_ZOOM}
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center border border-rule text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink-muted"
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}
