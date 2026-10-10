"use client";

import { ArrowLeftIcon, CheckIcon, ExternalLinkIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, IssueBadges, Kpi, Loading, Panel } from "@/components/admin/parts";
import { TypeBadges } from "@/components/map/BinPanel";
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
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { binName, eventLabel, hoursLabel, num, useAdminData, type BinDetails } from "@/lib/admin";
import { directionsUrl, ISSUE_LABEL, timeAgo, type BinType, type IssueType } from "@/lib/bins";

const BinSpotMap = dynamic(() => import("@/components/admin/BinSpotMap"), { ssr: false, loading: () => <div className="h-56 rounded-2xl bg-map" /> });

const usageConfig = {
  views: { label: "Opened", color: "var(--chart-2)" },
  directions: { label: "Directions", color: "var(--chart-1)" },
  arrivals: { label: "Arrived", color: "var(--chart-3)" },
} satisfies ChartConfig;

const dayTick = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const SORTED: Record<IssueType, string> = { FULL: "Emptied", BROKEN: "Fixed", DIRTY: "Cleaned", OTHER: "Sorted" };

function EditForm({ bin, onSaved }: { bin: BinDetails; onSaved: () => void }) {
  const [name, setName] = useState(bin.name ?? "");
  const [type, setType] = useState<BinType>(bin.type);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const changed = name.trim() !== (bin.name ?? "") || type !== bin.type;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api(`/admin/bins/${bin.id}`, {
        method: "PATCH",
        body: { ...(name.trim() !== (bin.name ?? "") && { name: name.trim() }), ...(type !== bin.type && { type }) },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="bin-name">Name</FieldLabel>
        <Input id="bin-name" value={name} maxLength={100} required onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field>
        <FieldLabel>Waste type</FieldLabel>
        <ToggleGroup value={[type]} onValueChange={(v) => v[0] && setType(v[0] as BinType)} variant="chip" size="chip" className="flex-wrap">
          <ToggleGroupItem value="WET">Wet</ToggleGroupItem>
          <ToggleGroupItem value="DRY">Dry</ToggleGroupItem>
          <ToggleGroupItem value="BOTH">Wet and dry</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <ErrorNote error={error} />
      <Button type="submit" disabled={!changed || busy} className="self-start">
        {busy && <Spinner data-icon="inline-start" />}
        Save changes
      </Button>
    </form>
  );
}

export default function BinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const bin = useAdminData<BinDetails>(`/admin/bins/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const b = bin.data;

  async function patch(body: object, key: string) {
    setBusy(key);
    setError(undefined);
    try {
      await api(`/admin/bins/${id}`, { method: "PATCH", body });
      bin.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the bin.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("delete");
    try {
      await api(`/admin/bins/${id}`, { method: "DELETE" });
      router.replace("/admin/bins");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete the bin.");
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const back = (
    <Button variant="ghost" render={<Link href="/admin/bins" />} nativeButton={false}>
      <ArrowLeftIcon data-icon="inline-start" />
      All bins
    </Button>
  );

  if (!b) {
    return (
      <AdminPage title={bin.error ? "Bin not found" : "Loading…"} actions={back}>
        {bin.error ? (
          <>
            <ErrorNote error={bin.error} />
            <p className="text-muted-foreground">
              It may have been removed. Its history is still in{" "}
              <Link className="font-medium text-foreground underline" href={`/admin/activity?binId=${id}`}>
                Activity
              </Link>
              .
            </p>
          </>
        ) : (
          <Loading className="h-96" />
        )}
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={binName(b)}
      description={`Added ${timeAgo(b.createdAt)}${b.creatorEmail ? ` by ${b.creatorEmail}` : ""}.`}
      actions={
        <>
          {back}
          <Button variant="secondary" render={<a href={directionsUrl(b)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <ExternalLinkIcon data-icon="inline-start" />
            Google Maps
          </Button>
        </>
      }
    >
      <ErrorNote error={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs from the API */}
          <img src={b.imageUrl} alt={`Photo of ${binName(b)}`} className="aspect-4/3 w-full rounded-2xl bg-muted object-cover" />
          <BinSpotMap lat={b.latitude} lng={b.longitude} />
          <p className="text-sm text-muted-foreground tabular-nums">
            {b.latitude.toFixed(6)}, {b.longitude.toFixed(6)}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadges type={b.type} />
            <IssueBadges issues={b.issues} />
          </div>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label="Opened" value={num(b.figures.views)} note={`${num(b.figures.directions)} directions`} />
            <Kpi label="Walked there" value={num(b.figures.arrivals)} note="with directions" />
            <Kpi label="Fills up in" value={hoursLabel(b.figures.medianHoursToFull)} note={`median, full ${b.figures.fullCycles} times`} />
            <Kpi label="Sorted in" value={hoursLabel(b.figures.avgHoursToFix)} note={`average, ${b.figures.issuesSorted} sorted`} />
          </div>

          <Panel title="Open problems" description="Mark each one sorted once it's dealt with.">
            {!b.issues.length ? (
              <Empty>No open problems.</Empty>
            ) : (
              <ul className="flex flex-col gap-2">
                {b.issues.map((i) => (
                  <li key={i.type} className="flex items-center gap-3 rounded-xl bg-muted p-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{i.type === "OTHER" && i.note ? i.note : ISSUE_LABEL[i.type]}</span>
                      <span className="text-sm text-muted-foreground">
                        {i.reports} {i.reports === 1 ? "report" : "reports"}, latest {timeAgo(i.lastReportedAt)}
                      </span>
                    </span>
                    <Button disabled={!!busy} onClick={() => patch({ resolveIssues: i.type }, i.type)}>
                      {busy === i.type ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                      {SORTED[i.type]}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Use over the last 30 days">
            <ChartContainer config={usageConfig} className="aspect-auto h-52 w-full">
              <BarChart data={b.usage} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayTick} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayTick(String(d))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar isAnimationActive={false} dataKey="views" stackId="u" fill="var(--color-views)" />
                <Bar isAnimationActive={false} dataKey="directions" stackId="u" fill="var(--color-directions)" />
                <Bar isAnimationActive={false} dataKey="arrivals" stackId="u" fill="var(--color-arrivals)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Panel>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Edit">
              <EditForm key={`${b.name}-${b.type}`} bin={b} onSaved={bin.reload} />
            </Panel>
            <Panel title="Reports and removal">
              <p className="text-sm text-muted-foreground">
                {b.missingReports
                  ? `${b.missingReports} ${b.missingReports === 1 ? "person has" : "people have"} reported it missing. Reset if it's still there.`
                  : "Nobody has reported it missing."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!b.missingReports || !!busy} onClick={() => patch({ resetReports: true }, "reset")}>
                  {busy === "reset" ? <Spinner data-icon="inline-start" /> : <RotateCcwIcon data-icon="inline-start" />}
                  Reset missing reports
                </Button>
                <Button variant="destructive" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
                  <Trash2Icon data-icon="inline-start" />
                  Delete bin
                </Button>
              </div>
            </Panel>
          </div>

          <Panel title="History" description="Newest first.">
            {!b.timeline.length ? (
              <Empty>No history yet.</Empty>
            ) : (
              <ol className="flex flex-col">
                {b.timeline.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t py-2.5 first:border-0">
                    <span className="font-medium">{eventLabel(e)}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.userEmail ?? "Someone"}, {timeAgo(e.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => busy !== "delete" && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {binName(b)}?</AlertDialogTitle>
            <AlertDialogDescription>
              It comes off the map for everyone and its photo is deleted. Its history stays in Activity. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy === "delete"} onClick={remove}>
              {busy === "delete" && <Spinner data-icon="inline-start" />}
              Delete bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPage>
  );
}
