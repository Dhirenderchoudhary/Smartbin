import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { robots: { index: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">{children}</main>
      <footer className="pb-6 text-center text-sm text-muted-foreground">
        <Link href="/privacy" className="hover:text-foreground">Privacy policy</Link>
      </footer>
    </div>
  );
}
