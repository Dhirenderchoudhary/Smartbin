"use client";

import { AlertCircleIcon, AlertTriangleIcon, CheckCircle2Icon, CheckIcon, FlagIcon, NavigationIcon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api";
import {
  currentPosition,
  formatDistance,
  ISSUE_LABEL,
  ISSUE_RADIUS_M,
  reportIssue,
  reportMissing,
  resolveIssue,
  timeAgo,
  TYPE_LABEL,
  walkMinutes,
  type Bin,
  type BinIssue,
  type BinType,
  type IssueType,
  type LatLng,
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

// "Missing" goes through its own endpoint (enough reports take the bin off the map)
type Problem = IssueType | "MISSING";

const PROBLEMS: { value: Problem; title: string; hint: string }[] = [
  { value: "FULL", title: "It's full", hint: "Overflowing, or no room for more" },
  { value: "BROKEN", title: "It's broken", hint: "Damaged, lid missing or knocked over" },
  { value: "DIRTY", title: "It's dirty", hint: "Smelly, or rubbish dumped around it" },
  { value: "MISSING", title: "It's not here", hint: "The bin is gone. After enough reports it comes off the map." },
  { value: "OTHER", title: "Something else", hint: "Tell people what's wrong" },
];

// What the "it's sorted" button says for each problem
const SORTED: Record<IssueType, string> = { FULL: "Emptied", BROKEN: "Fixed", DIRTY: "Cleaned", OTHER: "Sorted" };

type Outcome = { tone: "ok" | "error"; text: string } | null;

function errorText(err: unknown, radius: number): string {
  if (err instanceof ApiError && err.code === "TOO_FAR") return `You need to be within ${radius} m of the bin. Walk over and try again.`;
  return err instanceof Error ? err.message : "Couldn't send that. Try again.";
}

function IssueList({ bin, busy, onSorted }: { bin: Bin; busy: IssueType | null; onSorted: (type: IssueType) => void }) {
  return (
    <ul className="flex flex-col gap-2" aria-label="Problems reported">
      {bin.issues.map((issue: BinIssue) => (
        <li key={issue.type} className="flex items-center gap-3 rounded-2xl bg-warning/20 p-3">
          <AlertTriangleIcon className="size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{issue.type === "OTHER" && issue.note ? issue.note : ISSUE_LABEL[issue.type]}</p>
            <p className="text-sm text-muted-foreground">
              Reported {timeAgo(issue.lastReportedAt)}
              {issue.reports > 1 && `, by ${issue.reports} people`}
            </p>
          </div>
          <Button variant="secondary" disabled={!!busy} onClick={() => onSorted(issue.type)} aria-label={`Mark as ${SORTED[issue.type].toLowerCase()}`}>
            {busy === issue.type ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            {SORTED[issue.type]}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function SelectedBin({
  bin,
  you,
  onReported,
  onIssues,
  onNavigate,
}: {
  bin: Bin;
  you: LatLng | null;
  onReported: (removed: boolean) => void;
  onIssues: (binId: string, issues: BinIssue[]) => void;
  onNavigate: (bin: Bin) => void;
}) {
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sorting, setSorting] = useState<IssueType | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  // The map is already tracking you; only wait for a fresh GPS fix if it isn't yet
  const here = async () => you ?? (await currentPosition());

  function openReport() {
    setProblem(null);
    setNote("");
    setOpen(true);
  }

  async function send() {
    if (!problem) return;
    setBusy(true);
    try {
      const at = await here();
      if (problem === "MISSING") {
        const r = await reportMissing(bin.id, at);
        setOutcome({
          tone: "ok",
          text: r.removed
            ? "Reported. This bin had enough reports and is now off the map."
            : `Reported. ${r.missingReports} of ${r.threshold} reports needed to take it off the map.`,
        });
        onReported(r.removed);
      } else {
        const r = await reportIssue(bin.id, problem, at, note.trim());
        onIssues(bin.id, r.issues);
        setOutcome({ tone: "ok", text: "Reported. People nearby will see it before they walk over." });
      }
    } catch (err) {
      setOutcome({ tone: "error", text: errorText(err, problem === "MISSING" ? 20 : ISSUE_RADIUS_M) });
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function sorted(type: IssueType) {
    setSorting(type);
    try {
      const r = await resolveIssue(bin.id, type, await here());
      onIssues(bin.id, r.issues);
      setOutcome({ tone: "ok", text: "Thanks for letting everyone know." });
    } catch (err) {
      setOutcome({ tone: "error", text: errorText(err, ISSUE_RADIUS_M) });
    } finally {
      setSorting(null);
    }
  }

  const missing = problem === "MISSING";
  const ready = problem && (problem !== "OTHER" || note.trim());

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

      {bin.issues.length > 0 && <IssueList bin={bin} busy={sorting} onSorted={sorted} />}

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

      <div className="flex flex-wrap gap-2">
        <Button size="xl" className="min-w-32 flex-1" onClick={() => onNavigate(bin)}>
          <NavigationIcon data-icon="inline-start" />
          Directions
        </Button>
        <Button size="xl" variant="secondary" className="flex-1" onClick={openReport}>
          <FlagIcon data-icon="inline-start" />
          Report a problem
        </Button>
      </div>

      <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto data-[size=default]:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>What&apos;s wrong with this bin?</AlertDialogTitle>
            <AlertDialogDescription>
              Report it from the spot. You need to be within {missing ? 20 : ISSUE_RADIUS_M} m of the bin.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Problem</legend>
            {PROBLEMS.map((p) => (
              <label
                key={p.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted p-3 has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
              >
                <input
                  type="radio"
                  name="problem"
                  value={p.value}
                  checked={problem === p.value}
                  onChange={() => setProblem(p.value)}
                  className="peer sr-only"
                />
                <span className="flex flex-col text-left">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-sm opacity-75">{p.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {problem === "OTHER" && (
            <Input
              autoFocus
              aria-label="What's wrong"
              placeholder="e.g. Blocked by a parked cart"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={missing ? "destructive" : "default"} disabled={busy || !ready} onClick={send}>
              {busy && <Spinner data-icon="inline-start" />}
              {missing ? "Report missing" : "Send report"}
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
  you,
  selected,
  onSelect,
  onReported,
  onIssues,
  onNavigate,
  loading,
}: {
  bins: Bin[];
  you: LatLng | null;
  selected: Bin | null;
  onSelect: (id: string) => void;
  onReported: (removed: boolean) => void;
  onIssues: (binId: string, issues: BinIssue[]) => void;
  onNavigate: (bin: Bin) => void;
  loading: boolean;
}) {
  // The map can hold hundreds after zooming out; the list keeps to the nearest
  const others = bins.filter((b) => b.id !== selected?.id).slice(0, 25);
  return (
    <section
      aria-label="Nearby bins"
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[46dvh] flex-col rounded-t-3xl bg-card shadow-sheet md:inset-y-4 md:right-auto md:left-4 md:max-h-none md:w-100 md:rounded-2xl"
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

        {selected && <SelectedBin key={selected.id} bin={selected} you={you} onReported={onReported} onIssues={onIssues} onNavigate={onNavigate} />}

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
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {TYPE_LABEL[bin.type]}
                        {bin.issues.length > 0 && <Badge variant="warning">{ISSUE_LABEL[bin.issues[0].type]}</Badge>}
                      </span>
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
