"use client";

import {
  ActivityIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  ListIcon,
  MapIcon,
  MenuIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/AuthGate";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { TestLogin } from "@/components/TestLogin";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAdminData, type Stats } from "@/lib/admin";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/admin/map", label: "Map", icon: MapIcon },
  { href: "/admin/cleaning", label: "Cleaning", icon: SparklesIcon },
  { href: "/admin/bins", label: "Bins", icon: ListIcon },
  { href: "/admin/activity", label: "Activity", icon: ActivityIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  // Refreshes on every page change, so the count drops after clearing the queue
  const { data: stats } = useAdminData<Stats>(`/admin/stats?at=${encodeURIComponent(pathname)}`);
  const waiting = stats?.issues.needsCleaning ?? 0;

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className="flex h-11 items-center gap-3 rounded-xl px-3 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="flex-1">{label}</span>
            {href === "/admin/cleaning" && waiting > 0 && (
              <Badge variant="warning" aria-label={`${waiting} bins need cleaning`}>
                {waiting}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer() {
  const me = useMe();
  return (
    <div className="mt-auto flex flex-col gap-2 border-t pt-4">
      <Link
        href="/app"
        className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ExternalLinkIcon className="size-4" aria-hidden="true" />
        Open the user app
      </Link>
      <div className="px-1 *:flex-col *:*:w-full">
        <TestLogin variant="inline" />
      </div>
      <p className="truncate px-3 text-sm text-muted-foreground" title={me.email ?? undefined}>
        {me.email}
      </p>
      <div className="flex items-center justify-between">
        <SignOutButton to="/admin/login" />
        <ThemeToggle />
      </div>
    </div>
  );
}

// Sidebar on wide screens; a top bar with a slide-out menu on phones and tablets
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = NAV.find((n) => (n.href === "/admin" ? pathname === n.href : pathname.startsWith(n.href)))?.label ?? "Admin";

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-card p-4 lg:flex">
        <div className="flex items-center gap-2 px-1">
          <Logo href="/admin" />
          <Badge variant="secondary">Admin</Badge>
        </div>
        <NavLinks />
        <Footer />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-2 lg:hidden">
          <Button variant="ghost" size="icon-lg" aria-label="Open menu" onClick={() => setOpen(true)}>
            <MenuIcon />
          </Button>
          <span className="font-heading text-lg font-bold">{title}</span>
        </header>
        {children}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 gap-6 p-4">
          <SheetTitle className="flex items-center gap-2 px-1">
            <Logo href="/admin" />
            <Badge variant="secondary">Admin</Badge>
          </SheetTitle>
          <NavLinks onNavigate={() => setOpen(false)} />
          <Footer />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Page frame: heading, optional actions on the right, then content
export function AdminPage({
  title,
  description,
  actions,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8 ${wide ? "max-w-none" : "max-w-7xl"}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </main>
  );
}
