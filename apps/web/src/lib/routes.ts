// Walking routes, with the same fallback idea as the map tiles:
// Amazon Location Routes (when the key allows it) -> OpenStreetMap walking router -> straight line.
//
//   NEXT_PUBLIC_AWS_MAP_KEY       also used for Routes if the key has geo-routes access
//   NEXT_PUBLIC_OSM_ROUTING_URL   default https://routing.openstreetmap.de/routed-foot (FOSSGIS, fair use)
//
// ponytail: the FOSSGIS router is a free community service with a fair-use policy; fine for a
// hackathon and light use, switch production traffic to Amazon Routes (or a self-hosted OSRM).

import { metresBetween, type LatLng } from "./bins";
import { AWS_KEY, AWS_REGION } from "./mapStyle";

const OSM_ROUTING_URL = process.env.NEXT_PUBLIC_OSM_ROUTING_URL ?? "https://routing.openstreetmap.de/routed-foot";
const TIMEOUT_MS = 8000;
const WALK_M_PER_S = 1.3;

export type Turn = "depart" | "straight" | "left" | "right" | "slight-left" | "slight-right" | "uturn" | "arrive";

export interface RouteStep {
  text: string;
  turn: Turn;
  /** Index of the route point where this step starts */
  index: number;
}

export interface WalkRoute {
  /** [lng, lat] points from you to the bin */
  line: [number, number][];
  distance: number;
  duration: number;
  steps: RouteStep[];
  provider: "aws" | "osm" | "direct";
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

function bearing(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

// Both providers give instruction text; read the turn direction from it for the icon
function turnFromText(text: string): Turn {
  const t = text.toLowerCase();
  if (/arriv|destination/.test(t)) return "arrive";
  if (/u-?turn|turn around/.test(t)) return "uturn";
  if (/slight left|bear left|keep left/.test(t)) return "slight-left";
  if (/slight right|bear right|keep right/.test(t)) return "slight-right";
  if (/left/.test(t)) return "left";
  if (/right/.test(t)) return "right";
  return "straight";
}

const nearestIndex = (line: [number, number][], [lng, lat]: [number, number]) =>
  line.reduce((best, p, i) => (metresBetween({ lat, lng }, { lat: p[1], lng: p[0] }) < metresBetween({ lat, lng }, { lat: line[best][1], lng: line[best][0] }) ? i : best), 0);

async function amazonRoute(from: LatLng, to: LatLng): Promise<WalkRoute> {
  const res = await fetch(`https://routes.geo.${AWS_REGION}.amazonaws.com/v2/routes?key=${AWS_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      Origin: [from.lng, from.lat],
      Destination: [to.lng, to.lat],
      TravelMode: "Pedestrian",
      LegGeometryFormat: "Simple",
      TravelStepType: "TurnByTurn",
    }),
  });
  if (!res.ok) throw new Error(`Amazon Routes ${res.status}`);
  const route = (await res.json()).Routes?.[0];
  const leg = route?.Legs?.[0];
  const line: [number, number][] = leg?.Geometry?.LineString;
  if (!line?.length) throw new Error("Amazon Routes returned no route");
  const steps: RouteStep[] = (leg.PedestrianLegDetails?.TravelSteps ?? [])
    .filter((s: { Instruction?: string }) => s.Instruction)
    .map((s: { Instruction: string; GeometryOffset?: number }) => ({
      text: s.Instruction,
      turn: turnFromText(s.Instruction),
      index: s.GeometryOffset ?? 0,
    }));
  return { line, distance: route.Summary?.Distance ?? 0, duration: route.Summary?.Duration ?? 0, steps, provider: "aws" };
}

interface OsmStep {
  name: string;
  maneuver: { type: string; modifier?: string; bearing_after: number; location: [number, number] };
}

function osmText({ name, maneuver: m }: OsmStep): string {
  if (m.type === "depart") return `Head ${compass(m.bearing_after)}${name ? ` on ${name}` : ""}`;
  if (m.type === "arrive") return "Arrive at the bin";
  const verb: Record<string, string> = {
    left: "Turn left",
    right: "Turn right",
    "slight left": "Bear left",
    "slight right": "Bear right",
    "sharp left": "Turn sharp left",
    "sharp right": "Turn sharp right",
    uturn: "Turn around",
    straight: "Continue straight",
  };
  return `${verb[m.modifier ?? ""] ?? "Continue"}${name ? ` onto ${name}` : ""}`;
}

async function osmRoute(from: LatLng, to: LatLng): Promise<WalkRoute> {
  const url = `${OSM_ROUTING_URL}/route/v1/foot/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`OSM routing ${res.status}`);
  const route = (await res.json()).routes?.[0];
  if (!route) throw new Error("OSM routing returned no route");
  const line: [number, number][] = route.geometry.coordinates;
  const steps: RouteStep[] = route.legs[0].steps.map((s: OsmStep) => {
    const text = osmText(s);
    return { text, turn: s.maneuver.type === "depart" ? "depart" : turnFromText(text), index: nearestIndex(line, s.maneuver.location) };
  });
  return { line, distance: route.distance, duration: route.duration, steps, provider: "osm" };
}

function directRoute(from: LatLng, to: LatLng): WalkRoute {
  const distance = metresBetween(from, to);
  return {
    line: [
      [from.lng, from.lat],
      [to.lng, to.lat],
    ],
    distance,
    duration: distance / WALK_M_PER_S,
    steps: [{ text: `Walk ${compass(bearing(from, to))} to the bin`, turn: "depart", index: 0 }],
    provider: "direct",
  };
}

// Skip Amazon for the rest of the session once it fails (e.g. the key has no Routes access)
let amazonFailed = false;

export async function walkingRoute(from: LatLng, to: LatLng): Promise<WalkRoute> {
  if (AWS_KEY && !amazonFailed) {
    try {
      return await amazonRoute(from, to);
    } catch (err) {
      amazonFailed = true;
      console.warn("Amazon Location Routes unavailable; using OpenStreetMap routing.", err);
    }
  }
  try {
    return await osmRoute(from, to);
  } catch (err) {
    console.warn("OpenStreetMap routing unavailable; showing a straight line.", err);
    return directRoute(from, to);
  }
}

// Where you are along the route: distance left, how far off the route you are, and the next step
export function routeProgress(route: WalkRoute, you: LatLng): { remaining: number; offRoute: number; next: RouteStep | null } {
  const pt = (p: [number, number]): LatLng => ({ lat: p[1], lng: p[0] });
  const { line } = route;

  // Closest segment, using a flat projection (fine over a walk of a few km)
  const kx = 111320 * Math.cos((you.lat * Math.PI) / 180);
  const ky = 110540;
  let best = { seg: 0, t: 0, dist: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - you.lng) * kx, ay = (line[i][1] - you.lat) * ky;
    const bx = (line[i + 1][0] - you.lng) * kx, by = (line[i + 1][1] - you.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    const dist = Math.hypot(ax + t * dx, ay + t * dy);
    if (dist < best.dist) best = { seg: i, t, dist };
  }
  if (line.length < 2) return { remaining: metresBetween(you, pt(line[0])), offRoute: 0, next: route.steps[0] ?? null };

  let remaining = metresBetween(pt(line[best.seg]), pt(line[best.seg + 1])) * (1 - best.t);
  for (let i = best.seg + 1; i < line.length - 1; i++) remaining += metresBetween(pt(line[i]), pt(line[i + 1]));

  const next = route.steps.find((s) => s.index > best.seg) ?? route.steps.at(-1) ?? null;
  return { remaining, offRoute: best.dist, next };
}

export function stepPoint(route: WalkRoute, step: RouteStep): LatLng {
  const p = route.line[Math.min(step.index, route.line.length - 1)];
  return { lat: p[1], lng: p[0] };
}
