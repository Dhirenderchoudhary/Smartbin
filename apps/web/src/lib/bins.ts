import { api } from "./api";

export type BinType = "WET" | "DRY" | "BOTH";

export interface Bin {
  id: string;
  name: string;
  type: BinType;
  latitude: number;
  longitude: number;
  missingReports: number;
  createdAt: string;
  distance: number;
  imageUrl: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// Map view before we know where you are: all of India
export const INDIA_VIEW = { center: { lat: 22.5, lng: 79 } as LatLng, zoom: 4 };

// Same as the API's duplicate rule: no two bins within 15 m
export const DUPLICATE_RADIUS_M = 15;

export const TYPE_LABEL: Record<BinType, string> = { WET: "Wet", DRY: "Dry", BOTH: "Wet and dry" };

// Bins within 2 km; if there are none, the 5 closest wherever they are
export async function fetchNearby({ lat, lng }: LatLng): Promise<Bin[]> {
  const near = await api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}&radius=2000`);
  return near.length ? near : api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}`);
}

export function reportMissing(binId: string, at: LatLng) {
  return api<{ id: string; missingReports: number; threshold: number; removed: boolean }>(
    `/dustbins/${binId}/report-missing`,
    { method: "POST", body: at }
  );
}

export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1)} km`;
}

// Average walking pace of about 80 m a minute
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

// Hands off to Google Maps for walking directions (opens the app on phones)
export function directionsUrl(bin: Pick<Bin, "latitude" | "longitude">): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${bin.latitude},${bin.longitude}&travelmode=walking`;
}

// Straight-line distance in metres
export function metresBetween(a: LatLng, b: { lat?: number; lng?: number; latitude?: number; longitude?: number }): number {
  const lat2 = b.latitude ?? b.lat!;
  const lng2 = b.longitude ?? b.lng!;
  const rad = Math.PI / 180;
  const dLat = (lat2 - a.lat) * rad;
  const dLng = (lng2 - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// heading: direction of travel in degrees from north, when the device is moving (else null)
export type Fix = LatLng & { accuracy: number; heading: number | null };

function geoErrorMessage(e: GeolocationPositionError): string {
  return e.code === e.PERMISSION_DENIED
    ? "Location is turned off for SmartBin. Allow location in your browser settings, then try again."
    : "Couldn't find your location. Move to open sky and try again.";
}

// The last place we saw you, kept only on this device, so the map opens there on refresh
const LAST_KEY = "smartbin.lastLocation";

export function lastKnownLocation(): LatLng | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null");
    return typeof saved?.lat === "number" && typeof saved?.lng === "number" ? { lat: saved.lat, lng: saved.lng } : null;
  } catch {
    return null;
  }
}

function remember({ lat, lng }: LatLng): void {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // storage blocked: the map just starts zoomed out next time
  }
}

function toFix(p: GeolocationPosition): Fix {
  const h = p.coords.heading;
  const fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, heading: h !== null && Number.isFinite(h) ? h : null };
  remember(fix);
  return fix;
}

// Device position (with accuracy in metres) as a promise; rejects with a message people can act on
export function currentPosition(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(new Error(geoErrorMessage(e))), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  });
}

// Live position: a recent cached fix comes back straight away, then updates as GPS sharpens or you move.
// onError fires only if there's no fix yet. Returns a function that stops watching.
export function watchLocation(onFix: (fix: Fix) => void, onError: (message: string) => void): () => void {
  if (!("geolocation" in navigator)) {
    onError("This browser can't share your location.");
    return () => {};
  }
  let gotFix = false;
  const id = navigator.geolocation.watchPosition(
    (p) => {
      gotFix = true;
      onFix(toFix(p));
    },
    (e) => !gotFix && onError(geoErrorMessage(e)),
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}
