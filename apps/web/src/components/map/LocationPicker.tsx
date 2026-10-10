"use client";

import { type Map as MapLibre, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { Bin, LatLng } from "@/lib/bins";
import { createMap } from "./createMap";

const DOT_BG: Record<Bin["type"], string> = {
  WET: "var(--wet)",
  DRY: "var(--dry)",
  BOTH: "linear-gradient(90deg, var(--wet) 50%, var(--dry) 50%)",
};

// Pick a spot by moving the map under a fixed centre pin (like setting a pickup point).
// Existing bins show as small dots so duplicates are easy to see.
export default function LocationPicker({
  start,
  startZoom,
  you,
  bins,
  recenter,
  onMove,
}: {
  start: LatLng;
  startZoom: number;
  you: LatLng | null;
  bins: Bin[];
  /** Bumped by the page to fly to your location */
  recenter: number;
  onMove: (center: LatLng) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const dots = useRef<Marker[]>([]);
  const youMarker = useRef<Marker | null>(null);
  const onMoveRef = useRef(onMove);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    const { map: m, dispose } = createMap(container.current!, start, startZoom);
    m.on("movestart", () => setMoving(true));
    // Report on every frame, not just at moveend: a Confirm tapped while the map is still
    // gliding after a flick must save the spot under the pin right now, not the previous one
    m.on("move", () => {
      const c = m.getCenter();
      onMoveRef.current({ lat: c.lat, lng: c.lng });
    });
    m.on("moveend", () => setMoving(false));
    map.current = m;
    return () => {
      dots.current = [];
      youMarker.current = null;
      dispose();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; moves are handled below
  }, []);

  // "Use my location": fly to you
  useEffect(() => {
    if (recenter && you) map.current?.easeTo({ center: [you.lng, you.lat], zoom: 18, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when asked
  }, [recenter]);

  // You
  useEffect(() => {
    if (!map.current || !you) return;
    if (!youMarker.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      el.className = "size-4 rounded-full border-[3px] border-background bg-foreground shadow-float";
      el.style.zIndex = "10"; // above the existing-bin dots
      el.style.pointerEvents = "none";
      youMarker.current = new Marker({ element: el }).setLngLat([you.lng, you.lat]).addTo(map.current);
    }
    youMarker.current.setLngLat([you.lng, you.lat]);
  }, [you]);

  // Existing bins as small dots
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    dots.current.forEach((d) => d.remove());
    dots.current = bins.map((bin) => {
      const el = document.createElement("div");
      el.setAttribute("aria-label", `Existing bin: ${bin.name}`);
      el.className = "size-4 rounded-full border-2 border-background shadow-float";
      el.style.background = DOT_BG[bin.type];
      return new Marker({ element: el }).setLngLat([bin.longitude, bin.latitude]).addTo(m);
    });
  }, [bins]);

  return (
    <div className="absolute inset-0 bg-map">
      <div ref={container} className="size-full" />
      {/* Fixed centre pin: its tip marks the spot. Lifts while the map moves. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-full" aria-hidden="true">
        <div className={`flex flex-col items-center transition-transform duration-150 ${moving ? "-translate-y-3" : ""}`}>
          <div className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-sheet">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6.5h16M9.5 4h5M6 6.5l1 13.5h10l1-13.5" />
            </svg>
          </div>
          <div className="h-4 w-1 rounded-b-full bg-primary" />
        </div>
      </div>
      {/* Where the tip touches the map */}
      <div
        className={`pointer-events-none absolute top-1/2 left-1/2 z-0 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/40 transition-opacity ${moving ? "opacity-100" : "opacity-0"}`}
        aria-hidden="true"
      />
    </div>
  );
}
