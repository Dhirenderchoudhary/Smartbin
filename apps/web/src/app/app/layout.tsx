import type { Metadata } from "next";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = { title: "Nearby bins", robots: { index: false } };

export default function UserLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex flex-1 flex-col">
      <AuthGate>{children}</AuthGate>
    </div>
  );
}
