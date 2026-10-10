"use client";

import { AlertCircleIcon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppTopBar } from "@/components/AppTopBar";
import { useMe } from "@/components/AuthGate";
import { TestLogin } from "@/components/TestLogin";
import { ThemeChooser } from "@/components/ThemeToggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type Quota } from "@/lib/api";
import { LOCAL_AUTH, signOut } from "@/lib/auth";

function Allowance({ label, used, limit }: { label: string; used: number; limit: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{limit - used} of {limit} left</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (used / Math.max(limit, 1)) * 100)}%` }} />
      </div>
    </div>
  );
}

export default function AccountPage() {
  const me = useMe();
  const router = useRouter();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Quota>("/me/quota").then(setQuota, (e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <AppTopBar title="Account" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-secondary font-heading text-xl font-bold uppercase" aria-hidden="true">
            {me.email?.[0] ?? "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-medium">{me.email}</p>
            <p className="text-muted-foreground">{me.role === "ADMIN" ? "Admin" : "Member"}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">This month</CardTitle>
            <CardDescription>
              {quota
                ? `Your limits reset on ${new Date(quota.resetsOn).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`
                : "Your monthly limits."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!quota && !error && (
              <>
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </>
            )}
            {quota && (
              <>
                <Allowance label="Bins added" used={quota.used.registrations} limit={quota.limits.registrations} />
                <Allowance label="Missing reports" used={quota.used.missingReports} limit={quota.limits.missingReports} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appearance</CardTitle>
            <CardDescription>System follows your phone&apos;s light or dark setting.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeChooser />
          </CardContent>
        </Card>

        {LOCAL_AUTH && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Testing</CardTitle>
              <CardDescription>Local mode only. Switch accounts in one tap.</CardDescription>
            </CardHeader>
            <CardContent>
              <TestLogin variant="inline" />
            </CardContent>
          </Card>
        )}

        <Button size="xl" variant="secondary" onClick={() => signOut().then(() => router.replace("/"))}>
          <LogOutIcon data-icon="inline-start" />
          Sign out
        </Button>
      </main>
    </>
  );
}
