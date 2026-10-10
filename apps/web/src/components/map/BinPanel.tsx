"use client";

import { AlertCircleIcon, CheckCircle2Icon, FlagIcon, NavigationIcon } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Logo } from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  currentPosition,
  directionsUrl,
  formatDistance,
  reportMissing,
  TYPE_LABEL,
  walkMinutes,
  type Bin,
  type BinType,
} from "@/lib/bins";

export function TypeBadges({ type }: { type: BinType }) {
  return (
    <div className="flex gap-1.5">
      {type !== "DRY" && <Badge variant="wet">Wet</Badge>}
      {type !== "WET" && <Badge variant="dry">Dry</Badge>}
    </div>
  );
}

function TypeDot({ type }: { type: BinType }) {
  const bg = type === "WET" ? "bg-wet" : type === "DRY" ? "bg-dry" : "bg-[linear-gradient(90deg,var(--wet)_50%,var(--dry)_50%)]";
  return <span className={`size-3 shrink-0 rounded-full ${bg}`} aria-hidden="true" />;
}

type Outcome = { tone: "ok" | "error"; text: string } | null;

function SelectedBin({ bin, onReported }: { bin: Bin; onReported: (removed: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  async function report() {
    setBusy(true);
    try {
      const at = await currentPosition();
      const r = await reportMissing(bin.id, at);
      setOutcome({
        tone: "ok",
        text: r.removed
          ? "Reported. This bin had enough reports and is now off the map."
          : `Reported. ${r.missingReports} of ${r.threshold} reports needed to take it off the map.`,
      });
      onReported(r.removed);
    } catch (err) {
      setOutcome({ tone: "error", text: err instanceof Error ? err.message : "Couldn't send the report. Try again." });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs from the API */}
        <img src={bin.imageUrl} alt={`Photo of ${bin.name}`} className="size-24 shrink-0 rounded-xl bg-muted object-cover" />
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <h2 className="truncate text-xl leading-tight">{bin.name}</h2>
          <TypeBadges type={bin.type} />
          {bin.missingReports > 0 && (
            <p className="text-sm text-muted-foreground">
              {bin.missingReports === 1 ? "1 person reported it missing" : `${bin.missingReports} people reported it missing`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-heading text-3xl font-bold">{formatDistance(bin.distance)}</span>
        <span className="text-muted-foreground">{walkMinutes(bin.distance)} min walk</span>
      </div>

      {outcome && (
        <Alert variant={outcome.tone === "error" ? "destructive" : "default"}>
          {outcome.tone === "error" ? <AlertCircleIcon /> : <CheckCircle2Icon />}
          <AlertDescription>{outcome.text}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        <Button size="xl" className="flex-1" render={<a href={directionsUrl(bin)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
          <NavigationIcon data-icon="inline-start" />
          Directions
        </Button>
        <Button size="xl" variant="secondary" onClick={() => setConfirming(true)}>
          <FlagIcon data-icon="inline-start" />
          Report missing
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this bin as missing?</AlertDialogTitle>
            <AlertDialogDescription>
              Only report it if you&apos;re at the spot and the bin isn&apos;t there. You need to be within 20 metres. After enough
              reports, it comes off the map.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={report}>
              {busy && <Spinner data-icon="inline-start" />}
              Report missing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Bottom sheet on phones, floating side panel on wider screens
export function BinPanel({
  bins,
  selected,
  onSelect,
  onReported,
  loading,
}: {
  bins: Bin[];
  selected: Bin | null;
  onSelect: (id: string) => void;
  onReported: (removed: boolean) => void;
  loading: boolean;
}) {
  const others = bins.filter((b) => b.id !== selected?.id);
  return (
    <section
      aria-label="Nearby bins"
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[46dvh] flex-col rounded-t-3xl bg-card shadow-sheet md:inset-y-4 md:right-auto md:left-4 md:max-h-none md:w-[400px] md:rounded-2xl"
    >
      <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-accent md:hidden" aria-hidden="true" />
      <div className="flex flex-col gap-5 overflow-y-auto p-5 pt-4 md:pt-5">
        <div className="hidden md:block">
          <Logo href="/" />
        </div>
        {loading && (
          <div className="flex items-center gap-3 py-6 text-muted-foreground">
            <Spinner /> Finding bins near you…
          </div>
        )}

        {!loading && bins.length === 0 && (
          <div className="flex flex-col gap-1 py-2">
            <h2 className="text-xl">No bins mapped here yet</h2>
            <p className="text-muted-foreground">Spotted one nearby? Add it and it&apos;ll show up for everyone.</p>
          </div>
        )}

        {selected && <SelectedBin key={selected.id} bin={selected} onReported={onReported} />}

        {!loading && others.length > 0 && (
          <div className="flex flex-col">
            <h3 className="pb-2 font-medium">{selected ? "Other bins nearby" : "Nearest bins"}</h3>
            <ul className="flex flex-col">
              {others.map((bin) => (
                <li key={bin.id} className="border-t border-border first:border-0">
                  <button
                    type="button"
                    onClick={() => onSelect(bin.id)}
                    className="flex w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TypeDot type={bin.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{bin.name}</span>
                      <span className="block text-sm text-muted-foreground">{TYPE_LABEL[bin.type]}</span>
                    </span>
                    <span className="font-medium">{formatDistance(bin.distance)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
