"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api, ApiError, type Me, type Role } from "@/lib/api";
import { getToken, signOut } from "@/lib/auth";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside <AuthGate>");
  return me;
}

// Client-side guard for signed-in areas. The API enforces roles itself;
// this only keeps people off pages they can't use.
export function AuthGate({ role, children }: { role?: Role; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const loginPath = role === "ADMIN" ? "/admin/login" : "/login";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const toLogin = () => router.replace(`${loginPath}?next=${encodeURIComponent(pathname)}`);
      if (!(await getToken())) return toLogin();
      try {
        const user = await api<Me>("/me");
        if (cancelled) return;
        if (role === "ADMIN" && user.role !== "ADMIN") {
          setProblem("This account doesn't have admin access.");
        } else {
          setMe(user);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return toLogin();
        setProblem(err instanceof Error ? err.message : "Something went wrong, try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role, pathname, loginPath, router]);

  if (problem) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <Alert variant="destructive" className="max-w-sm">
          <AlertCircleIcon />
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
        <div className="flex gap-3">
          <Button variant="outline" size="xl" onClick={() => window.location.reload()}>Try again</Button>
          <Button size="xl" onClick={() => signOut().then(() => router.replace(loginPath))}>Sign in again</Button>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-8 text-primary" />
      </div>
    );
  }

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}
