import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "Nearby bins", robots: { index: false } };

export default function UserLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <Logo href="/app" />
        <SignOutButton />
      </header>
      <AuthGate>{children}</AuthGate>
    </div>
  );
}
