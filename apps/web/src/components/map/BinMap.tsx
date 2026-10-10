"use client";

import { LngLatBounds, Map as MapLibre, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Bin, LatLng } from "@/lib/bins";
import {
  AWS_LOAD_TIMEOUT_MS,
  initialProvider,
  isAwsFailure,
  rememberAwsFailure,
  styleUrl,
  type MapProvider,
} from "@/lib/mapStyle";
import { isDark, onThemeChange } from "@/lib/theme";

// Worker is copied to /public by the predev/prebuild scripts (bundling breaks its own lookup)
setWorkerUrl("/maplibre-gl-worker.mjs");

const BIN_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h16M9.5 4h5M6 6.5l1 13.5h10l1-13.5"/></svg>';

const PIN_BG: Record<Bin["type"], string> = {
  WET: "var(--wet)",
  DRY: "var(--dry)",
  BOTH: "linear-gradient(90deg, var(--wet) 50%, var(--dry) 50%)",
};

function pinElement(bin: Bin, onSelect: (id: string) => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `${bin.name}, ${Math.round(bin.distance)} metres away`);
  el.className =
    "grid size-9 place-items-center rounded-full border-[3px] border-background shadow-float transition-transform data-[selected=true]:scale-125 data-[selected=true]:ring-2 data-[selected=true]:ring-foreground focus-visible:outline-2 focus-visible:outline-foreground";
  el.style.background = PIN_BG[bin.type];
  el.innerHTML = BIN_ICON;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect(bin.id);
  });
  return el;
}

function youElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Your location");
  el.className = "relative grid size-10 place-items-center";
  el.innerHTML =
    '<span class="absolute inset-0 rounded-full bg-foreground/15 motion-safe:animate-ping"></span><span class="relative size-4 rounded-full border-[3px] border-background bg-foreground shadow-float"></span>';
  return el;
}

// Matches the bottom sheet's max height (46dvh) on phones
const sheetHeight = () => Math.round(window.innerHeight * 0.46);

export default function BinMap({
  you,
  bins,
  selectedId,
  onSelect,
  focus,
}: {
  you: LatLng;
  bins: Bin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Bumped by the page to re-centre on you and the bins */
  focus: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const pins = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const youMarker = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once, follow the light/dark theme, and fall back if Amazon Location fails
  useEffect(() => {
    let dark = isDark();
    let provider: MapProvider = initialProvider();
    let styleReady = false;

    const m = new MapLibre({
      container: container.current!,
      style: styleUrl(provider, dark),
      validateStyle: false,
      center: [you.lng, you.lat],
      zoom: 15,
      attributionControl: { compact: true },
    });

    const switchToFallback = (reason: string) => {
      if (provider !== "aws") return;
      console.warn(`Amazon Location map unavailable (${reason}); using the fallback map.`);
      provider = "fallback";
      rememberAwsFailure();
      clearTimeout(timer);
      m.setStyle(styleUrl(provider, dark));
    };

    // Any error before Amazon's style loads, or an Amazon auth/throttle/server error after
    m.on("error", (e) => {
      if (provider === "aws" && (!styleReady || isAwsFailure(e.error))) switchToFallback(e.error?.message ?? "error");
    });
    m.on("style.load", () => {
      styleReady = true;
      clearTimeout(timer);
    });
    const timer = setTimeout(() => !styleReady && switchToFallback("timed out"), AWS_LOAD_TIMEOUT_MS);

    m.on("click", () => onSelectRef.current(null));
    const stopWatching = onThemeChange(() => {
      if (isDark() === dark) return;
      dark = isDark();
      m.setStyle(styleUrl(provider, dark));
    });
    map.current = m;
    const currentPins = pins.current;
    return () => {
      clearTimeout(timer);
      stopWatching();
      currentPins.clear();
      youMarker.current = null;
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; position updates are handled below
  }, []);

  // Your position
  useEffect(() => {
    if (!map.current) return;
    youMarker.current ??= new Marker({ element: youElement() }).setLngLat([you.lng, you.lat]).addTo(map.current);
    youMarker.current.setLngLat([you.lng, you.lat]);
  }, [you]);

  // Bin pins: add new, drop removed
  useEffect(() => {
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
      const el = pinElement(bin, (id) => onSelectRef.current(id));
      pins.current.set(bin.id, { el, marker: new Marker({ element: el }).setLngLat([bin.longitude, bin.latitude]).addTo(m) });
    }
  }, [bins]);

  // Highlight and pan to the selected bin, leaving room for the panel
  useEffect(() => {
    for (const [id, pin] of pins.current) pin.el.setAttribute("data-selected", String(id === selectedId));
    const bin = bins.find((b) => b.id === selectedId);
    if (bin && map.current) {
      const wide = window.matchMedia("(min-width: 768px)").matches;
      map.current.easeTo({
        center: [bin.longitude, bin.latitude],
        padding: wide ? { left: 420, top: 0, right: 0, bottom: 0 } : { bottom: sheetHeight(), top: 0, left: 0, right: 0 },
        duration: 500,
      });
    }
  }, [selectedId, bins]);

  // Fit you and the nearest bins in view
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const bounds = new LngLatBounds([you.lng, you.lat], [you.lng, you.lat]);
    bins.slice(0, 5).forEach((b) => bounds.extend([b.longitude, b.latitude]));
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
