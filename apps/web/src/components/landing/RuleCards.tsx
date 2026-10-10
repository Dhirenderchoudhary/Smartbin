"use client";

// The three rules that keep the map honest, each as a big number and a diagram that acts it out
// when the card scrolls into view (hover replays it). Without JavaScript, or before the card is
// near, the diagram shows its end state.
import { m, useInView, type Variants } from "motion/react";
import { useRef, useState } from "react";
import { Pin, PinClips } from "./illustrations";
import { useFinePointer } from "./Motion";

type Rule = "spacing" | "nearby" | "reports";

const RULES: { rule: Rule; figure: string; unit: string; title: string; body: string; label: string }[] = [
  {
    rule: "spacing",
    figure: "15",
    unit: "m between bins",
    title: "One bin per spot",
    body: "If a bin is already on the map within 15 metres, a second one can't be added on top of it.",
    label: "A bin is on the map. A second one dropped 9 metres away is refused, because it's inside the 15 metre circle.",
  },
  {
    rule: "nearby",
    figure: "20",
    unit: "m from the bin",
    title: "Report from the spot",
    body: "To report a bin as missing, you have to be standing within 20 metres of where it should be.",
    label: "You walk towards a bin. Once you're inside its 20 metre circle, you can report it.",
  },
  {
    rule: "reports",
    figure: "3",
    unit: "reports and it's gone",
    title: "Three reports and it's gone",
    body: "When three different people report a bin missing, it comes off the map. If it's still there, anyone can add it back.",
    label: "Three people report a bin missing, one after another, and it disappears from the map.",
  },
];

// "off" is the start of the story and happens instantly; "on" plays it
const instant = { duration: 0 };
const pop = (delay: number): Variants => ({
  off: { scale: 0, opacity: 0, transition: instant },
  on: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18, delay } },
});
const fadeIn = (delay: number): Variants => ({
  off: { opacity: 0, transition: instant },
  on: { opacity: 1, transition: { duration: 0.35, delay } },
});
const fadeOut = (delay: number): Variants => ({
  off: { opacity: 1, transition: instant },
  on: { opacity: 0, transition: { duration: 0.3, delay } },
});
const centre = { transformBox: "fill-box", transformOrigin: "50% 50%" } as const;

function Spacing() {
  return (
    <>
      <m.circle cx={150} cy={104} r={72} className="fill-foreground/5 stroke-foreground/60" strokeDasharray="5 6" strokeWidth={2} style={centre} variants={pop(0)} />
      <line x1={150} y1={104} x2={222} y2={104} className="stroke-foreground" strokeWidth={2} />
      <text x={190} y={95} textAnchor="middle" className="fill-foreground text-[15px] font-bold">15 m</text>
      <Pin x={150} y={104} type="WET" />
      {/* A second bin drops in 9 m away and is refused */}
      <m.g
        variants={{
          off: { y: -90, opacity: 0, transition: instant },
          on: { y: [-90, 0, 0, 0], opacity: [0, 1, 1, 0.35], transition: { duration: 1.6, delay: 0.5, times: [0, 0.35, 0.7, 1] } },
        }}
      >
        <Pin x={112} y={150} type="DRY" />
      </m.g>
      <m.path d="M102 116 l20 20 M122 116 l-20 20" className="stroke-destructive" strokeWidth={4} strokeLinecap="round" style={centre} variants={pop(1.25)} />
      <m.text x={150} y={204} textAnchor="middle" className="fill-destructive text-[14px] font-semibold" variants={fadeIn(1.35)}>
        Already a bin 9 m away
      </m.text>
    </>
  );
}

function Nearby() {
  return (
    <>
      <circle cx={170} cy={104} r={66} className="fill-foreground/5 stroke-foreground/60" strokeDasharray="5 6" strokeWidth={2} />
      {/* Turns green once you're inside */}
      <m.circle cx={170} cy={104} r={66} className="fill-wet/10 stroke-wet" strokeWidth={3} variants={fadeIn(1.7)} />
      <line x1={170} y1={104} x2={236} y2={104} className="stroke-foreground" strokeWidth={2} />
      <text x={206} y={95} textAnchor="middle" className="fill-foreground text-[15px] font-bold">20 m</text>
      <Pin x={170} y={104} type="DRY" />
      {/* You, walking over */}
      <m.circle
        r={9}
        className="fill-foreground stroke-background"
        strokeWidth={3}
        variants={{
          off: { cx: 34, cy: 176, transition: instant },
          on: { cx: 196, cy: 140, transition: { duration: 1.4, delay: 0.3, ease: [0.4, 0, 0.2, 1] } },
        }}
      />
      <m.text x={150} y={204} textAnchor="middle" className="fill-muted-foreground text-[14px] font-semibold" variants={fadeOut(1.6)}>
        Too far to report
      </m.text>
      <m.text x={150} y={204} textAnchor="middle" className="fill-wet text-[14px] font-semibold" variants={fadeIn(1.75)}>
        Close enough to report
      </m.text>
    </>
  );
}

function Reports() {
  return (
    <>
      <m.g
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
        variants={{
          off: { opacity: 1, scale: 1, transition: instant },
          on: { opacity: 0.2, scale: 0.85, transition: { duration: 0.5, delay: 1.7 } },
        }}
      >
        <Pin x={150} y={150} type="WET" />
      </m.g>
      {[
        [92, 76],
        [150, 52],
        [208, 76],
      ].map(([x, y], i) => (
        <m.g key={x} style={centre} variants={pop(0.35 + i * 0.4)}>
          <circle cx={x} cy={y} r={16} className="fill-destructive" />
          <text x={x} y={y + 5.5} textAnchor="middle" className="fill-white text-[15px] font-bold">
            {i + 1}
          </text>
        </m.g>
      ))}
      <m.text x={150} y={204} textAnchor="middle" className="fill-muted-foreground text-[14px] font-semibold" variants={fadeIn(1.9)}>
        Removed from the map
      </m.text>
    </>
  );
}

function RuleCard({ rule, figure, unit, title, body, label }: (typeof RULES)[number]) {
  const ref = useRef<HTMLElement>(null);
  const fine = useFinePointer();
  // Reset just before the card comes into view, play once it's mostly visible
  const near = useInView(ref, { once: true, margin: "0px 0px 300px 0px" });
  const seen = useInView(ref, { once: true, amount: 0.55 });
  const [replay, setReplay] = useState(0);
  const state = seen || replay ? "on" : near ? "off" : "on";

  return (
    <article ref={ref} className="flex flex-col overflow-hidden rounded-3xl bg-muted" onPointerEnter={() => fine && seen && setReplay((r) => r + 1)}>
      <p className="flex items-baseline gap-2 px-6 pt-6">
        <span className="font-heading text-6xl leading-none font-bold tabular-nums">{figure}</span>
        <span className="text-lg text-muted-foreground">{unit}</span>
      </p>
      <svg viewBox="0 0 300 220" className="mt-2 block h-auto w-full" role="img" aria-label={label}>
        <PinClips />
        <m.g key={replay} initial={replay ? "off" : false} animate={state}>
          {rule === "spacing" ? <Spacing /> : rule === "nearby" ? <Nearby /> : <Reports />}
        </m.g>
      </svg>
      <div className="flex flex-col gap-1.5 px-6 pt-2 pb-7">
        <h3 className="text-xl font-bold">{title}</h3>
        <p className="leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

export function RuleCards() {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {RULES.map((r) => (
        <RuleCard key={r.rule} {...r} />
      ))}
    </div>
  );
}
