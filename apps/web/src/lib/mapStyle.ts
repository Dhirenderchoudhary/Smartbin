// Which map tiles to use. Amazon Location when a key is configured, OpenFreeMap otherwise,
// and OpenFreeMap again if Amazon fails at runtime. All switching is by env, no code changes.
//
//   NEXT_PUBLIC_AWS_MAP_KEY     Amazon Location API key (v1.public...). Unset = OpenFreeMap only
//   NEXT_PUBLIC_AWS_REGION      default ap-south-1 (Mumbai)
//   NEXT_PUBLIC_AWS_MAP_STYLE   Standard | Monochrome | Hybrid | Satellite, default Monochrome
//   NEXT_PUBLIC_MAP_STYLE_LIGHT / _DARK   fallback style URLs, default OpenFreeMap

export const AWS_KEY = process.env.NEXT_PUBLIC_AWS_MAP_KEY;
export const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-south-1";
const AWS_STYLE = process.env.NEXT_PUBLIC_AWS_MAP_STYLE ?? "Monochrome";

const FALLBACK = {
  light: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT ?? "https://tiles.openfreemap.org/styles/positron",
  dark: process.env.NEXT_PUBLIC_MAP_STYLE_DARK ?? "https://tiles.openfreemap.org/styles/dark",
};

export type MapProvider = "aws" | "fallback";

export function awsStyleUrl(dark: boolean): string {
  const params = new URLSearchParams({ key: AWS_KEY ?? "", "color-scheme": dark ? "Dark" : "Light", "political-view": "IND" });
  return `https://maps.geo.${AWS_REGION}.amazonaws.com/v2/styles/${AWS_STYLE}/descriptor?${params}`;
}

export function styleUrl(provider: MapProvider, dark: boolean): string {
  return provider === "aws" ? awsStyleUrl(dark) : dark ? FALLBACK.dark : FALLBACK.light;
}

// After Amazon fails, this tab skips it for a while instead of failing on every page
const FAILED_KEY = "smartbin.awsMapFailedAt";
const RETRY_AFTER_MS = 10 * 60 * 1000;

export function initialProvider(): MapProvider {
  if (!AWS_KEY) return "fallback";
  try {
    const failedAt = Number(sessionStorage.getItem(FAILED_KEY));
    if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return "fallback";
  } catch {
    // storage blocked: just try Amazon
  }
  return "aws";
}

export function rememberAwsFailure(): void {
  try {
    sessionStorage.setItem(FAILED_KEY, String(Date.now()));
  } catch {
    // storage blocked: fallback still applies to this map
  }
}

// A maplibre error that means Amazon can't serve us: bad/expired/restricted key, throttling,
// server errors or no connection. Empty tiles (204/404) are normal and don't count.
export function isAwsFailure(error: unknown): boolean {
  const e = error as { status?: number; url?: string; message?: string } | undefined;
  const fromAws = (e?.url ?? e?.message ?? "").includes("amazonaws.com");
  if (!fromAws) return false;
  const status = e?.status ?? 0;
  return status === 0 || status === 401 || status === 403 || status === 429 || status >= 500;
}

// Amazon has this long to deliver the style before we switch
export const AWS_LOAD_TIMEOUT_MS = 8000;
