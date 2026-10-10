import { SITE } from "@/lib/site";

// Store buttons for the phone app. Until a store link is set in lib/site.ts the button says
// "Coming soon" and goes nowhere; filling in the link makes it a real one.

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden="true">
      <path d="M3.6 2.3 13.5 12l-9.9 9.7c-.4-.2-.6-.6-.6-1.1V3.4c0-.5.2-.9.6-1.1Z" fill="#00d7fe" />
      <path d="m16.8 8.7-3.3 3.3-9.9-9.7c.2-.1.5-.1.8.1l12.4 6.3Z" fill="#00f076" />
      <path d="m16.8 15.3-12.4 6.3c-.3.2-.6.2-.8.1l9.9-9.7 3.3 3.3Z" fill="#ff3a44" />
      <path d="m20.6 13.3-3.8 2-3.3-3.3 3.3-3.3 3.8 2c1 .5 1 2.1 0 2.6Z" fill="#ffd400" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 fill-current" aria-hidden="true">
      <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4 1-1.4 1.4-2.7 1.4-2.8-.1 0-2.6-1-2.6-4.2ZM13.9 5c.7-.8 1.1-1.9 1-3-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.6 2.9-1.4Z" />
    </svg>
  );
}

function StoreButton({ href, icon, store }: { href: string; icon: React.ReactNode; store: string }) {
  const look = "flex h-14 min-w-44 items-center gap-3 rounded-full px-5 text-left";
  const label = (top: string) => (
    <span className="flex flex-col leading-tight">
      <span className="text-xs opacity-75">{top}</span>
      <span className="font-heading text-lg font-bold">{store}</span>
    </span>
  );
  if (!href) {
    return (
      <span aria-disabled="true" className={`${look} cursor-default bg-current/10`} title={`${store}: coming soon`}>
        {icon}
        {label("Coming soon to")}
      </span>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${look} bg-current/10 outline-none hover:bg-current/15 focus-visible:ring-2 focus-visible:ring-current`}>
      {icon}
      {label(store === "App Store" ? "Download on the" : "Get it on")}
    </a>
  );
}

export function AppBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <StoreButton href={SITE.appLinks.android} icon={<PlayIcon />} store="Google Play" />
      <StoreButton href={SITE.appLinks.ios} icon={<AppleIcon />} store="App Store" />
    </div>
  );
}
