"use client";

import { CheckIcon, ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, IssueBadges, Loading } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { binName, hoursLabel, useAdminData, type CleaningItem } from "@/lib/admin";
import { directionsUrl, ISSUE_LABEL, TYPE_LABEL, type IssueType } from "@/lib/bins";

type Filter = "ALL" | IssueType;

const DONE_LABEL: Record<Filter, string> = { ALL: "Mark sorted", FULL: "Mark emptied", BROKEN: "Mark fixed", DIRTY: "Mark cleaned", OTHER: "Mark sorted" };

export default function CleaningPage() {
  const queue = useAdminData<CleaningItem[]>("/admin/cleaning");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null); // "bulk" or a bin id
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<string | null>(null);

  const items = useMemo(
    () => (queue.data ?? []).filter((b) => filter === "ALL" || b.issues.some((i) => i.type === filter)),
    [queue.data, filter]
  );
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ALL: 0, FULL: 0, BROKEN: 0, DIRTY: 0, OTHER: 0 };
    for (const b of queue.data ?? []) {
      c.ALL++;
      for (const i of b.issues) c[i.type]++;
    }
    return c;
  }, [queue.data]);
  const pickedShown = items.filter((b) => picked.has(b.id));

  async function resolve(binIds: string[], key: string) {
    setBusy(key);
    setError(undefined);
    setDone(null);
    try {
      const r = await api<{ bins: number; resolved: number }>("/admin/bins/resolve-issues", {
        method: "POST",
        body: { binIds, ...(filter !== "ALL" && { type: filter }) },
      });
      setDone(`${r.bins === 1 ? "1 bin" : `${r.bins} bins`} marked ${filter === "FULL" ? "emptied" : "sorted"}.`);
      setPicked(new Set());
      queue.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the bins.");
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AdminPage
      title="Cleaning queue"
      description="Bins people reported as full, broken, dirty or something else. Most urgent first: more reports, waiting longer and busier bins rise to the top."
      actions={
        <Button variant="secondary" size="lg" onClick={queue.reload} disabled={queue.loading}>
          {queue.loading ? <Spinner data-icon="inline-start" /> : <RefreshCwIcon data-icon="inline-start" />}
          Refresh
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setFilter(v[0] as Filter);
            setPicked(new Set());
          }}
          variant="chip"
          size="chip"
          className="flex-wrap"
          aria-label="Problem"
        >
          <ToggleGroupItem value="ALL">All ({counts.ALL})</ToggleGroupItem>
          {(["FULL", "BROKEN", "DIRTY", "OTHER"] as const).map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {t === "OTHER" ? "Other" : ISSUE_LABEL[t]} ({counts[t]})
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setPicked(pickedShown.length === items.length ? new Set() : new Set(items.map((b) => b.id)))}
            >
              {pickedShown.length === items.length ? "Clear selection" : "Select all"}
            </Button>
            <Button size="lg" disabled={!pickedShown.length || !!busy} onClick={() => resolve(pickedShown.map((b) => b.id), "bulk")}>
              {busy === "bulk" ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
              {DONE_LABEL[filter]} {pickedShown.length ? `(${pickedShown.length})` : ""}
            </Button>
          </div>
        )}
      </div>

      <ErrorNote error={queue.error ?? error} />
      {done && (
        <p role="status" className="rounded-xl bg-wet/15 px-4 py-3 font-medium text-wet">
          {done}
        </p>
      )}

      {!queue.data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => <Loading key={i} className="h-28" />)}
        </div>
      ) : !items.length ? (
        <Empty>{filter === "ALL" ? "Nothing to clean. Every reported problem has been sorted." : `No bins reported ${ISSUE_LABEL[filter].toLowerCase()} right now.`}</Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((b, i) => (
            <li key={b.id} className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center ${picked.has(b.id) ? "ring-2 ring-foreground" : ""}`}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-4">
                <input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} className="size-5 shrink-0 accent-primary" aria-label={`Select ${binName(b)}`} />
                <span className="w-6 shrink-0 text-center font-heading text-lg font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs from the API */}
                <img src={b.imageUrl} alt="" className="size-16 shrink-0 rounded-xl bg-muted object-cover" />
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate font-bold">{binName(b)}</span>
                  <IssueBadges issues={b.issues} />
                  <span className="text-sm text-muted-foreground">
                    {TYPE_LABEL[b.type]}. Waiting {hoursLabel(b.hoursOpen)}, {b.reports} {b.reports === 1 ? "report" : "reports"}, {b.demand7} uses this week
                  </span>
                </span>
              </label>
              <div className="flex shrink-0 gap-2 sm:flex-col lg:flex-row">
                <Button className="flex-1" disabled={!!busy} onClick={() => resolve([b.id], b.id)}>
                  {busy === b.id ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
                  {DONE_LABEL[filter]}
                </Button>
                <Button className="flex-1" variant="secondary" render={<a href={directionsUrl(b)} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                  <ExternalLinkIcon data-icon="inline-start" />
                  Directions
                </Button>
                <Button className="flex-1" variant="ghost" render={<Link href={`/admin/bins/${b.id}`} />} nativeButton={false}>
                  Details
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </AdminPage>
  );
}
