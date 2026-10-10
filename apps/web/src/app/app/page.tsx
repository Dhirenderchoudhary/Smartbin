"use client";

import { AlertCircleIcon, MapPinnedIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useMe } from "@/components/AuthGate";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Quota } from "@/lib/api";

function QuotaStat({ label, left, limit }: { label: string; left: number; limit: number }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold">
        {left}
        <span className="text-base font-medium text-muted-foreground"> / {limit}</span>
      </dd>
    </div>
  );
}

export default function UserHome() {
  const me = useMe();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Quota>("/me/quota").then(setQuota, (e: Error) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Hi, {me.email?.split("@")[0] ?? "there"}</h1>

      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
          <CardDescription>
            {quota
              ? `Resets on ${new Date(quota.resetsOn).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`
              : "Your monthly limits."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!quota && !error && (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-18" />
              <Skeleton className="h-18" />
            </div>
          )}
          {quota && (
            <dl className="grid grid-cols-2 gap-3">
              <QuotaStat label="Bins you can add" left={quota.remaining.registrations} limit={quota.limits.registrations} />
              <QuotaStat label="Reports left" left={quota.remaining.missingReports} limit={quota.limits.missingReports} />
            </dl>
          )}
        </CardContent>
      </Card>

      <Alert>
        <MapPinnedIcon />
        <AlertDescription>The nearby map and “Add a bin” are the next step.</AlertDescription>
      </Alert>
    </main>
  );
}
