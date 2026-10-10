"use client";

import { LngLatBounds, type GeoJSONSource, type Map as MapLibre, type MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { createMap } from "@/components/map/createMap";
import type { Demand, MapBin } from "@/lib/admin";
import { INDIA_VIEW } from "@/lib/bins";

export type BinStatus = "broken" | "needsCleaning" | "atRisk" | "ok";

// Worst problem first: a broken bin that's also full shows as broken
export function binStatus(b: MapBin): BinStatus {
  if (b.issues.some((i) => i.type === "BROKEN")) return "broken";
  if (b.issues.length) return "needsCleaning";
  if (b.missingReports > 0) return "atRisk";
  return "ok";
}

export const STATUS_LABEL: Record<BinStatus, string> = {
  broken: "Broken",
  needsCleaning: "Full, dirty or other",
  atRisk: "May be missing",
  ok: "No problems",
};

export const STATUS_VAR: Record<BinStatus, string> = {
  broken: "--destructive",
  needsCleaning: "--warning",
  atRisk: "--muted-foreground",
  ok: "--wet",
};

// Map layers can't read CSS variables, so resolve the theme's colours when drawing
const cssColor = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";

function binsGeoJSON(bins: MapBin[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: bins.map((b) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [b.longitude, b.latitude] },
      properties: { id: b.id, status: binStatus(b), demand: b.demand30 },
    })),
  };
}

function cellsGeoJSON(cells: Demand["cells"], key: "searches" | "unserved"): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells
      .filter((c) => c[key] > 0)
      .map((c) => ({ type: "Feature", geometry: { type: "Point", coordinates: [c.lng, c.lat] }, properties: { weight: c[key] } })),
  };
}

// Blue for where people search, red for searches that found no bin nearby (weight is set in sync)
function heatmapPaint(colors: string[]) {
  return {
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 3],
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 12, 16, 40],
    "heatmap-opacity": 0.75,
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, colors[0], 0.6, colors[1], 1, colors[2]],
  } as const;
}

// The style's own label font (an upright one), so cluster counts render on Amazon and OpenFreeMap styles alike
function labelFont(m: MapLibre): string[] | undefined {
  const fonts = (m.getStyle().layers ?? [])
    .map((layer) => (layer.type === "symbol" ? (layer.layout as Record<string, unknown> | undefined)?.["text-font"] : undefined))
    .filter((f): f is string[] => Array.isArray(f) && f.every((x) => typeof x === "string"));
  return fonts.find((f) => !f.some((x) => /italic/i.test(x))) ?? fonts[0];
}

export default function AdminMap({
  bins,
  demand,
  showSearches,
  showUnserved,
  selectedId,
  onSelect,
}: {
  bins: MapBin[];
  demand: Demand | undefined;
  showSearches: boolean;
  showUnserved: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const props = useRef({ bins, demand, showSearches, showUnserved, selectedId });
  const onSelectRef = useRef(onSelect);
  const fitted = useRef(false);
  // True between "style.load" and the next style swap (theme or tile fallback). Not isStyleLoaded(),
  // which stays false until every tile has arrived and would skip our layers on a slow connection.
  const styleReady = useRef(false);

  // Adds the sources and layers if the style dropped them (first load, theme switch, tile fallback), then updates data
  const sync = useRef((m: MapLibre) => {
    if (!styleReady.current) return;
    const p = props.current;
    const searches = cellsGeoJSON(p.demand?.cells ?? [], "searches");
    const unserved = cellsGeoJSON(p.demand?.cells ?? [], "unserved");

    if (!m.getSource("bins")) {
      const fg = cssColor("--foreground");
      const bg = cssColor("--background");
      m.addSource("searches", { type: "geojson", data: searches });
      m.addSource("unserved", { type: "geojson", data: unserved });
      m.addSource("bins", { type: "geojson", data: binsGeoJSON(p.bins), cluster: true, clusterRadius: 36, clusterMaxZoom: 12 });

      m.addLayer({ id: "searches-heat", type: "heatmap", source: "searches", paint: heatmapPaint(["#a6c8ff", "#276ef1", "#1e3a8a"]) as never });
      m.addLayer({ id: "unserved-heat", type: "heatmap", source: "unserved", paint: heatmapPaint(["#ffd2c7", "#ff5a3c", "#a51400"]) as never });

      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "bins",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": fg,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
          "circle-stroke-width": 3,
          "circle-stroke-color": bg,
        },
      });
      const font = labelFont(m);
      if (font) {
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "bins",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": font, "text-size": 13 },
          paint: { "text-color": bg },
        });
      }
      m.addLayer({
        id: "bin-points",
        type: "circle",
        source: "bins",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["match", ["get", "status"],
            "broken", cssColor(STATUS_VAR.broken),
            "needsCleaning", cssColor(STATUS_VAR.needsCleaning),
            "atRisk", cssColor(STATUS_VAR.atRisk),
            cssColor(STATUS_VAR.ok)],
          // Busier bins draw bigger
          "circle-radius": ["interpolate", ["linear"], ["get", "demand"], 0, 7, 20, 11, 100, 16],
          "circle-stroke-width": 2,
          "circle-stroke-color": bg,
        },
      });
      m.addLayer({
        id: "bin-selected",
        type: "circle",
        source: "bins",
        filter: ["==", ["get", "id"], ""],
        paint: { "circle-radius": 20, "circle-color": "rgba(0,0,0,0)", "circle-stroke-width": 3, "circle-stroke-color": fg },
      });
    }

    (m.getSource("bins") as GeoJSONSource).setData(binsGeoJSON(p.bins));
    (m.getSource("searches") as GeoJSONSource).setData(searches);
    (m.getSource("unserved") as GeoJSONSource).setData(unserved);
    // Scale to the busiest cell of the current data (demand usually arrives after the layers)
    for (const k of ["searches", "unserved"] as const) {
      const max = Math.max(1, ...(p.demand?.cells ?? []).map((c) => c[k]));
      m.setPaintProperty(`${k}-heat`, "heatmap-weight", ["interpolate", ["linear"], ["get", "weight"], 0, 0, max, 1]);
    }
    m.setLayoutProperty("searches-heat", "visibility", p.showSearches ? "visible" : "none");
    m.setLayoutProperty("unserved-heat", "visibility", p.showUnserved ? "visible" : "none");
    m.setFilter("bin-selected", ["==", ["get", "id"], p.selectedId ?? ""]);

    // Frame the bins once they first arrive
    if (!fitted.current && p.bins.length) {
      fitted.current = true;
      const bounds = new LngLatBounds();
      p.bins.forEach((b) => bounds.extend([b.longitude, b.latitude]));
      // Room for the filter bar on top
      m.fitBounds(bounds, { padding: { top: 150, bottom: 60, left: 60, right: 60 }, maxZoom: 15, duration: 0 });
    }
  });

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const { map: m, dispose } = createMap(container.current!, INDIA_VIEW.center, INDIA_VIEW.zoom);
    map.current = m;
    // A layer that fails must not take the whole map down with it
    m.on("styledataloading", () => (styleReady.current = false));
    m.on("style.load", () => {
      styleReady.current = true;
      try {
        sync.current(m);
      } catch (err) {
        console.error("Admin map layers failed", err);
      }
    });

    m.on("click", "bin-points", (e) => {
      const id = (e.features?.[0] as MapGeoJSONFeature | undefined)?.properties?.id;
      if (id) onSelectRef.current(String(id));
    });
    m.on("click", "clusters", async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const zoom = await (m.getSource("bins") as GeoJSONSource).getClusterExpansionZoom(feature.properties.cluster_id);
      m.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
    });
    m.on("click", (e) => {
      if (!m.queryRenderedFeatures(e.point, { layers: ["bin-points", "clusters"].filter((l) => m.getLayer(l)) }).length) onSelectRef.current(null);
    });
    for (const layer of ["bin-points", "clusters"]) {
      m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
    }
    return () => {
      dispose();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    props.current = { bins, demand, showSearches, showUnserved, selectedId };
    if (map.current) sync.current(map.current);
  }, [bins, demand, showSearches, showUnserved, selectedId]);

  return (
    <div className="absolute inset-0 bg-map">
      <div ref={container} className="size-full" />
    </div>
  );
}
