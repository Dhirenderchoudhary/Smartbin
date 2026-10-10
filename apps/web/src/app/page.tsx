import { CheckCircle2Icon, LocateFixedIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AppBadges } from "@/components/landing/AppBadges";
import { BrowserFrame, PhoneFrame, Screen } from "@/components/landing/Frames";
import { RuleDiagram, StreetBin } from "@/components/landing/illustrations";
import { LiveMap } from "@/components/landing/LiveMap";
import { Magnetic, MotionRoot, Reveal, Tilt } from "@/components/landing/Motion";
import { ParallaxPhoto, ScrollStory, type StoryStep } from "@/components/landing/ScrollStory";
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
const display = "font-heading font-bold leading-[1.05]";

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

const walkSteps: StoryStep[] = [
  {
    screen: "map",
    title: "See every bin around you",
    body: "Green pins take wet waste, blue take dry, and half-and-half take both. The nearest are listed under the map, closest first.",
    alt: "SmartBin map with bins around you and a list of the nearest ones",
  },
  {
    screen: "selected",
    title: "Check it before you walk",
    body: "Open a bin to see its photo and anything people have reported, like it being full. Whoever empties it can mark it sorted.",
    alt: "A bin opened in SmartBin, with its photo, a 'Full' report and Directions",
  },
  {
    screen: "preview",
    title: "Get a walking route",
    body: "See how many minutes it takes and when you'll get there, then tap Start.",
    alt: "Route preview: a walking route to the bin, 7 minutes, with a Start button",
  },
  {
    screen: "walking",
    title: "Walk there, turn by turn",
    body: "The map turns with you and shows the next turn. Take a different street and the route follows you.",
    alt: "Turn-by-turn navigation showing the next turn and the time left",
  },
  {
    screen: "arrived",
    title: "Drop it in",
    body: "SmartBin tells you when you've arrived. If the bin is full, broken or gone, report it from right there.",
    alt: "'You've arrived' at the bin, with a Done button",
  },
];

const addSteps = [
  { title: "Pin it", body: "Move the map until the pin sits on the bin. SmartBin warns you if it's already on the map.", screen: "add-where" as const, alt: "Placing the pin on a new bin" },
  { title: "Take a photo", body: "Snap the bin and choose wet, dry or both. A quick check confirms there's a dustbin in the picture.", screen: "add-details" as const, alt: "Adding a photo and the waste type" },
  { title: "It's on the map", body: "Anyone nearby can now find it, and see what it takes before they walk over.", screen: "map" as const, alt: "The map with the new bin added" },
];

const rules = [
  { diagram: "spacing" as const, title: "One bin per spot", body: "If a bin is already on the map within 15 metres, a second one can't be added on top of it." },
  { diagram: "nearby" as const, title: "Report from the spot", body: "To report a bin as missing, you have to be standing within 20 metres of where it should be." },
  { diagram: "reports" as const, title: "Three reports and it's gone", body: "When three different people report a bin missing, it comes off the map. If it's still there, anyone can add it back." },
];

const history = [
  { when: "2 Oct, 9:14 am", what: "Added with a photo", tone: "bg-wet" },
  { when: "6 Oct, 6:40 pm", what: "Reported full, 4 people", tone: "bg-warning" },
  { when: "6 Oct, 8:05 pm", what: "Marked emptied", tone: "bg-wet" },
  { when: "7 Oct, 12:55 pm", what: "Reported missing, 3 of 3. Removed", tone: "bg-destructive" },
];

function Credit({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs underline-offset-2 opacity-70 hover:underline hover:opacity-100">
      {children}
    </a>
  );
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* Without JavaScript, headings that would rise in are simply shown */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <SiteHeader />
      <MotionRoot>
        <main className="flex-1 overflow-x-clip">
          {/* Hero: the question people ask, answered by a map you can move around in */}
          <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 md:pt-14 md:pb-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
            <div className="flex flex-col gap-6">
              <h1 className={`${display} text-5xl sm:text-6xl lg:text-7xl`}>Where&apos;s the nearest dustbin?</h1>
              <p className="max-w-[38ch] text-lg leading-relaxed text-muted-foreground">
                SmartBin is a map of public dustbins, kept up to date by the people who use them. See the closest one, whether it
                takes wet or dry waste, and walk there.
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
                <Magnetic className="mt-1 w-full">
                  <Button type="submit" size="xl" className="w-full">Find nearest bin</Button>
                </Magnetic>
              </form>
              <p className="text-sm text-muted-foreground">
                Spotted one that isn&apos;t on the map?{" "}
                <Link href="/app/add" className="font-medium text-foreground underline underline-offset-4">Add a bin</Link>
              </p>
            </div>

            <div className="relative lg:pr-20 lg:pb-10">
              <LiveMap />
              <Tilt className="absolute right-0 -bottom-6 hidden w-40 lg:block xl:-right-4 xl:w-44">
                <PhoneFrame className="motion-safe:animate-[rise-in_.7s_ease-out_.4s_both]">
                  <Screen name="map" alt="The SmartBin app showing bins near you" sizes="208px" priority />
                </PhoneFrame>
              </Tilt>
            </div>
          </section>

          {/* The street, for real */}
          <ParallaxPhoto
            src="/landing/photo-radial-road.webp"
            alt="Radial Road at night in Connaught Place, New Delhi, with auto-rickshaws and lit-up shopfronts"
            width={2400}
            height={1807}
          >
            <div className="relative flex min-h-[70svh] flex-col justify-end bg-linear-to-t from-black/85 via-black/40 to-black/0 text-white md:min-h-[80vh]">
              <div className="mx-auto w-full max-w-6xl px-4 pt-40 pb-10 md:pb-14">
                <Reveal>
                  <p className={`${display} max-w-[18ch] text-4xl sm:text-6xl`}>Every street has bins. Finding one shouldn&apos;t mean asking around.</p>
                </Reveal>
                <p className="mt-6 flex flex-wrap items-center gap-x-3 text-sm text-white/70">
                  <span>Radial Road, Connaught Place, New Delhi</span>
                  <Credit href="https://commons.wikimedia.org/wiki/File:Looking_towards_Radial_Road_Number_3,_Connaught_Place,_New_Delhi.jpg">Photo: Dgp4004, CC0</Credit>
                </p>
              </div>
            </div>
          </ParallaxPhoto>

          {/* What goes where */}
          <section className="bg-card">
            <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-[1fr_1.3fr] md:py-28">
              <div className="flex flex-col gap-5">
                <Reveal>
                  <h2 className={`${display} text-5xl sm:text-6xl`}>Green for wet, blue for dry</h2>
                </Reveal>
                <p className="max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
                  Most Indian cities sort street waste into two bins. SmartBin marks every bin with what it takes, so you know before
                  you walk over. Bins that take both are marked wet and dry.
                </p>
                <figure className="mt-2 flex flex-col gap-2">
                  <Image
                    src="/landing/photo-wet-dry-bins.webp"
                    alt="A blue dry waste bin next to a green wet waste bin on a street in Bhubaneswar"
                    width={1400}
                    height={788}
                    sizes="(min-width: 768px) 440px, 100vw"
                    className="aspect-4/3 w-full rounded-2xl object-cover"
                  />
                  <figcaption className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                    <span>Dry and wet bins in Bhubaneswar</span>
                    <Credit href="https://commons.wikimedia.org/wiki/File:Dustbins_in_Bhubaneswar.jpg">Photo: Soumendra Kumar Sahoo, CC BY-SA 4.0</Credit>
                  </figcaption>
                </figure>
              </div>
              <div className="grid grid-cols-2 content-center gap-6 sm:gap-10">
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

          {/* The walk to the bin, as the app shows it */}
          <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <Reveal>
              <h2 className={`${display} max-w-[16ch] text-5xl sm:text-6xl`}>From &ldquo;where&apos;s a bin?&rdquo; to done in minutes</h2>
            </Reveal>
            <div className="mt-14 lg:mt-4">
              <ScrollStory steps={walkSteps} />
            </div>
          </section>

          {/* Get the app */}
          <section id="get-the-app" className="relative scroll-mt-20 overflow-hidden bg-black text-white">
            <Image src="/landing/photo-connaught-night.webp" alt="" fill sizes="100vw" className="object-cover opacity-60" />
            <div className="absolute inset-0 bg-linear-to-r from-black via-black/75 to-black/30" aria-hidden="true" />
            <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
              <div className="flex flex-col gap-6">
                <Reveal>
                  <h2 className={`${display} max-w-[14ch] text-5xl sm:text-6xl`}>Take SmartBin with you</h2>
                </Reveal>
                <p className="max-w-[40ch] text-lg leading-relaxed text-white/80">
                  The phone app has turn-by-turn walking directions that turn with you, keeps the screen on while you walk, and adds
                  bins straight from your camera.
                </p>
                <AppBadges />
                <p className="text-white/80">
                  Or{" "}
                  <Link href="/app" className="font-medium text-white underline underline-offset-4">use SmartBin in your browser</Link>, no
                  download needed.
                </p>
                <Credit href="https://commons.wikimedia.org/wiki/File:Connaught_Place,_B_Block_at_night,_Delhi.jpg">
                  Photo: Connaught Place at night by Slyronit, CC BY-SA 4.0
                </Credit>
              </div>
              <Tilt className="mx-auto w-[min(64vw,260px)]">
                <PhoneFrame>
                  <Screen name="walking" alt="SmartBin walking directions on a phone" sizes="260px" />
                </PhoneFrame>
              </Tilt>
            </div>
          </section>

          {/* Adding a bin: a real sequence, so it's numbered */}
          <section className="bg-muted">
            <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
              <Reveal>
                <h2 className={`${display} max-w-[14ch] text-5xl sm:text-6xl`}>Add a bin in under a minute</h2>
              </Reveal>
              <ol className="mt-14 grid gap-14 md:grid-cols-3 md:gap-8">
                {addSteps.map((step, i) => (
                  <li key={step.title} className="flex flex-col gap-6">
                    <PhoneFrame className="mx-auto w-[min(72vw,260px)] md:w-full md:max-w-[260px]">
                      <Screen name={step.screen} alt={step.alt} sizes="(min-width: 768px) 260px, 72vw" />
                      {i === 2 && (
                        <div className="absolute inset-x-3 top-3 flex items-center gap-2.5 rounded-2xl bg-primary p-3 text-sm text-primary-foreground shadow-sheet">
                          <CheckCircle2Icon className="size-5 shrink-0 text-wet" aria-hidden="true" />
                          <span><span className="font-medium">Bin added.</span> It&apos;s on the map for everyone now.</span>
                        </div>
                      )}
                    </PhoneFrame>
                    <div className="flex gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="flex flex-col gap-1.5">
                        <h3 className="text-xl font-bold">{step.title}</h3>
                        <p className="max-w-[34ch] leading-relaxed text-muted-foreground">{step.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* The rules, drawn rather than described */}
          <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
            <Reveal>
              <h2 className={`${display} max-w-[16ch] text-5xl sm:text-6xl`}>Three rules keep the map honest</h2>
            </Reveal>
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

          {/* For city and campus teams: the dashboard, and one bin's history as it shows it */}
          <section className="bg-primary text-primary-foreground">
            <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 md:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div className="flex flex-col gap-5">
                <Reveal>
                  <h2 className={`${display} text-5xl sm:text-6xl`}>See which bins need emptying first</h2>
                </Reveal>
                <p className="max-w-[40ch] text-lg leading-relaxed text-primary-foreground/75">
                  City and campus teams get a dashboard of every bin in their area: which ones people look for, which fill up fastest,
                  a cleaning queue sorted by urgency, and every bin&apos;s full history.
                </p>
                <Button size="xl" variant="secondary" className="self-start" render={<Link href="/admin/login" />} nativeButton={false}>
                  Admin sign in
                </Button>
              </div>
              <div className="relative pb-24 sm:pb-16">
                <Tilt max={4}>
                  <BrowserFrame alt="The SmartBin admin overview: bins needing cleaning, searches, directions and the most wanted bins" />
                </Tilt>
                <div className="absolute bottom-0 left-4 w-[min(88%,330px)] rounded-2xl bg-card p-5 text-card-foreground shadow-sheet sm:-left-6">
                  <p className="font-heading text-lg font-bold">Bus stop, MG Road</p>
                  <p className="text-sm text-muted-foreground">Dry waste</p>
                  <ol className="mt-4 flex flex-col">
                    {history.map((event, i) => (
                      <li key={event.when} className="relative flex gap-3 pb-3 last:pb-0">
                        {i < history.length - 1 && <span className="absolute top-3.5 left-1 h-full w-px bg-border" aria-hidden="true" />}
                        <span className={`relative mt-1.5 size-2.5 shrink-0 rounded-full ${event.tone}`} aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium">{event.what}</p>
                          <p className="text-xs text-muted-foreground">{event.when}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-20 md:py-28">
            <Reveal>
              <h2 className={`${display} max-w-[16ch] text-5xl sm:text-7xl`}>Seen a bin that isn&apos;t on the map?</h2>
            </Reveal>
            <p className="max-w-[40ch] text-lg leading-relaxed text-muted-foreground">
              Add it from where you&apos;re standing. The next person looking for a bin will find it.
            </p>
            <Magnetic>
              <Button size="xl" render={<Link href="/signup" />} nativeButton={false}>Add a bin</Button>
            </Magnetic>
          </section>
        </main>
      </MotionRoot>
      <SiteFooter />
    </>
  );
}
