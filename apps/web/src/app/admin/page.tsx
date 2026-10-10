"use client";

import { AlertCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

interface Stats {
  bins: { active: number; atRisk: number };
  new: { today: number; last7Days: number };
  reports: { today: number; last7Days: number };
  removed: { total: number; byAdmin: number };
  users: { total: number; newLast7Days: number };
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/admin/stats").then(setStats, (e: Error) => setError(e.message));
  }, []);

  const cards = stats && [
    { label: "Active bins", value: stats.bins.active, note: `${stats.bins.atRisk} at risk` },
    { label: "Added today", value: stats.new.today, note: `${stats.new.last7Days} in 7 days` },
    { label: "Missing reports today", value: stats.reports.today, note: `${stats.reports.last7Days} in 7 days` },
    { label: "Removed", value: stats.removed.total, note: `${stats.removed.byAdmin} by admins` },
    { label: "Users", value: stats.users.total, note: `${stats.users.newLast7Days} new in 7 days` },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {error && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {!cards && !error && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        {cards?.map((c) => (
          <Card key={c.label} size="sm">
            <CardHeader>
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-3xl font-bold">{c.value}</CardTitle>
              <CardDescription className="text-xs">{c.note}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
