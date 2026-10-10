import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 1.5C9.6 1.5 4.5 6.6 4.5 13c0 8.6 11.5 17.5 11.5 17.5S27.5 21.6 27.5 13C27.5 6.6 22.4 1.5 16 1.5z" fill="var(--primary)" />
      <path
        d="M10.5 10.5h11M14 8.5h4M12 10.5l1 8.5h6l1-8.5M15 13v4M17 13v4"
        fill="none"
        stroke="var(--primary-foreground)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
      <LogoMark />
      SmartBin
    </Link>
  );
}
