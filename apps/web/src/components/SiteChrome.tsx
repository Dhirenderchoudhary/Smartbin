import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";
import { TestLogin } from "./TestLogin";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-background">
      <TestLogin />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo compact />
        <nav className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="lg" render={<Link href="/login" />} nativeButton={false}>
            Sign in
          </Button>
          <Button size="lg" render={<Link href="/signup" />} nativeButton={false}>
            Get started
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-primary-foreground/60">© {new Date().getFullYear()} SmartBin. Built for cleaner Indian streets.</p>
        </div>
        <nav className="-my-2 flex gap-6 text-sm text-primary-foreground/80 *:py-3">
          <Link href="/privacy" className="hover:text-primary-foreground">Privacy</Link>
          <Link href="/login" className="hover:text-primary-foreground">Sign in</Link>
          <Link href="/admin/login" className="hover:text-primary-foreground">Admin</Link>
        </nav>
      </div>
    </footer>
  );
}
