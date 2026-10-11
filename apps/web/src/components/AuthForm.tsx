"use client";

import { AlertCircleIcon, MailCheckIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api, type Me } from "@/lib/api";
import {
  ConfirmationRequiredError,
  DEMO_ACCOUNTS as DEMO,
  LOCAL_AUTH,
  PASSWORD_HINT,
  confirmSignUp,
  resendCode,
  signIn,
  signOut,
  signUp,
} from "@/lib/auth";

type Mode = "login" | "signup" | "admin";

const copy: Record<Mode, { title: string; subtitle: string; submit: string }> = {
  login: { title: "Welcome back", subtitle: "Sign in to find and add bins near you.", submit: "Sign in" },
  signup: { title: "Create your account", subtitle: "Free, and takes a few seconds.", submit: "Create account" },
  admin: { title: "Admin sign in", subtitle: "For SmartBin city and campus teams.", submit: "Sign in" },
};

// Only same-site paths, so ?next= can't send people to another website
function nextPath(): string | null {
  const next = new URLSearchParams(window.location.search).get("next");
  return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when Cognito needs the emailed code; the password is kept to sign in right after
  const [confirming, setConfirming] = useState<{ email: string; password: string; asAdmin: boolean } | null>(null);
  // After a verified sign-up, the form signs in instead of creating the account again
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const signingUp = mode === "signup" && !verifiedEmail;
  const text = verifiedEmail ? copy.login : copy[mode];

  // Signed in: check the role, then go to the right place
  async function finish(asAdmin: boolean) {
    const me = await api<Me>("/me");
    if (asAdmin && me.role !== "ADMIN") {
      await signOut();
      throw new Error("This account doesn't have admin access.");
    }
    router.replace(nextPath() ?? (me.role === "ADMIN" ? "/admin" : "/app"));
  }

  async function run(action: () => Promise<void>, asAdmin: boolean, pending?: { email: string; password: string }) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      await finish(asAdmin);
    } catch (err) {
      if (err instanceof ConfirmationRequiredError && pending) {
        setConfirming({ ...pending, asAdmin });
        setNotice(`We sent a 6-digit code to ${pending.email}.`);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong, try again.");
      }
      setBusy(false);
    }
  }

  // asAdmin: the account must be an admin (admin page, or the quick admin button)
  function enter(email: string, password: string, asAdmin: boolean) {
    run(() => (signingUp ? signUp : signIn)(email, password), asAdmin, { email, password });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    enter(String(form.get("email")).trim(), String(form.get("password")), mode === "admin");
  }

  async function onConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!confirming) return;
    const { email, password, asAdmin } = confirming;
    const code = String(new FormData(e.currentTarget).get("code"));
    setError(null);
    setBusy(true);
    try {
      await confirmSignUp(email, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
      setBusy(false);
      return;
    }
    // The code is used up now: never ask for it again. If anything after this fails, go back to
    // the sign-in form, where signing in again works.
    setConfirming(null);
    setVerifiedEmail(email);
    setNotice(null);
    try {
      await signIn(email, password);
      await finish(asAdmin);
    } catch (err) {
      setNotice("Your email is verified. Sign in to continue.");
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
      setBusy(false);
    }
  }

  async function onResend() {
    if (!confirming) return;
    setError(null);
    try {
      await resendCode(confirming.email);
      setNotice(`New code sent to ${confirming.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a new code, try again.");
    }
  }

  const alerts = (
    <>
      {notice && (
        <Alert role="status">
          <MailCheckIcon />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </>
  );

  if (confirming) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-1 text-muted-foreground">Enter the code to finish creating your account.</p>
        </div>

        <form onSubmit={onConfirm}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="code">Verification code</FieldLabel>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                placeholder="123456"
              />
              <FieldDescription>Can&apos;t find it? Check spam, or send a new one.</FieldDescription>
            </Field>

            {alerts}

            <Button type="submit" size="xl" disabled={busy}>
              {busy && <Spinner data-icon="inline-start" />}
              {busy ? "Please wait…" : "Verify and continue"}
            </Button>
          </FieldGroup>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <button type="button" onClick={onResend} disabled={busy} className="font-semibold text-primary hover:underline">
            Send a new code
          </button>
          {" · "}
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
              setNotice(null);
              setError(null);
            }}
            className="font-semibold text-primary hover:underline"
          >
            Use a different email
          </button>
        </p>
      </div>
    );
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
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              defaultValue={verifiedEmail ?? undefined}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={signingUp ? "new-password" : "current-password"}
              required
              minLength={signingUp ? 8 : undefined}
            />
            {signingUp && <FieldDescription>{PASSWORD_HINT}</FieldDescription>}
          </Field>

          {alerts}

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
