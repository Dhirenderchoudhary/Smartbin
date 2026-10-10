import { Map as MapLibre, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/bins";
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

// A map that follows the light/dark theme and falls back from Amazon Location to
// OpenFreeMap on its own. Shared by every map screen.
export function createMap(container: HTMLElement, center: LatLng, zoom: number): { map: MapLibre; dispose: () => void } {
  let dark = isDark();
  let provider: MapProvider = initialProvider();
  let styleReady = false;

  const map = new MapLibre({
    container,
    style: styleUrl(provider, dark),
    validateStyle: false,
    center: [center.lng, center.lat],
    zoom,
    attributionControl: { compact: true },
  });

  const switchToFallback = (reason: string) => {
    if (provider !== "aws") return;
    console.warn(`Amazon Location map unavailable (${reason}); using the fallback map.`);
    provider = "fallback";
    rememberAwsFailure();
    clearTimeout(timer);
    map.setStyle(styleUrl(provider, dark));
  };

  // Any error before Amazon's style loads, or an Amazon auth/throttle/server error after
  map.on("error", (e) => {
    if (provider === "aws" && (!styleReady || isAwsFailure(e.error))) switchToFallback(e.error?.message ?? "error");
  });
  map.on("style.load", () => {
    styleReady = true;
    clearTimeout(timer);
  });
  const timer = setTimeout(() => !styleReady && switchToFallback("timed out"), AWS_LOAD_TIMEOUT_MS);

  const stopWatching = onThemeChange(() => {
    if (isDark() === dark) return;
    dark = isDark();
    map.setStyle(styleUrl(provider, dark));
  });

  return {
    map,
    dispose: () => {
      clearTimeout(timer);
      stopWatching();
      map.remove();
    },
  };
}
