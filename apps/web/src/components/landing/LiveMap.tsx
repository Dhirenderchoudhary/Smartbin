"use client";

// The hero: a street map where you are wherever the cursor is (or where you tap). The nearest bin
// grows, a walking route draws to it, and the card shows how far it is. Static without JavaScript
// and with reduced motion.
import { m, useMotionTemplate, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatDistance, walkMinutes } from "@/lib/bins";
import { Pin, PinClips, Streets, type BinType } from "./illustrations";
import { useFinePointer } from "./Motion";

const BINS: { id: string; x: number; y: number; type: BinType; name: string }[] = [
  { id: "bus-stop", x: 120, y: 150, type: "DRY", name: "Bus stop, MG Road" },
  { id: "park-gate", x: 470, y: 226, type: "WET", name: "Gandhi Park gate" },
  { id: "market", x: 88, y: 404, type: "WET", name: "Market entrance" },
  { id: "station", x: 488, y: 330, type: "DRY", name: "Station Road corner" },
  { id: "metro", x: 350, y: 304, type: "BOTH", name: "Metro gate 2" },
  { id: "temple", x: 150, y: 300, type: "BOTH", name: "Temple road" },
];

const START = { x: 256, y: 380 };
// Map units to metres, so the walk to the nearest bin reads like a real one
const METRES_PER_UNIT = 0.25;

// Streets run up-down and across, so walk along one, then the other
const walk = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const nearestTo = (at: { x: number; y: number }) => BINS.reduce((best, bin) => (walk(at, bin) < walk(at, best) ? bin : best));

export function LiveMap() {
  const svg = useRef<SVGSVGElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const [you, setYou] = useState(START);
  const [moved, setMoved] = useState(false);
  const target = nearestTo(you);

  // Your dot and the route's end glide; with reduced motion they jump
  const spring = { stiffness: 170, damping: 24 };
  const x = useSpring(START.x, spring);
  const y = useSpring(START.y, spring);
  const tx = useSpring(target.x, spring);
  const ty = useSpring(target.y, spring);
  const route = useMotionTemplate`M${x} ${y} L${x} ${ty} L${tx} ${ty}`;
  const labelX = useTransform(x, (v) => v - 20);
  const labelY = useTransform(y, (v) => v + 5);

  function moveTo(clientX: number, clientY: number) {
    const ctm = svg.current?.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const at = { x: Math.round(Math.min(584, Math.max(16, p.x))), y: Math.round(Math.min(484, Math.max(40, p.y))) };
    const next = nearestTo(at);
    for (const [value, v] of [[x, at.x], [y, at.y], [tx, next.x], [ty, next.y]] as const) {
      if (reduce) value.jump(v);
      else value.set(v);
    }
    setYou(at);
    setMoved(true);
  }

  const metres = walk(you, target) * METRES_PER_UNIT;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-muted shadow-sheet">
      <svg
        ref={svg}
        viewBox="0 0 600 500"
        className="block h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label="A street map with you and six dustbins. Move the pointer or tap to move yourself; the walking route goes to the nearest bin."
        onPointerMove={(e) => e.pointerType === "mouse" && moveTo(e.clientX, e.clientY)}
        onPointerDown={(e) => moveTo(e.clientX, e.clientY)}
      >
        <PinClips />
        <Streets />

        {/* Walking route to the nearest bin; it draws again each time the nearest bin changes */}
        <m.path
          key={target.id}
          d={route}
          fill="none"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-foreground"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: moved ? 0.45 : 1.1, delay: moved ? 0 : 0.9, ease: [0.6, 0, 0.2, 1] }}
        />

        {BINS.map((bin, i) => (
          <Pin key={bin.id} x={bin.x} y={bin.y} type={bin.type} delay={0.1 + i * 0.08} active={bin.id === target.id} />
        ))}

        {/* You */}
        <m.circle cx={x} cy={y} r={20} className="fill-foreground/15" />
        <m.circle cx={x} cy={y} r={9} className="fill-foreground stroke-background" strokeWidth={3} />
        <m.text x={labelX} y={labelY} textAnchor="end" className="pointer-events-none fill-foreground text-[14px] font-bold">
          You
        </m.text>
      </svg>

      {!moved && (
        <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-float motion-safe:animate-[rise-in_.5s_ease-out_2.2s_both]">
          {fine ? "Move your cursor: that's you" : "Tap the map to move"}
        </p>
      )}

      <div className="m-3 mt-0 flex items-center justify-between gap-4 rounded-2xl bg-card p-4 shadow-sheet sm:absolute sm:top-4 sm:right-4 sm:m-0 sm:w-72 motion-safe:animate-[rise-in_.5s_ease-out_1.9s_both]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="truncate font-semibold">{target.name}</p>
          <div className="flex gap-1.5">
            {target.type !== "DRY" && <Badge variant="wet">Wet</Badge>}
            {target.type !== "WET" && <Badge variant="dry">Dry</Badge>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-heading text-3xl leading-none font-bold tabular-nums">{formatDistance(metres)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{walkMinutes(metres)} min walk</p>
        </div>
      </div>
    </div>
  );
}
