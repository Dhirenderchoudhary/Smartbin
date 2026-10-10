import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · SmartBin admin" }, robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AuthGate role="ADMIN">
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
