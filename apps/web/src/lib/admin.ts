"use client";

// Admin API types (see docs/api.md, "Endpoints for admins") and one fetch hook for the admin pages.
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { BinIssue, BinType, IssueType } from "./bins";

export interface Stats {
  bins: { active: number; byType: Record<BinType, number>; atRisk: number };
  new: { today: number; last7Days: number; last30Days: number };
  reports: { today: number; last7Days: number };
  removed: { today: number; last7Days: number; total: number; byAdmin: number };
  users: { total: number; newLast7Days: number };
  issues: { needsCleaning: number; open: Record<IssueType, number>; today: number; avgHoursToFix: number | null };
  demand: {
    searchesToday: number;
    searchesLast7Days: number;
    unservedLast7Days: number;
    viewsToday: number;
    directionsToday: number;
    directionsLast7Days: number;
  };
}

export interface DayCounts {
  day: string;
  registrations: number;
  missingReports: number;
  removals: number;
  issueReports: number;
  issuesResolved: number;
  searches: number;
  views: number;
  directions: number;
}

export interface Timeseries {
  days: number;
  timezone: string;
  series: DayCounts[];
}

export interface BinRef {
  id: string;
  name: string | null;
  type: BinType;
  latitude: number;
  longitude: number;
}

export interface Insights {
  days: number;
  busiest: (BinRef & { views: number; directions: number; arrivals: number })[];
  fastestFilling: (BinRef & { cycles: number; medianHoursToFull: number })[];
  slowestToFix: (BinRef & { fixed: number; avgHoursToFix: number })[];
  issuesByType: Record<IssueType, number>;
  fullReportsByHour: { hour: number; reports: number }[];
}

export interface Demand {
  days: number;
  totalSearches: number;
  unservedSearches: number;
  cells: { lat: number; lng: number; searches: number; unserved: number }[];
}

export interface MapBin extends BinRef {
  missingReports: number;
  createdAt: string;
  issues: BinIssue[];
  demand30: number;
}

export interface CleaningItem extends BinRef {
  imageUrl: string;
  missingReports: number;
  issues: BinIssue[];
  reports: number;
  demand7: number;
  oldestReportAt: string;
  hoursOpen: number;
  priority: number;
}

export interface AdminBin extends BinRef {
  imageUrl: string;
  status: string;
  missingReports: number;
  createdAt: string;
  createdBy: string | null;
  creatorEmail: string | null;
  issues: BinIssue[];
  demand30: number;
}

export interface BinEvent {
  id: string;
  binId: string;
  userId: string | null;
  userEmail?: string | null;
  type: string;
  latitude: number | null;
  longitude: number | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUser {
  id: string;
  email: string | null;
  role: string;
  points: number;
  createdAt: string;
  registrations: number;
  missingReports: number;
  activeBins: number;
}

export interface Setting {
  key: string;
  label: string;
  value: number;
  default: number;
  min: number;
  max: number;
  isDefault: boolean;
  updatedAt?: string | null;
  updatedByEmail?: string | null;
}

export interface SettingsData {
  settings: Setting[];
  history: { id: string; key: string; oldValue: number | null; newValue: number; changedByEmail: string | null; changedAt: string }[];
}

// Loads an admin endpoint. Keeps the previous data while reloading, so refreshes don't flash.
// path = null waits (e.g. until an id is known).
export function useAdminData<T>(path: string | null) {
  const [version, setVersion] = useState(0);
  const key = path && `${path}#${version}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);

  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    api<T>(path).then(
      (data) => !cancelled && setResult({ key, data }),
      (err: Error) => !cancelled && setResult((prev) => ({ key, data: prev?.data, error: err.message }))
    );
    return () => {
      cancelled = true;
    };
  }, [key, path]);

  const loading = !!key && result?.key !== key;
  return {
    data: result?.data,
    error: loading ? undefined : result?.error,
    loading,
    reload: useCallback(() => setVersion((v) => v + 1), []),
  };
}

export const ISSUE_TONE: Record<IssueType, string> = {
  FULL: "var(--warning)",
  BROKEN: "var(--destructive)",
  DIRTY: "var(--chart-2)",
  OTHER: "var(--muted-foreground)",
};

export const binName = (b: { name: string | null }) => b.name || "Unnamed bin";

const plain = new Intl.NumberFormat("en-IN");
export const num = (n: number) => plain.format(n);

export function hoursLabel(h: number | null | undefined): string {
  if (h === null || h === undefined) return "–";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} days`;
}

export interface BinDetails extends AdminBin {
  usage: { day: string; views: number; directions: number; arrivals: number }[];
  figures: {
    fullCycles: number;
    medianHoursToFull: number | null;
    issuesSorted: number;
    avgHoursToFix: number | null;
    views: number;
    directions: number;
    arrivals: number;
  };
  timeline: BinEvent[];
}

const ISSUE_WORD: Record<string, string> = { FULL: "full", BROKEN: "broken", DIRTY: "dirty", OTHER: "a problem" };

// One line for a history entry, as an admin would say it
export function eventLabel(e: BinEvent): string {
  const meta = e.meta ?? {};
  switch (e.type) {
    case "REGISTERED":
      return "Added to the map";
    case "MISSING_REPORT":
      return `Reported missing${meta.reportNumber ? ` (report ${meta.reportNumber})` : ""}`;
    case "REMOVED":
      return "Removed after missing reports";
    case "ADMIN_EDIT":
      return "Edited by an admin";
    case "ADMIN_DELETE":
      return "Deleted by an admin";
    case "ADMIN_RESET_REPORTS":
      return "Missing reports reset";
    case "ISSUE_REPORT":
      return `Reported ${ISSUE_WORD[String(meta.issue)] ?? "a problem"}${meta.note ? `: "${meta.note}"` : ""}`;
    case "ISSUE_RESOLVED": {
      const issues = Array.isArray(meta.issues) ? (meta.issues as string[]).map((i) => ISSUE_WORD[i] ?? i).join(", ") : "";
      return `Marked sorted${issues ? ` (${issues})` : ""}`;
    }
    default:
      return e.type.toLowerCase().replaceAll("_", " ");
  }
}

export const EVENT_TYPES = [
  "REGISTERED",
  "MISSING_REPORT",
  "REMOVED",
  "ISSUE_REPORT",
  "ISSUE_RESOLVED",
  "ADMIN_EDIT",
  "ADMIN_RESET_REPORTS",
  "ADMIN_DELETE",
] as const;

export const EVENT_TYPE_LABEL: Record<(typeof EVENT_TYPES)[number], string> = {
  REGISTERED: "Added",
  MISSING_REPORT: "Missing reports",
  REMOVED: "Removed",
  ISSUE_REPORT: "Problems",
  ISSUE_RESOLVED: "Sorted",
  ADMIN_EDIT: "Edits",
  ADMIN_RESET_REPORTS: "Resets",
  ADMIN_DELETE: "Deletions",
};
