import { SmartphoneIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE } from "@/lib/site";
import { AppBadges } from "./landing/AppBadges";
import { Logo } from "./Logo";
import { TestLogin } from "./TestLogin";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-background">
      <TestLogin />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo compact />
        <nav className="flex items-center gap-0.5 sm:gap-2">
          <ThemeToggle />
          <Button variant="outline" size="lg" className="max-md:hidden" render={<Link href="/#get-the-app" />} nativeButton={false}>
            <SmartphoneIcon data-icon="inline-start" />
            Get the app
          </Button>
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

const FOOTER_LINKS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Use SmartBin",
    links: [
      { href: "/app", label: "Find a bin" },
      { href: "/app/add", label: "Add a bin" },
      { href: "/#get-the-app", label: "Get the app" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create an account" },
      { href: "/admin/login", label: "Admin sign in" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/landing/CREDITS.md", label: "Image credits" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col items-start gap-5">
            <Logo />
            <p className="max-w-[30ch] text-primary-foreground/70">{SITE.tagline}</p>
            <AppBadges />
          </div>
          {FOOTER_LINKS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-medium">{col.title}</p>
              <ul className="mt-3 flex flex-col">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="inline-block py-2 text-primary-foreground/70 hover:text-primary-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-primary-foreground/15 pt-6 text-sm text-primary-foreground/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} SmartBin. Built for cleaner Indian streets.</p>
          <p>Free to use, everywhere in India.</p>
        </div>
      </div>
    </footer>
  );
}
