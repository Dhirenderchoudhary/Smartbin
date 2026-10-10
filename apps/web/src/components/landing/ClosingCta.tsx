"use client";

// The closing call to action, shaped like the app's "Where is the bin?" step: the pin stays in the
// middle and the map slides under it as the cursor moves, the way you place a new bin.
import { Trash2Icon } from "lucide-react";
import { m, useReducedMotion, useSpring } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pin, PinClips, Streets } from "./illustrations";
import { Magnetic, Reveal, useFinePointer } from "./Motion";

export function ClosingCta({ display }: { display: string }) {
  const panel = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 140, damping: 22 });
  const y = useSpring(0, { stiffness: 140, damping: 22 });
  const [moving, setMoving] = useState(false);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  function follow(e: React.PointerEvent) {
    if (!fine || reduce || !panel.current) return;
    const r = panel.current.getBoundingClientRect();
    // Dragging the map: it moves the opposite way to where you point
    x.set(-((e.clientX - r.left) / r.width - 0.5) * 120);
    y.set(-((e.clientY - r.top) / r.height - 0.5) * 90);
    setMoving(true);
    clearTimeout(settle.current);
    settle.current = setTimeout(() => setMoving(false), 220);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <div
        ref={panel}
        onPointerMove={follow}
        className="grid overflow-hidden rounded-[2rem] bg-muted md:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="flex flex-col items-start gap-6 p-8 sm:p-12">
          <Reveal>
            <h2 className={`${display} max-w-[14ch] text-5xl sm:text-6xl`}>Seen a bin that isn&apos;t on the map?</h2>
          </Reveal>
          <p className="max-w-[38ch] text-lg leading-relaxed text-muted-foreground">
            Add it from where you&apos;re standing: drop the pin, take a photo, choose wet or dry. The next person looking for a bin
            will find it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Magnetic>
              <Button size="xl" render={<Link href="/app/add" />} nativeButton={false}>
                Add a bin
              </Button>
            </Magnetic>
            <Button size="xl" variant="outline" render={<Link href="/app" />} nativeButton={false}>
              Find bins near me
            </Button>
          </div>
        </div>

        {/* A map window with the add-a-bin pin fixed in the middle */}
        <div className="relative min-h-72 overflow-hidden bg-map md:min-h-0" aria-hidden="true">
          <m.svg viewBox="0 0 600 500" preserveAspectRatio="xMidYMid slice" className="absolute -inset-16 h-[calc(100%+8rem)] w-[calc(100%+8rem)]" style={{ x, y }}>
            <PinClips />
            <Streets />
            <Pin x={120} y={150} type="DRY" />
            <Pin x={470} y={226} type="WET" />
            <Pin x={88} y={404} type="WET" />
            <Pin x={540} y={316} type="BOTH" />
          </m.svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center">
              <m.div
                animate={{ y: moving ? -10 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="flex flex-col items-center"
              >
                <span className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-sheet">
                  <Trash2Icon className="size-6" />
                </span>
                <span className="h-4 w-1 rounded-b bg-primary" />
              </m.div>
              <m.span
                animate={{ scale: moving ? 0.6 : 1, opacity: moving ? 0.5 : 1 }}
                className="size-3 rounded-full bg-primary ring-4 ring-primary/15"
              />
            </div>
          </div>
          <p className="absolute inset-x-4 bottom-4 rounded-2xl bg-card px-4 py-3 text-sm shadow-float">
            <span className="font-medium">Where is the bin?</span>{" "}
            <span className="text-muted-foreground">{fine ? "Move your cursor to slide the map." : "Move the map so the pin sits on it."}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
