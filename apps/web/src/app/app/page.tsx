"use client";

import { CheckCircle2Icon, LocateFixedIcon, MapPinOffIcon, PlusIcon, UserRoundIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { BinPanel } from "@/components/map/BinPanel";
import { NavigationPanel } from "@/components/map/NavigationPanel";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Spinner } from "@/components/ui/spinner";
import { fetchArea, fetchNearby, INDIA_VIEW, lastKnownLocation, metresBetween, watchLocation, type Bin, type BinIssue, type LatLng } from "@/lib/bins";
import { routeProgress, walkingRoute, type WalkRoute } from "@/lib/routes";

// Recalculate the route when you're this far off it (and not more often than every 10 s)
const OFF_ROUTE_M = 35;
const REROUTE_EVERY_MS = 10_000;

// Past this (about a large city across), the map asks you to zoom in instead of loading bins
const MAX_VIEW_RADIUS_M = 50_000;

// maplibre needs the browser
const BinMap = dynamic(() => import("@/components/map/BinMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

type Filter = "ALL" | "WET" | "DRY";

const floating = "bg-card text-foreground shadow-float hover:bg-muted";

// useSearchParams needs a Suspense boundary
export default function Page() {
  return (
    <Suspense>
      <NearbyPage />
    </Suspense>
  );
}

function NearbyPage() {
  const params = useSearchParams();
  const [you, setYou] = useState<(LatLng & { heading: number | null }) | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // ?bin=<id> after adding a bin, ?type=WET from the landing page
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get("bin"));
  const [filter, setFilter] = useState<Filter>(() => {
    const type = params.get("type");
    return type === "WET" || type === "DRY" ? type : "ALL";
  });
  // Just added a bin: confirm it, and fetch it by its location in case it's outside the bins around you
  const [added, setAdded] = useState(() => params.get("added") === "1");
  const [addedAt] = useState<LatLng | null>(() => {
    const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
    return params.get("lat") && params.get("lng") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  });
  const [focus, setFocus] = useState(0);
  // Open where you were last time (kept on this device); India-wide on a first visit
  const [start] = useState<LatLng | null>(() => lastKnownLocation());
  const [watchKey, setWatchKey] = useState(0);
  const loadedAround = useRef<LatLng | null>(null);
  // Areas already loaded, so panning back over them doesn't fetch again
  const loadedAreas = useRef<{ center: LatLng; radius: number }[]>([]);
  const [tooWide, setTooWide] = useState(false);

  // Navigation to a bin
  const [navBin, setNavBin] = useState<Bin | null>(null);
  const [route, setRoute] = useState<WalkRoute | null>(null);
  const [follow, setFollow] = useState(false);
  const routedAt = useRef(0);
  const routeRequest = useRef(0); // ignores route answers that arrive after you ended or rerouted
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // Bins arrive from several places (around you, the area in view, a bin you just added): keep them all
  const merge = useCallback((list: Bin[]) => {
    setBins((prev) => [...new Map([...prev, ...list].map((b) => [b.id, b])).values()]);
  }, []);

  const load = useCallback(async (at: LatLng) => {
    setLoading(true);
    setLoadError(null);
    try {
      merge(await fetchNearby(at));
      loadedAreas.current.push({ center: at, radius: 2000 });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load bins. Try again.");
    } finally {
      setLoading(false);
    }
  }, [merge]);

  const loadView = useCallback(
    (center: LatLng, radius: number) => {
      setTooWide(radius > MAX_VIEW_RADIUS_M);
      if (radius > MAX_VIEW_RADIUS_M) return;
      if (loadedAreas.current.some((a) => metresBetween(a.center, center) + radius <= a.radius)) return;
      fetchArea(center, radius).then((list) => {
        merge(list);
        // ponytail: an area that hit the API's 500 cap is incomplete, so it isn't remembered
        if (list.length < 500) loadedAreas.current.push({ center, radius });
      }, () => {});
    },
    [merge]
  );

  const reload = useCallback(
    (at: LatLng) => {
      loadedAround.current = at;
      load(at);
    },
    [load]
  );

  // Follow your live position. The first fix centres the map; bins reload after you move ~300 m.
  useEffect(() => {
    let first = true;
    return watchLocation(
      (fix) => {
        const at = { lat: fix.lat, lng: fix.lng };
        setLocError(null);
        setYou({ ...at, heading: fix.heading });
        if (first) {
          first = false;
          setFocus((f) => f + 1);
        }
        if (!loadedAround.current || metresBetween(loadedAround.current, at) > 300) reload(at);
      },
      (message) => {
        setLocError(message);
        setLoading(false);
      }
    );
  }, [watchKey, reload]);

  const routeTo = useCallback((from: LatLng, bin: Bin) => {
    routedAt.current = Date.now();
    const request = ++routeRequest.current;
    walkingRoute(from, { lat: bin.latitude, lng: bin.longitude }).then((r) => request === routeRequest.current && setRoute(r));
  }, []);

  function startNavigation(bin: Bin) {
    setSelectedId(bin.id);
    setNavBin(bin);
    setRoute(null);
    setFollow(true);
    if (you) routeTo(you, bin);
    // Keep the screen on while walking (not every browser allows it)
    navigator.wakeLock?.request("screen").then((lock) => (wakeLock.current = lock), () => {});
  }

  function endNavigation() {
    routeRequest.current++;
    setNavBin(null);
    setRoute(null);
    setFollow(false);
    wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }

  // While navigating: route as soon as we know where you are, and reroute when you stray
  useEffect(() => {
    if (!navBin || !you) return;
    const stale = Date.now() - routedAt.current > REROUTE_EVERY_MS;
    if (!route ? stale || !routedAt.current : stale && routeProgress(route, you).offRoute > OFF_ROUTE_M) routeTo(you, navBin);
  }, [navBin, you, route, routeTo]);

  useEffect(() => () => void wakeLock.current?.release().catch(() => {}), []);

  useEffect(() => {
    if (!addedAt || !selectedId) return;
    fetchNearby(addedAt).then(merge, () => {});
    // Drop the one-off params so a refresh doesn't confirm again
    window.history.replaceState(null, "", `/app?bin=${selectedId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the bin you just added
  }, [addedAt]);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 6000);
    return () => clearTimeout(t);
  }, [added]);

  // Distances from where you are now (the server's are from where the list was loaded), nearest first
  const visible = useMemo(() => {
    const shown = filter === "ALL" ? bins : bins.filter((b) => b.type === filter || b.type === "BOTH");
    if (!you) return shown;
    return shown.map((b) => ({ ...b, distance: metresBetween(you, b) })).sort((a, b) => a.distance - b.distance);
  }, [bins, filter, you]);
  const selected = visible.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-map">
      <BinMap
        you={you}
        start={start ?? INDIA_VIEW.center}
        startZoom={start ? 15 : INDIA_VIEW.zoom}
        bins={visible}
        selectedId={selectedId}
        onSelect={(id) => !navBin && setSelectedId(id)}
        focus={focus}
        route={route?.line ?? null}
        follow={follow}
        onUserMove={() => navBin && setFollow(false)}
        onViewChange={loadView}
      />

      {navBin && (
        <>
          <NavigationPanel bin={navBin} route={route} you={you} onEnd={endNavigation} />
          {!follow && (
            <Button
              size="lg"
              onClick={() => setFollow(true)}
              className={`absolute bottom-60 left-1/2 z-20 -translate-x-1/2 md:bottom-6 md:left-auto md:right-6 md:translate-x-0 ${floating}`}
            >
              <LocateFixedIcon data-icon="inline-start" />
              Re-centre
            </Button>
          )}
        </>
      )}

      {added && (
        <div role="status" className="absolute inset-x-4 top-4 z-30 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sheet md:right-auto md:left-[448px] md:w-100">
          <CheckCircle2Icon className="size-6 shrink-0 text-wet" aria-hidden="true" />
          <p className="flex-1">
            <span className="font-medium">Bin added.</span> Thanks, it&apos;s on the map for everyone now.
          </p>
          <button type="button" onClick={() => setAdded(false)} className="rounded-full px-2 text-sm underline-offset-4 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {tooWide && !navBin && (
        <div className="pointer-events-none absolute inset-x-0 top-32 z-10 flex justify-center md:top-20 md:left-[432px]">
          <span className="rounded-full bg-card px-5 py-3 shadow-float">Zoom in to see bins</span>
        </div>
      )}

      {!you && !locError && (
        <div className="pointer-events-none absolute inset-x-0 top-1/3 z-10 flex justify-center md:left-[432px]">
          <span className="flex items-center gap-3 rounded-full bg-card px-5 py-3 shadow-float">
            <Spinner /> Finding your location…
          </span>
        </div>
      )}

      {!navBin && (<>
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
        onClick={() => (you ? (setFocus((f) => f + 1), reload(you)) : setWatchKey((k) => k + 1))}
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
              setWatchKey((k) => k + 1);
            }}
          >
            Try again
          </Button>
        </section>
      ) : loadError ? (
        <section className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 rounded-t-3xl bg-card p-6 shadow-sheet md:inset-auto md:bottom-4 md:left-4 md:w-[400px] md:rounded-2xl">
          <h2 className="text-xl">Couldn&apos;t load bins</h2>
          <p className="text-muted-foreground">{loadError}</p>
          <Button size="xl" onClick={() => you && reload(you)}>Try again</Button>
        </section>
      ) : (
        <BinPanel
          bins={visible}
          you={you}
          selected={selected}
          onSelect={setSelectedId}
          loading={loading}
          onReported={(removed) => {
            if (removed) {
              setBins((list) => list.filter((b) => b.id !== selectedId));
              setSelectedId(null);
            }
          }}
          onIssues={(id: string, issues: BinIssue[]) => {
            setBins((list) => list.map((b) => (b.id === id ? { ...b, issues } : b)));
          }}
          onNavigate={startNavigation}
        />
      )}
      </>)}
    </div>
  );
}
