"use client";

import {
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  CheckCircle2Icon,
  CornerUpLeftIcon,
  CornerUpRightIcon,
  ExternalLinkIcon,
  FlagIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { directionsUrl, formatDistance, metresBetween, walkMinutes, type Bin, type LatLng } from "@/lib/bins";
import { routeProgress, stepPoint, type Turn, type WalkRoute } from "@/lib/routes";
import { TypeBadges } from "./BinPanel";

const TURN_ICON: Record<Turn, LucideIcon> = {
  depart: ArrowUpIcon,
  straight: ArrowUpIcon,
  left: CornerUpLeftIcon,
  right: CornerUpRightIcon,
  "slight-left": ArrowUpLeftIcon,
  "slight-right": ArrowUpRightIcon,
  uturn: Undo2Icon,
  arrive: FlagIcon,
};

// Close enough to see the bin, and the same distance the app needs for a missing report
export const ARRIVED_WITHIN_M = 20;

export function NavigationPanel({
  bin,
  route,
  you,
  onEnd,
}: {
  bin: Bin;
  route: WalkRoute | null;
  you: LatLng | null;
  onEnd: () => void;
}) {
  const toBin = you ? metresBetween(you, bin) : null;
  const arrived = toBin !== null && toBin <= ARRIVED_WITHIN_M;
  const progress = route && you ? routeProgress(route, you) : null;
  const remaining = progress?.remaining ?? toBin ?? route?.distance ?? 0;
  const next = progress?.next ?? null;
  const NextIcon = next ? TURN_ICON[next.turn] : ArrowUpIcon;

  return (
    <>
      {/* Next instruction */}
      {!arrived && (
        <section
          aria-live="polite"
          className="absolute inset-x-3 top-3 z-20 flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sheet md:right-auto md:left-4 md:w-100"
        >
          {route && next ? (
            <>
              <NextIcon className="size-9 shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                {you && next.turn !== "depart" && (
                  <p className="font-heading text-2xl font-bold">{formatDistance(metresBetween(you, stepPoint(route, next)))}</p>
                )}
                <p className="text-lg leading-snug">{next.text}</p>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-3 text-lg">
              <Spinner /> Finding a walking route…
            </p>
          )}
        </section>
      )}

      {/* Trip summary, or arrival */}
      <section className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 rounded-t-3xl bg-card p-5 shadow-sheet md:inset-auto md:bottom-4 md:left-4 md:w-100 md:rounded-2xl">
        {arrived ? (
          <>
            <div className="flex items-start gap-3">
              <CheckCircle2Icon className="mt-0.5 size-7 shrink-0 text-wet" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h2 className="text-2xl">You&apos;ve arrived</h2>
                <p className="text-muted-foreground">
                  {bin.name} should be within {ARRIVED_WITHIN_M} m of you. Can&apos;t see it, or something&apos;s wrong with it? Tap Done, then Report a problem.
                </p>
              </div>
            </div>
            <Button size="xl" onClick={onEnd}>
              Done
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <h2 className="truncate text-xl">{bin.name}</h2>
                <TypeBadges type={bin.type} />
              </div>
              <div className="shrink-0 text-right">
                <p className="font-heading text-3xl leading-none font-bold">{formatDistance(remaining)}</p>
                <p className="mt-1 text-muted-foreground">{walkMinutes(remaining)} min walk</p>
              </div>
            </div>
            {route?.provider === "direct" && (
              <p className="text-sm text-muted-foreground">Walking routes are unavailable right now, so this is a straight line. Stick to paths and roads.</p>
            )}
            <div className="flex gap-2">
              <Button size="xl" variant="secondary" className="flex-1" onClick={onEnd}>
                End
              </Button>
              <Button
                size="xl"
                variant="outline"
                render={<a href={directionsUrl(bin)} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <ExternalLinkIcon data-icon="inline-start" />
                Google Maps
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
