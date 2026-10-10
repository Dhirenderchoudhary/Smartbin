import Image from "next/image";

// Real SmartBin screens (public/landing), in a phone or a browser window.
// Both themes are in the page; the site theme decides which one shows.

export type AppScreen = "map" | "selected" | "preview" | "walking" | "arrived" | "add-where" | "add-details";

export function Screen({ name, alt, priority = false, sizes }: { name: AppScreen; alt: string; priority?: boolean; sizes: string }) {
  return (
    <>
      <Image src={`/landing/app-${name}-light.webp`} alt={alt} width={780} height={1688} sizes={sizes} priority={priority} className="h-full w-full object-cover dark:hidden" />
      <Image src={`/landing/app-${name}-dark.webp`} alt={alt} width={780} height={1688} sizes={sizes} priority={priority} className="hidden h-full w-full object-cover dark:block" />
    </>
  );
}

export function PhoneFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[2.75rem] bg-[#0b0b0b] p-[0.55rem] shadow-[0_24px_60px_-12px_rgb(0_0_0/0.45)] ring-1 ring-black/10 dark:ring-white/15 ${className}`}>
      <div className="relative aspect-[390/844] overflow-hidden rounded-[2.25rem] bg-map">{children}</div>
    </div>
  );
}

export function BrowserFrame({ alt, className = "" }: { alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-card shadow-[0_24px_60px_-12px_rgb(0_0_0/0.5)] ring-1 ring-border ${className}`}>
      <div className="flex h-9 items-center gap-1.5 border-b border-border px-4" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="mx-auto rounded-full bg-muted px-4 py-0.5 text-xs text-muted-foreground">SmartBin admin</span>
      </div>
      <Image src="/landing/admin-light.webp" alt={alt} width={1600} height={1000} sizes="(min-width: 768px) 600px, 100vw" className="block h-auto w-full dark:hidden" />
      <Image src="/landing/admin-dark.webp" alt={alt} width={1600} height={1000} sizes="(min-width: 768px) 600px, 100vw" className="hidden h-auto w-full dark:block" />
    </div>
  );
}
