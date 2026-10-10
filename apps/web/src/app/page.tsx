import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { SITE } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web, Android, iOS",
  areaServed: "IN",
  offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
};

const steps = [
  { title: "Snap the bin", body: "Stand next to a public dustbin and take a photo. Your location is added for you." },
  { title: "AI checks the photo", body: "We confirm there's really a dustbin in the picture, so the map stays clean." },
  { title: "It's on the map", body: "Everyone nearby can now find it, and see whether it takes wet or dry waste." },
];

const rules = [
  { stat: "15 m", label: "One bin per spot", body: "A new bin can't be added within 15 metres of one already on the map." },
  { stat: "20 m", label: "Reports from the spot", body: "To flag a bin as missing you need to be standing within 20 metres of it." },
  { stat: "3", label: "Reports remove a bin", body: "Three people reporting a bin missing takes it off the map until someone adds it again." },
];

const sampleBins = [
  { name: "Metro gate 2", type: "WET", distance: "40 m" },
  { name: "Bus stop, MG Road", type: "DRY", distance: "85 m" },
  { name: "Market corner", type: "BOTH", distance: "120 m" },
] as const;

function TypeBadge({ type }: { type: "WET" | "DRY" | "BOTH" }) {
  const variant = { WET: "wet", DRY: "dry", BOTH: "secondary" } as const;
  return <Badge variant={variant[type]}>{type === "BOTH" ? "Wet + dry" : type === "WET" ? "Wet" : "Dry"}</Badge>;
}

function PhonePreview() {
  return (
    <div className="mx-auto w-full max-w-75 rounded-[2.2rem] border border-border bg-card p-3 shadow-xl shadow-primary/10" aria-hidden="true">
      <div className="overflow-hidden rounded-[1.6rem] bg-background">
        <div className="relative h-40 bg-secondary">
          <svg viewBox="0 0 280 160" className="absolute inset-0 size-full" preserveAspectRatio="none">
            <path d="M0 110 C 70 90, 120 130, 280 80" stroke="var(--card)" strokeWidth="14" fill="none" />
            <path d="M90 0 L 130 160" stroke="var(--card)" strokeWidth="10" fill="none" />
            <path d="M200 0 C 190 60, 230 100, 220 160" stroke="var(--card)" strokeWidth="8" fill="none" />
          </svg>
          {[
            ["left-[38%] top-[48%]", "bg-wet"],
            ["left-[64%] top-[30%]", "bg-dry"],
            ["left-[20%] top-[22%]", "bg-primary"],
          ].map(([pos, color]) => (
            <span key={pos} className={`absolute ${pos} size-4 rounded-full border-2 border-card ${color} shadow`} />
          ))}
          <span className="absolute left-[50%] top-[62%] size-3 rounded-full bg-ink ring-4 ring-ink/15" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nearest bins</p>
          {sampleBins.map((bin) => (
            <div key={bin.name} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">{bin.name}</p>
                <TypeBadge type={bin.type} />
              </div>
              <span className="text-sm font-semibold text-primary">{bin.distance}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-5xl gap-10 px-4 pb-14 pt-10 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-20">
          <div>
            <Badge variant="secondary" className="mb-4 h-7 px-3 text-sm">A community map of public dustbins</Badge>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Find the nearest dustbin in seconds.
            </h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
              SmartBin shows you the closest public bin, tells you if it takes wet or dry waste, and lets you add the ones
              that aren&apos;t on the map yet.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button size="xl" render={<Link href="/app" />} nativeButton={false}>Find bins near me</Button>
              <Button size="xl" variant="outline" render={<Link href="/signup" />} nativeButton={false}>Add a bin</Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Free to use. Works in your phone&apos;s browser.</p>
          </div>
          <PhonePreview />
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-14">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Add a bin in three steps</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title} className="rounded-2xl bg-background p-5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Kept accurate by the people who use it</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">A few simple rules stop duplicates and keep bins that are gone off the map.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {rules.map((rule) => (
              <Card key={rule.label}>
                <CardHeader>
                  <p className="text-3xl font-bold text-primary">{rule.stat}</p>
                  <CardTitle className="text-base">{rule.label}</CardTitle>
                  <CardDescription className="leading-relaxed">{rule.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">Wet or dry?</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Every bin is marked for the waste it takes. In most Indian cities, <span className="font-semibold text-wet">green bins</span> are for
                  wet waste like food and peels, and <span className="font-semibold text-dry">blue bins</span> are for dry waste like paper, plastic and
                  cans.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-bold">For city and campus teams</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  The admin dashboard shows every bin, new additions, missing reports and removals, with a full history for each bin.
                </CardDescription>
                <Link href="/admin/login" className="mt-2 font-semibold text-primary hover:underline">Admin sign in →</Link>
              </CardHeader>
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="rounded-3xl bg-primary px-6 py-10 text-center text-primary-foreground">
            <h2 className="text-2xl font-bold sm:text-3xl">Spotted a bin that isn&apos;t on the map?</h2>
            <p className="mx-auto mt-2 max-w-md opacity-90">It takes less than a minute to add it, and it helps everyone around you.</p>
            <Button size="xl" variant="secondary" className="mt-6" render={<Link href="/signup" />} nativeButton={false}>
              Create a free account
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
