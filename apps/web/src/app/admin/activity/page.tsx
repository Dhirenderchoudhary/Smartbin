"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, Loading } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { eventLabel, EVENT_TYPE_LABEL, EVENT_TYPES, num, useAdminData, type BinEvent, type Paged } from "@/lib/admin";
import { timeAgo } from "@/lib/bins";

// useSearchParams needs a Suspense boundary
export default function Page() {
  return (
    <Suspense>
      <ActivityPage />
    </Suspense>
  );
}

function ActivityPage() {
  const router = useRouter();
  const binId = useSearchParams().get("binId");
  const [type, setType] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), pageSize: "30" });
  if (type !== "ALL") params.set("type", type);
  if (binId) params.set("binId", binId);
  const events = useAdminData<Paged<BinEvent>>(`/admin/events?${params}`);
  const data = events.data;

  return (
    <AdminPage title="Activity" description="Everything that happens to bins, newest first. Includes bins that have since been removed.">
      <div className="flex flex-col gap-3">
        <ToggleGroup
          value={[type]}
          onValueChange={(v) => {
            if (!v[0]) return;
            setType(v[0]);
            setPage(1);
          }}
          variant="chip"
          size="chip"
          className="flex-wrap"
          aria-label="Event type"
        >
          <ToggleGroupItem value="ALL">Everything</ToggleGroupItem>
          {EVENT_TYPES.map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {binId && (
          <Button variant="secondary" className="self-start" onClick={() => router.replace("/admin/activity")}>
            One bin only
            <XIcon data-icon="inline-end" />
          </Button>
        )}
      </div>

      <ErrorNote error={events.error} />

      {!data ? (
        <Loading className="h-96" />
      ) : !data.items.length ? (
        <Empty>Nothing here yet.</Empty>
      ) : (
        <ol className={`flex flex-col rounded-2xl border bg-card px-5 transition-opacity ${events.loading ? "opacity-60" : ""}`}>
          {data.items.map((e) => {
            const gone = e.type === "REMOVED" || e.type === "ADMIN_DELETE";
            const name = typeof e.meta?.name === "string" ? e.meta.name : null;
            return (
              <li key={e.id} className="flex flex-col gap-0.5 border-t py-3 first:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="min-w-0">
                  <span className="font-medium">{eventLabel(e)}</span>{" "}
                  {gone ? (
                    <span className="text-muted-foreground">{name ?? "a bin"}</span>
                  ) : (
                    <Link href={`/admin/bins/${e.binId}`} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                      open bin
                    </Link>
                  )}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {e.userEmail ?? "Someone"}, {timeAgo(e.createdAt)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {num(data.total)} events, page {data.page} of {data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" size="icon-lg" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeftIcon />
            </Button>
            <Button variant="secondary" size="icon-lg" aria-label="Next page" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      )}
    </AdminPage>
  );
}
