"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";

export function SignOutButton({ to = "/" }: { to?: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" size="lg" onClick={() => signOut().then(() => router.replace(to))}>
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  );
}
