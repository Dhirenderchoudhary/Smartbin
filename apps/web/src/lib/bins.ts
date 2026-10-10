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

// Device position as a promise; rejects with a message people can act on
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser can't share your location."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) =>
        reject(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? "Location is turned off for SmartBin. Allow location in your browser settings, then try again."
              : "Couldn't find your location. Move to open sky and try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}
