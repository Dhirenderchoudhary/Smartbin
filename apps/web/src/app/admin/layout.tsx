import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { AuthGate } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-2">
          <Logo href="/admin" />
          <Badge variant="secondary">Admin</Badge>
        </div>
        <SignOutButton to="/admin/login" />
      </header>
      <AuthGate role="ADMIN">{children}</AuthGate>
    </div>
  );
}
