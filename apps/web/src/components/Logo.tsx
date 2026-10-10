import Link from "next/link";
import { useId } from "react";

// Rounded tile with the bin cut out, so it inverts cleanly on black or white (follows currentColor)
export function LogoMark({ className = "size-8" }: { className?: string }) {
  const maskId = useId(); // unique per logo, so a hidden copy can't break a visible one
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <mask id={maskId}>
        <rect width={32} height={32} fill="white" />
        <path
          d="M9 11h14M13.5 8.5h5M11 11l1.3 12.5h7.4L21 11M14.6 14.5v5.5M17.4 14.5v5.5"
          fill="none"
          stroke="black"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <rect width={32} height={32} rx={9} fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} aria-label="SmartBin home" className="flex items-center gap-2 font-heading text-xl font-bold text-current">
      <LogoMark />
      {/* compact: wordmark hidden on phones where the header is tight */}
      <span className={compact ? "max-sm:sr-only" : undefined}>SmartBin</span>
    </Link>
  );
}
