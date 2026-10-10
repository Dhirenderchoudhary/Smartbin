"use client";

import { ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DEMO_ACCOUNTS, LOCAL_AUTH, signIn } from "@/lib/auth";

// One-click "sign in as" buttons for testing. Local mode only: renders nothing with Cognito.
// A full page load afterwards, so nothing from the previous account lingers.
export function TestLogin({ variant = "strip" }: { variant?: "strip" | "inline" }) {
  const [busy, setBusy] = useState<"user" | "admin" | null>(null);
  if (!LOCAL_AUTH) return null;

  async function go(as: "user" | "admin") {
    setBusy(as);
    await signIn(DEMO_ACCOUNTS[as], "demo");
    window.location.assign(as === "admin" ? "/admin" : "/app");
  }

  const buttons = (
    <>
      <Button size={variant === "strip" ? "sm" : "lg"} variant={variant === "strip" ? "default" : "secondary"} disabled={!!busy} onClick={() => go("user")}>
        {busy === "user" ? <Spinner data-icon="inline-start" /> : <UserRoundIcon data-icon="inline-start" />}
        Test as user
      </Button>
      <Button size={variant === "strip" ? "sm" : "lg"} variant={variant === "strip" ? "default" : "secondary"} disabled={!!busy} onClick={() => go("admin")}>
        {busy === "admin" ? <Spinner data-icon="inline-start" /> : <ShieldCheckIcon data-icon="inline-start" />}
        Test as admin
      </Button>
    </>
  );

  if (variant === "inline") return <div className="flex flex-wrap gap-2">{buttons}</div>;
  return (
    <div className="bg-warning text-warning-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
        <span className="text-sm font-medium">Local test mode</span>
        <div className="flex gap-2 *:h-9 *:px-3">{buttons}</div>
      </div>
    </div>
  );
}
