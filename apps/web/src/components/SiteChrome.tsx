import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Logo } from "./Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo />
        <nav className="flex items-center gap-2">
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
    <footer>
      <Separator />
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} SmartBin. Built for cleaner Indian streets.</p>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
          <Link href="/admin/login" className="hover:text-foreground">Admin</Link>
        </nav>
      </div>
    </footer>
  );
}
