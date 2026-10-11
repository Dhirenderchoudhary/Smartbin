"use client";

import { AlertCircleIcon, CheckIcon, PlayIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Me } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { TryYourPhoto } from "./TryYourPhoto";

export interface EvalResult {
  file: string;
  image: string;
  expect: "bin" | "not-bin";
  hard: boolean;
  note: string;
  source: string;
  author: string;
  licence: string;
  accepted: boolean;
  confidence: number;
  reason: string;
  ms: number;
  correct: boolean;
}

interface EvalSummary {
  total: number;
  correct: number;
  accuracy: number;
  fakes: { total: number; rejected: number };
  realBins: { total: number; accepted: number };
  hard: { total: number; correct: number };
  matrix: { binAccepted: number; binRejected: number; fakeAccepted: number; fakeRejected: number };
  avgMs: number;
  passed: boolean;
}

interface EvalData {
  latest: {
    id: string;
    provider: string;
    model: string;
    durationMs: number;
    createdAt: string;
    summary: EvalSummary;
    results: EvalResult[];
  } | null;
  runs: number;
  tries: { total: number; accepted: number; limitPerDay: number };
  currentModel: { provider: string; model: string };
}

type Filter = "all" | "fakes" | "bins" | "misses";

const LAYERS: { title: string; stops: string }[] = [
  { title: "Sign-in required (Amazon Cognito)", stops: "Anonymous spam" },
  { title: "Live camera only in the app", stops: "Gallery uploads, old or downloaded photos" },
  { title: "Upload links only for JPEG, PNG or WebP, into your own folder, for 5 minutes", stops: "Other file types, writing into someone else's folder" },
  { title: "The photo must be yours", stops: "Reusing another person's upload" },
  { title: "The file must really be an image, checked from its bytes", stops: "A text file renamed .jpg (deleted on the spot)" },
  { title: "AI check: only a purpose-made bin in a public place passes", stops: "Buckets, post boxes, hydrants, barrels, garbage piles, drawings (photo deleted)" },
  { title: "No other bin within 15 m", stops: "Registering the same bin twice" },
  { title: "Monthly limit per user, set by admins", stops: "Bulk registration from one account" },
  { title: "Missing reports only from within 20 m", stops: "Removing real bins from home" },
];

const ANTI_FAKE_CHECKS = [
  "No login → refused (401)",
  "Upload link for HTML, PDF or GIF → refused (400)",
  "Someone else's uploaded photo → refused (403)",
  "Photo that was never uploaded → refused (404)",
  "Text file disguised as a JPEG → refused and deleted (400)",
  "Photo of a plastic bucket → rejected by the AI and deleted (422)",
  "Real dustbin photo → accepted (201)",
  "Second bin 5 m away → refused as a duplicate (409)",
  "Impossible coordinates → refused (400)",
  "Missing report from 1 km away → refused (403)",
  "Only accepted bins count toward the monthly limit",
];

function timeAgo(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function EvalsView() {
  const [data, setData] = useState<EvalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setData(await api<EvalData>("/evals/vision"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the evaluation.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads data from the API (an external system)
    load();
    // Signed in? Admins get the "Run evaluation now" button; anyone signed in can try a photo
    (async () => {
      if (!(await getToken())) return;
      try {
        setMe(await api<Me>("/me"));
      } catch {
        // not signed in after all; the page still works read-only
      }
    })();
  }, [load]);

  async function runNow() {
    setRunning(true);
    setRunError(null);
    try {
      await api("/admin/evals/vision/run", { method: "POST" });
      await load();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "The run failed, try again.");
    } finally {
      setRunning(false);
    }
  }

  const latest = data?.latest;
  const shown = useMemo(() => {
    const all = latest?.results ?? [];
    if (filter === "fakes") return all.filter((r) => r.expect === "not-bin");
    if (filter === "bins") return all.filter((r) => r.expect === "bin");
    if (filter === "misses") return all.filter((r) => !r.correct || r.hard);
    return all;
  }, [latest, filter]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-10 pb-20">
      {/* Intro */}
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-primary">AI evaluation</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Can you fool our AI with a fake bin?</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Every bin on SmartBin must pass an AI photo check before it reaches the map. Below is our labelled test set, real dustbins and look-alikes
          picked to trick the model, with the verdict and the model&apos;s own reason for each. Nothing here is hand-picked after the fact:
          an admin can re-run the whole set live.
        </p>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-8">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!data && !error && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {data && !latest && <p className="mt-10 text-muted-foreground">No evaluation has been run yet.</p>}

      {latest && (
        <>
          {/* Run details */}
          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Badge variant={latest.summary.passed ? "wet" : "destructive"} className="gap-1">
              {latest.summary.passed ? <CheckIcon /> : <XIcon />}
              {latest.summary.passed ? "Passed" : "Failed"}
            </Badge>
            <span>
              Model <strong className="text-foreground">{latest.model}</strong> ({latest.provider})
            </span>
            <span>Last run {timeAgo(latest.createdAt)}</span>
            <span>{latest.summary.total} photos in {(latest.durationMs / 1000).toFixed(1)} s</span>
            <span>{data.runs} run{data.runs === 1 ? "" : "s"} so far</span>
            {me?.role === "ADMIN" && (
              <Button size="sm" onClick={runNow} disabled={running} className="ml-auto">
                {running ? <Spinner data-icon="inline-start" /> : <PlayIcon data-icon="inline-start" />}
                {running ? `Checking ${latest.summary.total} photos…` : "Run evaluation now"}
              </Button>
            )}
          </div>
          {runError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircleIcon />
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          )}

          {/* Headline numbers */}
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Results">
            <Stat
              label="Fakes blocked"
              value={`${latest.summary.fakes.rejected}/${latest.summary.fakes.total}`}
              note="Look-alikes and garbage without a bin that were rejected"
              good={latest.summary.fakes.rejected === latest.summary.fakes.total}
            />
            <Stat
              label="Real bins recognised"
              value={`${latest.summary.realBins.accepted}/${latest.summary.realBins.total}`}
              note="Clear dustbin photos that were accepted"
              good={latest.summary.realBins.accepted === latest.summary.realBins.total}
            />
            <Stat
              label="Overall accuracy"
              value={`${Math.round(latest.summary.accuracy * 100)}%`}
              note={`${latest.summary.correct} of ${latest.summary.total} right, including ${latest.summary.hard.total} hard cases`}
            />
            <Stat label="Time per photo" value={`${(latest.summary.avgMs / 1000).toFixed(1)} s`} note="Average for one AI check" />
          </section>

          {/* Confusion matrix */}
          <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">What the AI got right and wrong</h2>
              <p className="mt-2 text-muted-foreground">
                The number that matters most is the red box: <strong className="text-foreground">fakes that got onto the map</strong>. We tuned the
                check to keep it at zero, even if that means rejecting an unusual real bin now and then.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] border-separate border-spacing-2 text-center">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th />
                    <th className="font-medium">AI accepted</th>
                    <th className="font-medium">AI rejected</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="text-left text-sm font-medium">Actually a dustbin</th>
                    <MatrixCell value={latest.summary.matrix.binAccepted} tone="good" label="correctly accepted" />
                    <MatrixCell value={latest.summary.matrix.binRejected} tone="meh" label="real bins rejected" />
                  </tr>
                  <tr>
                    <th className="text-left text-sm font-medium">Not a dustbin</th>
                    <MatrixCell value={latest.summary.matrix.fakeAccepted} tone="bad" label="fakes let through" />
                    <MatrixCell value={latest.summary.matrix.fakeRejected} tone="good" label="correctly rejected" />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Every photo */}
          <section className="mt-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Every test photo</h2>
                <p className="mt-1 text-muted-foreground">The verdict and reason come straight from the model in the latest run.</p>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">All {latest.results.length}</TabsTrigger>
                  <TabsTrigger value="fakes">Fakes {latest.summary.fakes.total}</TabsTrigger>
                  <TabsTrigger value="bins">Real bins {latest.results.length - latest.summary.fakes.total}</TabsTrigger>
                  <TabsTrigger value="misses">Misses and hard cases</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((r) => (
                <ResultCard key={r.file} r={r} />
              ))}
            </div>
          </section>
        </>
      )}

      {/* Try it */}
      <section className="mt-16" id="try">
        <TryYourPhoto me={me} tries={data?.tries} onChecked={load} />
      </section>

      {/* Defences */}
      <section className="mt-16 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nine layers between a fake bin and the map</h2>
          <p className="mt-1 text-muted-foreground">The AI is one layer. The API enforces all of them, so skipping the app doesn&apos;t skip the checks.</p>
          <ol className="mt-6 flex flex-col gap-3">
            {LAYERS.map((l, i) => (
              <li key={l.title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-muted-foreground">Stops: {l.stops}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-wet" aria-hidden="true" />
              Anti-fake test: 15 of 15 passed
            </CardTitle>
            <CardDescription>
              A script that tries every way to sneak a fake bin in through the real API, with real sign-ins, storage and AI. Run it with{" "}
              <code className="rounded bg-muted px-1">npm run test:anti-fake</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {ANTI_FAKE_CHECKS.map((c) => (
                <li key={c} className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-wet" aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Method */}
      <section className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">How we test, and what it can&apos;t catch</h2>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
          <li>
            <strong className="text-foreground">Test set:</strong> {latest?.results.length ?? 20} photos from Wikimedia Commons, each labelled by hand.
            &quot;Hard&quot; cases are genuinely borderline and don&apos;t count toward pass or fail. Photo credits are{" "}
            <a href="/evals/CREDITS.md" className="text-primary underline-offset-4 hover:underline">listed here</a>.
          </li>
          <li>
            <strong className="text-foreground">Pass bar:</strong> no fake accepted, and every clear dustbin accepted.
          </li>
          <li>
            <strong className="text-foreground">Same code as production:</strong> the evaluation calls the exact check the API runs on every new bin.
            Rerun it yourself with <code className="rounded bg-muted px-1">npm run eval:vision</code>.
          </li>
          <li>
            <strong className="text-foreground">The trade-off we chose:</strong> when we let the model accept improvised bins (drums, barrels) if it saw
            waste in them, it imagined a bin liner in an empty barrel and accepted a bag of rubbish. So only purpose-made bins pass. The cost: a real
            bamboo basket bin is rejected.
          </li>
          <li>
            <strong className="text-foreground">Limits:</strong> one clear photo of a real bin passes wherever it was taken, and phone GPS can be faked.
            That&apos;s why the AI is backed by the live camera, the 15 m and 20 m rules and the monthly limits.
          </li>
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value, note, good }: { label: string; value: string; note: string; good?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-4xl tabular-nums ${good ? "text-wet" : ""}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{note}</CardContent>
    </Card>
  );
}

function MatrixCell({ value, tone, label }: { value: number; tone: "good" | "bad" | "meh"; label: string }) {
  const colour =
    tone === "good" ? "bg-wet/15 text-wet" : tone === "bad" ? (value === 0 ? "bg-destructive/10 text-destructive" : "bg-destructive text-white") : "bg-muted text-foreground";
  return (
    <td className={`rounded-2xl px-4 py-5 ${colour}`}>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs">{label}</div>
    </td>
  );
}

function ResultCard({ r }: { r: EvalResult }) {
  return (
    <Card className="overflow-hidden pt-0">
      <div className="relative aspect-4/3 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- static test photos */}
        <img src={r.image} alt={r.note} loading="lazy" className="absolute inset-0 size-full object-cover" />
        <span
          className={`absolute top-3 right-3 grid size-9 place-items-center rounded-full shadow-float ${r.correct ? "bg-wet text-white" : r.hard ? "bg-warning text-warning-foreground" : "bg-destructive text-white"}`}
          aria-label={r.correct ? "AI was right" : "AI was wrong"}
        >
          {r.correct ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}
        </span>
      </div>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={r.expect === "bin" ? "wet" : "outline"}>{r.expect === "bin" ? "Real dustbin" : "Not a dustbin"}</Badge>
          <Badge variant={r.accepted ? "dry" : "secondary"}>AI {r.accepted ? "accepted" : "rejected"}</Badge>
          {r.hard && <Badge variant="warning">Hard case</Badge>}
        </div>
        <p className="font-medium">{r.note}</p>
        <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">&ldquo;{r.reason}&rdquo;</blockquote>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Model confidence</span>
            <span className="tabular-nums">{Math.round(r.confidence * 100)}%</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(r.confidence * 100)}%` }} />
          </div>
        </div>
        <p className="mt-auto text-xs text-muted-foreground">
          Photo: {r.author}, {r.licence} ·{" "}
          <a href={r.source} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
            source
          </a>
        </p>
      </CardContent>
    </Card>
  );
}
