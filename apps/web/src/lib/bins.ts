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
  /** Open problems, one per type, most recent first */
  issues: BinIssue[];
}

export type IssueType = "FULL" | "BROKEN" | "DIRTY" | "OTHER";

export interface BinIssue {
  type: IssueType;
  reports: number;
  lastReportedAt: string;
  note: string | null;
}

export const ISSUE_LABEL: Record<IssueType, string> = { FULL: "Full", BROKEN: "Broken", DIRTY: "Dirty", OTHER: "Problem reported" };

// Same as the API: you need to be this close to report or clear a problem
export const ISSUE_RADIUS_M = 50;

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
// search: count this as a "bins near me" search in the admin stats (not for map pans)
export async function fetchNearby({ lat, lng }: LatLng, search = false): Promise<Bin[]> {
  const near = await api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}&radius=2000${search ? "&log=1" : ""}`);
  return near.length ? near : api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}`);
}

// Every bin within radius metres (the API caps it at the 500 nearest)
export function fetchArea({ lat, lng }: LatLng, radius: number): Promise<Bin[]> {
  return api<Bin[]>(`/dustbins/nearby?lat=${lat}&lng=${lng}&radius=${Math.ceil(radius)}`);
}

export type Interaction = "VIEW" | "DIRECTIONS" | "ARRIVED";

// Tells admins which bins people look for. Best effort: never blocks or fails the UI.
export function trackInteraction(binId: string, type: Interaction): void {
  api(`/dustbins/${binId}/interactions`, { method: "POST", body: { type } }).catch(() => {});
}

export function reportMissing(binId: string, at: LatLng) {
  return api<{ id: string; missingReports: number; threshold: number; removed: boolean }>(
    `/dustbins/${binId}/report-missing`,
    { method: "POST", body: at }
  );
}

export function reportIssue(binId: string, type: IssueType, at: LatLng, note?: string) {
  return api<{ id: string; issues: BinIssue[] }>(`/dustbins/${binId}/issues`, {
    method: "POST",
    body: { type, lat: at.lat, lng: at.lng, ...(note && { note }) },
  });
}

export function resolveIssue(binId: string, type: IssueType, at: LatLng) {
  return api<{ id: string; resolved: number; issues: BinIssue[] }>(`/dustbins/${binId}/issues/resolve`, {
    method: "POST",
    body: { type, lat: at.lat, lng: at.lng },
  });
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "5 minutes ago", "yesterday"
export function timeAgo(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -60 * 24) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / 60 / 24), "day");
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
