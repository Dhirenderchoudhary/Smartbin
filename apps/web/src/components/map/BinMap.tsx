"use client";

import { type GeoJSONSource, LngLatBounds, type Map as MapLibre, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { Bin, LatLng } from "@/lib/bins";
import { createMap } from "./createMap";

const BIN_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16M9.5 4h5M6 6.5l1 13.5h10l1-13.5"/></svg>';

const PIN_BG: Record<Bin["type"], string> = {
  WET: "var(--wet)",
  DRY: "var(--dry)",
  BOTH: "linear-gradient(90deg, var(--wet) 50%, var(--dry) 50%)",
};

// MapLibre positions a marker by setting `transform: translate(...)` on its element, so that
// element must stay unstyled. CSS `scale` (Tailwind's scale-125) is applied on top of
// `transform`, so scaling the marker element scales its map position too and the selected
// pin drifts on every zoom. The look and the grow-when-selected effect live on the inner button.
function pinElement(bin: Bin, onSelect: (id: string) => void): { root: HTMLDivElement; button: HTMLButtonElement } {
  const root = document.createElement("div");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", `${bin.name}, ${Math.round(bin.distance)} metres away`);
  button.className =
    "grid size-9 place-items-center rounded-full border-[3px] border-background shadow-float transition-transform data-[selected=true]:scale-125 data-[selected=true]:ring-2 data-[selected=true]:ring-foreground focus-visible:outline-2 focus-visible:outline-foreground";
  button.style.background = PIN_BG[bin.type];
  button.innerHTML = BIN_ICON;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(bin.id);
  });
  root.append(button);
  return { root, button };
}

// Your dot draws above the bin pins (you're often standing right at a bin) and lets taps
// pass through, so the pin under it can still be selected.
function youElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Your location");
  el.style.zIndex = "10";
  el.style.pointerEvents = "none";
  el.className = "relative grid size-10 place-items-center";
  // The cone points the way you're walking; shown once the device reports a heading
  el.innerHTML =
    '<span class="absolute inset-0 rounded-full bg-foreground/15 motion-safe:animate-ping"></span>' +
    '<span data-cone class="absolute inset-0 hidden"><span class="absolute top-0 left-1/2 size-0 -translate-x-1/2 border-x-[7px] border-b-[11px] border-x-transparent border-b-foreground"></span></span>' +
    '<span class="relative size-4 rounded-full border-[3px] border-background bg-foreground shadow-float"></span>';
  return el;
}

// The walking route: a dark line with a light casing (inverts in dark mode, like the rest of the UI)
const ROUTE = "walk-route";
function drawRoute(m: MapLibre, line: [number, number][] | null) {
  const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: line ?? [] } };
  const source = m.getSource(ROUTE) as GeoJSONSource | undefined;
  if (source) return source.setData(data);
  if (!m.isStyleLoaded()) return; // added on "style.load" instead
  const css = getComputedStyle(document.documentElement);
  m.addSource(ROUTE, { type: "geojson", data });
  m.addLayer({ id: `${ROUTE}-casing`, type: "line", source: ROUTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css.getPropertyValue("--background").trim(), "line-width": 11 } });
  m.addLayer({ id: ROUTE, type: "line", source: ROUTE, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": css.getPropertyValue("--foreground").trim(), "line-width": 6 } });
}

// Matches the bottom sheet's max height (46dvh) on phones
const sheetHeight = () => Math.round(window.innerHeight * 0.46);

export default function BinMap({
  you,
  start,
  startZoom,
  bins,
  selectedId,
  onSelect,
  focus,
  route = null,
  follow = false,
  onUserMove,
}: {
  /** Your real position; null until the first GPS fix (no dot is drawn until then) */
  you: (LatLng & { heading?: number | null }) | null;
  /** Where the map opens: your last known spot, or all of India */
  start: LatLng;
  startZoom: number;
  bins: Bin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bumped by the page to re-centre on you and the bins */
  focus: number;
  /** Walking route to draw while navigating */
  route?: [number, number][] | null;
  /** Keep the camera on you (navigation); the page turns it off when you pan */
  follow?: boolean;
  /** You dragged or zoomed the map yourself */
  onUserMove?: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const pins = useRef(new Map<string, { marker: Marker; button: HTMLButtonElement }>());
  const youMarker = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onUserMoveRef = useRef(onUserMove);
  const routeRef = useRef(route);
  const binsRef = useRef(bins);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onUserMoveRef.current = onUserMove;
  }, [onSelect, onUserMove]);

  // Create the map once (theme and tile fallback are handled by createMap)
  useEffect(() => {
    const { map: m, dispose } = createMap(container.current!, start, startZoom);
    m.on("click", () => onSelectRef.current(null));
    // A theme switch or tile fallback reloads the style, which drops the route layer
    m.on("style.load", () => drawRoute(m, routeRef.current));
    m.on("movestart", (e) => e.originalEvent && onUserMoveRef.current?.());
    map.current = m;
    const currentPins = pins.current;
    return () => {
      currentPins.clear();
      youMarker.current = null;
      dispose();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; position updates are handled below
  }, []);

  // Your position, once it's known
  useEffect(() => {
    if (!map.current || !you) return;
    youMarker.current ??= new Marker({ element: youElement() }).setLngLat([you.lng, you.lat]).addTo(map.current);
    youMarker.current.setLngLat([you.lng, you.lat]);
    const cone = youMarker.current.getElement().querySelector<HTMLElement>("[data-cone]")!;
    cone.classList.toggle("hidden", typeof you.heading !== "number");
    if (typeof you.heading === "number") cone.style.rotate = `${you.heading}deg`;
  }, [you]);

  // Route line
  useEffect(() => {
    routeRef.current = route;
    if (map.current) drawRoute(map.current, route);
  }, [route]);

  // Navigation: keep you in view, leaving room for the instruction card and the sheet
  useEffect(() => {
    if (!follow || !you || !map.current) return;
    const wide = window.matchMedia("(min-width: 768px)").matches;
    map.current.easeTo({
      center: [you.lng, you.lat],
      zoom: Math.max(map.current.getZoom(), 17),
      padding: wide ? { left: 0, top: 120, right: 0, bottom: 0 } : { top: 150, bottom: 230, left: 0, right: 0 },
      duration: 600,
    });
  }, [follow, you]);

  // Bin pins: add new, drop removed
  useEffect(() => {
    binsRef.current = bins;
    const m = map.current;
    if (!m) return;
    const ids = new Set(bins.map((b) => b.id));
    for (const [id, pin] of pins.current) {
      if (!ids.has(id)) {
        pin.marker.remove();
        pins.current.delete(id);
      }
    }
    for (const bin of bins) {
      if (pins.current.has(bin.id)) continue;
      const { root, button } = pinElement(bin, (id) => onSelectRef.current(id));
      pins.current.set(bin.id, { button, marker: new Marker({ element: root }).setLngLat([bin.longitude, bin.latitude]).addTo(m) });
    }
  }, [bins]);

  // Highlight and pan to the selected bin, leaving room for the panel
  useEffect(() => {
    for (const [id, pin] of pins.current) pin.button.setAttribute("data-selected", String(id === selectedId));
    const bin = binsRef.current.find((b) => b.id === selectedId);
    if (bin && map.current && !routeRef.current) {
      const wide = window.matchMedia("(min-width: 768px)").matches;
      map.current.easeTo({
        center: [bin.longitude, bin.latitude],
        padding: wide ? { left: 420, top: 0, right: 0, bottom: 0 } : { bottom: sheetHeight(), top: 0, left: 0, right: 0 },
        duration: 500,
      });
    }
    // Pan only when the selection changes (or its pin first arrives), not on every distance update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, bins.some((b) => b.id === selectedId)]);

  // Fit you and the nearest bins in view
  useEffect(() => {
    const m = map.current;
    // ...and the selected bin, e.g. one you just added that isn't among the nearest
    const selected = bins.find((b) => b.id === selectedId);
    const points: [number, number][] = [...bins.slice(0, 5), ...(selected ? [selected] : [])].map((b) => [b.longitude, b.latitude]);
    if (you) points.unshift([you.lng, you.lat]);
    if (!m || !points.length || routeRef.current) return; // navigation moves the camera itself
    const bounds = new LngLatBounds(points[0], points[0]);
    points.forEach((p) => bounds.extend(p));
    const wide = window.matchMedia("(min-width: 768px)").matches;
    m.fitBounds(bounds, {
      padding: wide ? { top: 90, bottom: 60, left: 460, right: 80 } : { top: 130, bottom: sheetHeight() + 24, left: 40, right: 40 },
      maxZoom: 16.5,
      duration: 600,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when asked to re-centre or the list arrives
  }, [focus, bins.length]);

  // maplibre's CSS makes its container position: relative, so position a wrapper instead
  return (
    <div className="absolute inset-0 bg-map">
      <div ref={container} className="size-full" />
    </div>
  );
}
