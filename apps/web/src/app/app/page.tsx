"use client";

import { LocateFixedIcon, MapPinOffIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { BinPanel } from "@/components/map/BinPanel";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { currentPosition, fetchNearby, type Bin, type LatLng } from "@/lib/bins";

// maplibre needs the browser
const BinMap = dynamic(() => import("@/components/map/BinMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

type Filter = "ALL" | "WET" | "DRY";

// Map centre while we wait for, or can't get, your location (New Delhi)
const FALLBACK: LatLng = { lat: 28.6139, lng: 77.209 };

const floating = "bg-card text-foreground shadow-float hover:bg-muted";

export default function NearbyPage() {
  const [you, setYou] = useState<LatLng | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // ?bin=<id> after adding a bin, ?type=WET from the landing page (this page only renders in the browser)
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("bin"));
  const [filter, setFilter] = useState<Filter>(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    return type === "WET" || type === "DRY" ? type : "ALL";
  });
  const [focus, setFocus] = useState(0);

  const load = useCallback(async (at: LatLng) => {
    setLoading(true);
    setLoadError(null);
    try {
      setBins(await fetchNearby(at));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load bins. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const locate = useCallback(async () => {
    try {
      const at = await currentPosition();
      setLocError(null);
      setYou(at);
      setFocus((f) => f + 1);
      await load(at);
    } catch (err) {
      setLocError(err instanceof Error ? err.message : "Couldn't find your location.");
      setLoading(false);
    }
  }, [load]);

  // First location fix on load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the device location (an external system)
    locate();
  }, [locate]);

  const visible = useMemo(
    () => (filter === "ALL" ? bins : bins.filter((b) => b.type === filter || b.type === "BOTH")),
    [bins, filter]
  );
  const selected = visible.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-map">
      <BinMap you={you ?? FALLBACK} bins={visible} selectedId={selectedId} onSelect={setSelectedId} focus={focus} />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 md:left-[432px]">
        <Link
          href="/"
          aria-label="SmartBin home"
          className={`pointer-events-auto flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 font-heading text-lg font-bold md:hidden ${floating}`}
        >
          <LogoMark className="size-8" />
          SmartBin
        </Link>
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
          variant="chip"
          size="chip"
          className="pointer-events-auto hidden rounded-full bg-card p-1 shadow-float md:flex"
          aria-label="Waste type"
        >
          <ToggleGroupItem value="ALL">All bins</ToggleGroupItem>
          <ToggleGroupItem value="WET">Wet</ToggleGroupItem>
          <ToggleGroupItem value="DRY">Dry</ToggleGroupItem>
        </ToggleGroup>
        <div className="pointer-events-auto ml-auto flex gap-2">
          <Button size="lg" render={<Link href="/app/add" />} nativeButton={false} className="shadow-float">
            <PlusIcon data-icon="inline-start" />
            Add a bin
          </Button>
          <Button size="icon-lg" className={floating} render={<Link href="/app/me" aria-label="Your account" />} nativeButton={false}>
            <UserRoundIcon />
          </Button>
        </div>
      </div>

      {/* Filter chips under the top bar on phones */}
      <div className="absolute top-[4.25rem] left-4 z-10 md:hidden">
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => v[0] && setFilter(v[0] as Filter)}
          variant="chip"
          size="chip"
          className="rounded-full bg-card p-1 shadow-float"
          aria-label="Waste type"
        >
          <ToggleGroupItem value="ALL">All</ToggleGroupItem>
          <ToggleGroupItem value="WET">Wet</ToggleGroupItem>
          <ToggleGroupItem value="DRY">Dry</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Button
        size="icon-lg"
        aria-label="Show my location"
        onClick={() => (you ? (setFocus((f) => f + 1), load(you)) : locate())}
        className={`absolute top-[4.25rem] right-4 z-10 md:top-auto md:right-6 md:bottom-6 ${floating}`}
      >
        <LocateFixedIcon />
      </Button>

      {locError ? (
        <section className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 rounded-t-3xl bg-card p-6 shadow-sheet md:inset-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-2xl">
          <MapPinOffIcon className="size-8" aria-hidden="true" />
          <div className="flex flex-col gap-1">
            <h2 className="text-xl">Turn on location to see bins near you</h2>
            <p className="text-muted-foreground">{locError}</p>
          </div>
          <Button
            size="xl"
            onClick={() => {
              setLocError(null);
              setLoading(true);
              locate();
            }}
          >
            Try again
          </Button>
        </section>
      ) : loadError ? (
        <section className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 rounded-t-3xl bg-card p-6 shadow-sheet md:inset-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-2xl">
          <h2 className="text-xl">Couldn&apos;t load bins</h2>
          <p className="text-muted-foreground">{loadError}</p>
          <Button size="xl" onClick={() => you && load(you)}>Try again</Button>
        </section>
      ) : (
        <BinPanel
          bins={visible}
          selected={selected}
          onSelect={setSelectedId}
          loading={loading}
          onReported={(removed) => {
            if (removed && you) {
              setSelectedId(null);
              load(you);
            }
          }}
        />
      )}
    </div>
  );
}
