"use client";

import { AlertCircleIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, type Me } from "@/lib/api";
import { LOCAL_AUTH, signIn, signOut, signUp } from "@/lib/auth";

type Mode = "login" | "signup" | "admin";

const copy: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to find and add bins near you.", submit: "Sign in" },
  signup: { title: "Create your account", subtitle: "Free, and takes a few seconds.", submit: "Create account" },
  admin: { title: "Admin sign in", subtitle: "For SmartBin city and campus teams.", submit: "Sign in" },
};

// One-click accounts for local mode (the API treats DEV_ADMIN_EMAILS as admins)
const DEMO = { user: "demo@smartbin.local", admin: "admin@smartbin.local" };

// Only same-site paths, so ?next= can't send people to another website
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = copy[mode];

  // asAdmin: the account must be an admin (admin page, or the quick admin button)
  async function enter(email: string, password: string, asAdmin: boolean) {
    setError(null);
    setBusy(true);
    try {
      await (mode === "signup" ? signUp : signIn)(email, password);
      const me = await api<Me>("/me");
      if (asAdmin && me.role !== "ADMIN") {
        await signOut();
        throw new Error("This account doesn't have admin access.");
      }
      router.replace(nextPath() ?? (me.role === "ADMIN" ? "/admin" : "/app"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    enter(String(form.get("email")), String(form.get("password")), mode === "admin");
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{text.title}</h1>
        <p className="mt-1 text-muted-foreground">{text.subtitle}</p>
      </div>

      {LOCAL_AUTH && mode !== "signup" && (
        <>
          <div className="flex flex-col gap-2">
            <Button size="xl" variant="secondary" disabled={busy} onClick={() => enter(DEMO.user, "demo", false)}>
              <UserRoundIcon data-icon="inline-start" />
              Continue as user
            </Button>
            <Button size="xl" variant="secondary" disabled={busy} onClick={() => enter(DEMO.admin, "demo", true)}>
              <ShieldCheckIcon data-icon="inline-start" />
              Continue as admin
            </Button>
          </div>
          <p className="-mt-3 text-sm text-muted-foreground">
            Local mode: one click, or any email and password below.
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
            />
            {mode === "signup" && <FieldDescription>At least 8 characters.</FieldDescription>}
          </Field>

          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="xl" disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            {busy ? "Please wait…" : text.submit}
          </Button>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" && (
          <>New to SmartBin? <Link href="/signup" className="font-semibold text-primary hover:underline">Create an account</Link></>
        )}
        {mode === "signup" && (
          <>Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></>
        )}
        {mode === "admin" && (
          <>Not an admin? <Link href="/login" className="font-semibold text-primary hover:underline">User sign in</Link></>
        )}
      </p>
    </div>
  );
}
