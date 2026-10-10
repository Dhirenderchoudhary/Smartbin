"use client";

import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { binStatus, STATUS_LABEL, STATUS_VAR, type BinStatus } from "@/components/admin/AdminMap";
import { ErrorNote, IssueBadges } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { binName, num, useAdminData, type Demand, type MapBin } from "@/lib/admin";
import { timeAgo, TYPE_LABEL } from "@/lib/bins";

// maplibre needs the browser
const AdminMap = dynamic(() => import("@/components/admin/AdminMap"), { ssr: false, loading: () => <div className="absolute inset-0 bg-map" /> });

type Filter = "ALL" | "ATTENTION" | BinStatus;

const floating = "rounded-2xl bg-card shadow-float";

function SelectedBin({ bin, onClose, onChanged }: { bin: MapBin; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function sortAll() {
    setBusy(true);
    setError(undefined);
    try {
      await api(`/admin/bins/${bin.id}`, { method: "PATCH", body: { resolveIssues: true } });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the bin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Selected bin"
      className={`absolute inset-x-0 bottom-0 z-20 flex flex-col gap-4 rounded-b-none p-5 md:inset-x-auto md:top-4 md:right-4 md:bottom-auto md:w-96 md:rounded-b-2xl ${floating}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold">{binName(bin)}</h2>
          <p className="text-sm text-muted-foreground">
            {TYPE_LABEL[bin.type]}, added {timeAgo(bin.createdAt)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
          <XIcon />
        </Button>
      </div>
      <IssueBadges issues={bin.issues} />
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-sm text-muted-foreground">Opened + directions</dt>
          <dd className="font-heading text-2xl font-bold">{num(bin.demand30)}</dd>
          <dd className="text-xs text-muted-foreground">last 30 days</dd>
        </div>
        <div className="rounded-xl bg-muted p-3">
          <dt className="text-sm text-muted-foreground">Missing reports</dt>
          <dd className="font-heading text-2xl font-bold">{bin.missingReports}</dd>
          <dd className="text-xs text-muted-foreground">since last reset</dd>
        </div>
      </dl>
      <ErrorNote error={error} />
      <div className="flex flex-wrap gap-2">
        {bin.issues.length > 0 && (
          <Button size="lg" className="flex-1" disabled={busy} onClick={sortAll}>
            {busy ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" />}
            Mark all sorted
          </Button>
        )}
        <Button size="lg" variant="secondary" className="flex-1" render={<Link href={`/admin/bins/${bin.id}`} />} nativeButton={false}>
          Details
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}

export default function AdminMapPage() {
  const bins = useAdminData<MapBin[]>("/admin/bins/map");
  const demand = useAdminData<Demand>("/admin/demand?days=30");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showSearches, setShowSearches] = useState(false);
  const [showUnserved, setShowUnserved] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<BinStatus, number> = { broken: 0, needsCleaning: 0, atRisk: 0, ok: 0 };
    bins.data?.forEach((b) => c[binStatus(b)]++);
    return c;
  }, [bins.data]);

  const shown = useMemo(
    () =>
      (bins.data ?? []).filter((b) => {
        const s = binStatus(b);
        return filter === "ALL" || (filter === "ATTENTION" ? s === "broken" || s === "needsCleaning" : s === filter);
      }),
    [bins.data, filter]
  );
  const selected = bins.data?.find((b) => b.id === selectedId) ?? null;

  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] flex-1 overflow-hidden lg:min-h-dvh">
      <AdminMap
        bins={shown}
        demand={demand.data}
        showSearches={showSearches}
        showUnserved={showUnserved}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Filters and layers */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-4">
        <div className={`pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-2 p-2 ${floating}`}>
          <ToggleGroup value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as Filter)} variant="chip" size="chip" aria-label="Show bins" className="flex-wrap">
            <ToggleGroupItem value="ALL">All {bins.data ? `(${bins.data.length})` : ""}</ToggleGroupItem>
            <ToggleGroupItem value="ATTENTION">Need attention ({counts.broken + counts.needsCleaning})</ToggleGroupItem>
            <ToggleGroupItem value="atRisk">May be missing ({counts.atRisk})</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className={`pointer-events-auto flex w-fit max-w-full flex-wrap items-center gap-2 p-2 ${floating}`}>
          <Toggle variant="chip" size="chip" pressed={showSearches} onPressedChange={setShowSearches}>
            Where people search {demand.data ? `(${num(demand.data.totalSearches)})` : ""}
          </Toggle>
          <Toggle variant="chip" size="chip" pressed={showUnserved} onPressedChange={setShowUnserved}>
            No bin nearby {demand.data ? `(${num(demand.data.unservedSearches)})` : ""}
          </Toggle>
        </div>
        {(bins.error || demand.error) && (
          <div className="pointer-events-auto max-w-md">
            <ErrorNote error={bins.error ?? demand.error} />
          </div>
        )}
      </div>

      {/* Legend */}
      {!selected && (
        <div className={`absolute bottom-4 left-4 z-10 hidden flex-col gap-1.5 p-4 text-sm sm:flex ${floating}`}>
          {(Object.keys(STATUS_LABEL) as BinStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: `var(${STATUS_VAR[s]})` }} aria-hidden="true" />
              {STATUS_LABEL[s]} ({counts[s]})
            </span>
          ))}
          <span className="mt-1 text-muted-foreground">Bigger dot = more people use it</span>
          {showSearches && <span className="flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-linear-to-r from-[#a6c8ff] to-[#1e3a8a]" aria-hidden="true" />Searches, last 30 days</span>}
          {showUnserved && <span className="flex items-center gap-2"><span className="h-2 w-6 rounded-full bg-linear-to-r from-[#ffd2c7] to-[#a51400]" aria-hidden="true" />Searches with no bin within 500 m</span>}
        </div>
      )}

      {selected && <SelectedBin key={selected.id} bin={selected} onClose={() => setSelectedId(null)} onChanged={bins.reload} />}
    </main>
  );
}
