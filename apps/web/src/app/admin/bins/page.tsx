"use client";

import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, IssueBadges, Loading } from "@/components/admin/parts";
import { TypeBadges } from "@/components/map/BinPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { binName, num, useAdminData, type AdminBin, type Paged } from "@/lib/admin";
import { timeAgo } from "@/lib/bins";

type Show = "all" | "ANY" | "FULL" | "BROKEN" | "missing";
type Sort = "newest" | "oldest" | "mostReported" | "demand";

const SORTS: Record<Sort, string> = { newest: "Newest", oldest: "Oldest", mostReported: "Most missing reports", demand: "Most used" };

const selectClass =
  "h-10 rounded-full border bg-card px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";

export default function BinsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [type, setType] = useState<"" | "WET" | "DRY" | "BOTH">("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  // Search after a short pause in typing
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams({ page: String(page), pageSize: "20", sort });
  if (search) params.set("q", search);
  if (type) params.set("type", type);
  if (show === "missing") params.set("reported", "true");
  else if (show !== "all") params.set("issue", show);
  const list = useAdminData<Paged<AdminBin>>(`/admin/bins?${params}`);
  const data = list.data;

  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  return (
    <AdminPage title="Bins" description="Every bin on the map. Open one for its history, usage and controls.">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search bins by name" className="h-10 rounded-full pl-10" />
          </div>
          <select aria-label="Waste type" value={type} onChange={(e) => reset(setType)(e.target.value as typeof type)} className={selectClass}>
            <option value="">All types</option>
            <option value="WET">Wet</option>
            <option value="DRY">Dry</option>
            <option value="BOTH">Wet and dry</option>
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => reset(setSort)(e.target.value as Sort)} className={selectClass}>
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <option key={s} value={s}>
                {SORTS[s]}
              </option>
            ))}
          </select>
        </div>
        <ToggleGroup value={[show]} onValueChange={(v) => v[0] && reset(setShow)(v[0] as Show)} variant="chip" size="chip" className="flex-wrap" aria-label="Show">
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="ANY">Any problem</ToggleGroupItem>
          <ToggleGroupItem value="FULL">Full</ToggleGroupItem>
          <ToggleGroupItem value="BROKEN">Broken</ToggleGroupItem>
          <ToggleGroupItem value="missing">May be missing</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <ErrorNote error={list.error} />

      {!data ? (
        <Loading className="h-96" />
      ) : !data.items.length ? (
        <Empty>No bins match these filters.</Empty>
      ) : (
        <div className={`overflow-hidden rounded-2xl border bg-card transition-opacity ${list.loading ? "opacity-60" : ""}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Bin</TableHead>
                <TableHead className="hidden md:table-cell">Problems</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Used (30 d)</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Missing</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((b) => (
                <TableRow
                  key={b.id}
                  className="cursor-pointer"
                  // The whole row opens the bin; the link inside is for keyboards and new tabs
                  onClick={(e) => !(e.target as HTMLElement).closest("a") && router.push(`/admin/bins/${b.id}`)}
                >
                  <TableCell className="pl-4">
                    <Link href={`/admin/bins/${b.id}`} className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URLs from the API */}
                      <img src={b.imageUrl} alt="" className="size-11 shrink-0 rounded-lg bg-muted object-cover" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="max-w-56 truncate font-medium">{binName(b)}</span>
                        <TypeBadges type={b.type} />
                        <span className="md:hidden">{b.issues.length > 0 && <IssueBadges issues={b.issues} />}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <IssueBadges issues={b.issues} />
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{num(b.demand30)}</TableCell>
                  <TableCell className={`hidden text-right tabular-nums lg:table-cell ${b.missingReports ? "font-bold text-destructive" : ""}`}>{b.missingReports}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {timeAgo(b.createdAt)}
                    {b.creatorEmail && <span className="block max-w-48 truncate text-xs">{b.creatorEmail}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {num(data.total)} bins, page {data.page} of {data.totalPages}
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
