"use client";

import { Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { createMap } from "@/components/map/createMap";

// Small map with one pin, for a bin's detail page
export default function BinSpotMap({ lat, lng }: { lat: number; lng: number }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const { map, dispose } = createMap(container.current!, { lat, lng }, 16.5);
    const el = document.createElement("div");
    el.className = "size-5 rounded-full border-[3px] border-background bg-foreground shadow-float";
    new Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    return dispose;
  }, [lat, lng]);

  return (
    // maplibre's CSS makes its container position: relative, so the size lives on the wrapper
    <div className="h-56 overflow-hidden rounded-2xl bg-map">
      <div ref={container} className="size-full" />
    </div>
  );
}
