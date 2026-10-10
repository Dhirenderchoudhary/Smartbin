import { LocateFixedIcon } from "lucide-react";
import Link from "next/link";
import { HeroMap, RuleDiagram, StreetBin } from "@/components/landing/illustrations";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { Button } from "@/components/ui/button";
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

// Uber Move-style display: bold, sentence case, tight leading, no letter-spacing changes
const display = "font-heading font-bold leading-[1.08]";

const typeChoices = [
  { value: "ALL", label: "Any bin" },
  { value: "WET", label: "Wet" },
  { value: "DRY", label: "Dry" },
];

const bins = [
  {
    type: "WET" as const,
    label: "गीला",
    name: "Wet waste",
    colour: "text-wet",
    items: ["Food scraps", "Fruit and vegetable peels", "Tea leaves and coffee grounds", "Flowers and leaves"],
  },
  {
    type: "DRY" as const,
    label: "सूखा",
    name: "Dry waste",
    colour: "text-dry",
    items: ["Paper and cardboard", "Plastic bottles and wrappers", "Cans and tins", "Glass"],
  },
];

const steps = [
  { title: "Take a photo of the bin", body: "Stand next to it. Your phone adds the location for you." },
  { title: "We check the photo", body: "A quick check confirms there's a dustbin in the picture, so the map stays clean." },
  { title: "It's on the map", body: "Anyone nearby can now find it, and see whether it takes wet or dry waste." },
];

const rules = [
  {
    diagram: "spacing" as const,
    title: "One bin per spot",
    body: "If a bin is already on the map within 15 metres, a second one can't be added on top of it.",
  },
  {
    diagram: "nearby" as const,
    title: "Report from the spot",
    body: "To report a bin as missing, you have to be standing within 20 metres of where it should be.",
  },
  {
    diagram: "reports" as const,
    title: "Three reports and it's gone",
    body: "When three different people report a bin missing, it comes off the map. If it's still there, anyone can add it back.",
  },
];

const history = [
  { when: "2 Oct, 9:14 am", what: "Added with a photo", tone: "bg-wet" },
  { when: "6 Oct, 6:40 pm", what: "Reported missing, 1 of 3", tone: "bg-warning" },
  { when: "7 Oct, 8:02 am", what: "Reported missing, 2 of 3", tone: "bg-warning" },
  { when: "7 Oct, 12:55 pm", what: "Reported missing, 3 of 3. Removed from the map", tone: "bg-destructive" },
];

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: the question people actually ask, answered by the map */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 md:grid-cols-[0.9fr_1.1fr] md:gap-12 md:pt-16 md:pb-24">
          <div className="flex flex-col gap-6">
            <h1 className={`${display} text-5xl sm:text-6xl lg:text-7xl`}>Where&apos;s the nearest dustbin?</h1>
            <p className="max-w-[38ch] text-lg leading-relaxed text-muted-foreground">
              SmartBin is a map of public dustbins, kept up to date by the people who use them. See the closest one, and
              whether it takes wet or dry waste.
            </p>

            {/* Uber's request card, for bins: a plain GET form, so it works before any JavaScript loads */}
            <form action="/app" method="get" className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sheet sm:p-5">
              <p className="font-heading text-xl font-bold">Find a bin</p>
              <div className="flex h-12 items-center gap-3 rounded-lg bg-input px-4">
                <LocateFixedIcon className="size-5" aria-hidden="true" />
                <span>Your current location</span>
              </div>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Waste type</legend>
                {typeChoices.map((choice, i) => (
                  <label
                    key={choice.value}
                    className="flex h-10 cursor-pointer items-center rounded-full bg-secondary px-4 text-[15px] font-medium has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2"
                  >
                    <input type="radio" name="type" value={choice.value} defaultChecked={i === 0} className="sr-only" />
                    {choice.label}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" size="xl" className="mt-1">Find nearest bin</Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Spotted one that isn&apos;t on the map?{" "}
              <Link href="/app/add" className="font-medium text-foreground underline underline-offset-4">Add a bin</Link>
            </p>
          </div>
          <HeroMap />
        </section>

        {/* What goes where */}
        <section className="bg-card">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-[1fr_1.4fr] md:py-28">
            <div className="flex flex-col gap-4">
              <h2 className={`${display} text-5xl sm:text-6xl`}>Green for wet, blue for dry</h2>
              <p className="max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
                Most Indian cities sort street waste into two bins. SmartBin marks every bin with what it takes, so you know
                before you walk over. Bins that take both are marked wet and dry.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6 sm:gap-10">
              {bins.map((bin) => (
                <div key={bin.type} className="flex flex-col gap-5">
                  <StreetBin type={bin.type} label={bin.label} />
                  <div>
                    <h3 className={`font-heading text-2xl font-bold ${bin.colour}`}>{bin.name}</h3>
                    <ul className="mt-3 flex flex-col gap-2 text-[15px] leading-snug sm:text-base">
                      {bin.items.map((item) => (
                        <li key={item} className="border-b border-border pb-2 last:border-0">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Adding a bin: a real sequence, so it's numbered */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <h2 className={`${display} max-w-[14ch] text-5xl sm:text-6xl`}>Add a bin in under a minute</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-5 md:flex-col md:gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-xl font-bold text-primary-foreground" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="max-w-[34ch] leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The rules, drawn rather than described */}
        <section className="mx-auto max-w-6xl px-4 pb-20 md:pb-28">
          <h2 className={`${display} max-w-[16ch] text-5xl sm:text-6xl`}>Three rules keep the map honest</h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
            {rules.map((rule) => (
              <div key={rule.title} className="flex flex-col gap-5">
                <RuleDiagram rule={rule.diagram} />
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-xl font-bold">{rule.title}</h3>
                  <p className="max-w-[36ch] leading-relaxed text-muted-foreground">{rule.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* For city and campus teams: one bin's history, as the admin dashboard shows it */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center md:py-28">
            <div className="flex flex-col gap-5">
              <h2 className={`${display} text-5xl sm:text-6xl`}>Every bin keeps its history</h2>
              <p className="max-w-[40ch] text-lg leading-relaxed text-primary-foreground/75">
                City and campus teams get a dashboard of every bin in their area: when it was added, each missing report,
                and why it was removed. Bins can be renamed, corrected or cleared of reports when a report was wrong.
              </p>
              <Button
                size="xl"
                variant="secondary"
                className="self-start"
                render={<Link href="/admin/login" />}
                nativeButton={false}
              >
                Admin sign in
              </Button>
            </div>
            <div className="rounded-2xl bg-primary-foreground/8 p-6 sm:p-8">
              <p className="font-heading text-xl font-bold">Bus stop, MG Road</p>
              <p className="text-sm text-primary-foreground/60">Dry waste</p>
              <ol className="mt-6 flex flex-col">
                {history.map((event, i) => (
                  <li key={event.when} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < history.length - 1 && <span className="absolute top-4 left-1.25 h-full w-px bg-primary-foreground/25" aria-hidden="true" />}
                    <span className={`relative mt-1.5 size-2.75 shrink-0 rounded-full ${event.tone}`} aria-hidden="true" />
                    <div>
                      <p className="font-semibold">{event.what}</p>
                      <p className="text-sm text-primary-foreground/60">{event.when}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:py-28">
          <h2 className={`${display} max-w-[16ch] text-5xl sm:text-7xl`}>Seen a bin that isn&apos;t on the map?</h2>
          <p className="max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
            Add it from where you&apos;re standing. The next person looking for a bin will find it.
          </p>
          <Button size="xl" render={<Link href="/signup" />} nativeButton={false}>Add a bin</Button>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
