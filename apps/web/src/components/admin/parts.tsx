"use client";

import { AlertCircleIcon } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { binName } from "@/lib/admin";
import { ISSUE_LABEL, type BinIssue } from "@/lib/bins";

// A titled block of the dashboard
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Kpi({ label, value, note, href, strong = false }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string; strong?: boolean }) {
  const body = (
    <>
      <span className={`text-sm ${strong ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</span>
      <span className="font-heading text-4xl leading-none font-bold tabular-nums">{value}</span>
      {note && <span className={`text-sm ${strong ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{note}</span>}
    </>
  );
  const cls = `flex min-w-0 flex-col gap-2 rounded-2xl p-5 ${strong ? "bg-primary text-primary-foreground" : "border bg-card"}`;
  return href ? (
    <Link href={href} className={`${cls} outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

export function Loading({ className = "h-64" }: { className?: string }) {
  return <Skeleton className={`w-full rounded-xl ${className}`} />;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

// Ranked bins with one figure each, linking to the bin
export function RankList<T extends { id: string; name: string | null }>({
  items,
  value,
  detail,
  empty,
}: {
  items: T[];
  value: (item: T) => React.ReactNode;
  detail?: (item: T) => React.ReactNode;
  empty: string;
}) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => (
        <li key={item.id} className="border-t first:border-0">
          <Link href={`/admin/bins/${item.id}`} className="flex items-center gap-3 py-2.5 outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="w-5 shrink-0 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{binName(item)}</span>
              {detail && <span className="block truncate text-sm text-muted-foreground">{detail(item)}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{value(item)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function IssueBadges({ issues }: { issues: BinIssue[] }) {
  if (!issues.length) return <span className="text-sm text-muted-foreground">No problems</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {issues.map((i) => (
        <Badge key={i.type} variant={i.type === "BROKEN" ? "destructive" : i.type === "FULL" ? "warning" : "secondary"}>
          {ISSUE_LABEL[i.type]}
          {i.reports > 1 && ` ×${i.reports}`}
        </Badge>
      ))}
    </span>
  );
}

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <ToggleGroup
      value={[String(value)]}
      onValueChange={(v) => v[0] && onChange(Number(v[0]) as Range)}
      variant="chip"
      size="chip"
      aria-label="Time range"
    >
      {RANGES.map((r) => (
        <ToggleGroupItem key={r} value={String(r)}>
          {r} days
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
