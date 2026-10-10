// Self-check for routeProgress. Run: npx tsx src/lib/routes.check.ts
import assert from "node:assert/strict";
import { routeProgress, type WalkRoute } from "./routes";

// An L-shaped walk: ~111 m north, then a right turn and ~98 m east (at 28.6° N)
const route: WalkRoute = {
  line: [
    [77.2, 28.6],
    [77.2, 28.601],
    [77.201, 28.601],
  ],
  distance: 209,
  duration: 160,
  steps: [
    { text: "Head north", turn: "depart", index: 0 },
    { text: "Turn right", turn: "right", index: 1 },
    { text: "Arrive at the bin", turn: "arrive", index: 2 },
  ],
  provider: "osm",
};

const near = (actual: number, expected: number, tol = 3) => assert.ok(Math.abs(actual - expected) <= tol, `${actual} not ~${expected}`);

// At the start: whole route left, on the route, next step is the turn
let p = routeProgress(route, { lat: 28.6, lng: 77.2 });
near(p.remaining, 209);
near(p.offRoute, 0);
assert.equal(p.next?.turn, "right");

// Halfway up the first leg, 20 m to the west of it: half the first leg + second leg left, 20 m off route
p = routeProgress(route, { lat: 28.6005, lng: 77.2 - 20 / (111320 * Math.cos((28.6005 * Math.PI) / 180)) });
near(p.remaining, 55.6 + 97.7);
near(p.offRoute, 20);
assert.equal(p.next?.turn, "right");

// Past the corner, on the second leg: next step is arriving
p = routeProgress(route, { lat: 28.601, lng: 77.2005 });
near(p.remaining, 48.9);
assert.equal(p.next?.turn, "arrive");

console.log("routeProgress: all checks passed");
