"use client";

import { AlertCircleIcon, ArrowLeftIcon, CameraIcon, LocateFixedIcon, MapPinIcon, MapPinOffIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppTopBar } from "@/components/AppTopBar";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError } from "@/lib/api";
import {
  currentPosition,
  INDIA_VIEW,
  lastKnownLocation,
  DUPLICATE_RADIUS_M,
  fetchNearby,
  formatDistance,
  metresBetween,
  type Bin,
  type BinType,
  type LatLng,
} from "@/lib/bins";

// maplibre needs the browser
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-map" />,
});

const floating = "bg-card text-foreground shadow-float hover:bg-muted";

// The API asks for photos of about 1280 px; this also keeps uploads well under 5 MB
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo. Try another."))), "image/jpeg", 0.85)
  );
}

type Problem = { text: string; title?: string; existingBinId?: string };

export default function AddBinPage() {
  const router = useRouter();
  const [step, setStep] = useState<"where" | "details">("where");

  // Step 1: where
  const [gps, setGps] = useState<(LatLng & { accuracy: number }) | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locating, setLocating] = useState(true);
  const [spot, setSpot] = useState<LatLng | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [nearby, setNearby] = useState<Bin[]>([]);
  const fetchedAround = useRef<LatLng | null>(null);

  // Step 2: details
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [type, setType] = useState<BinType | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  const locate = useCallback(async () => {
    try {
      const at = await currentPosition();
      setGps(at);
      setGpsError(null);
      setSpot((s) => s ?? at);
      setRecenter((n) => n + 1);
    } catch (err) {
      setGpsError(err instanceof Error ? err.message : "Couldn't find your location.");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the device location (an external system)
    locate();
  }, [locate]);

  // Bins around the pin, for the dots and the duplicate check (refetched after moving ~1 km)
  useEffect(() => {
    if (!spot || (fetchedAround.current && metresBetween(fetchedAround.current, spot) < 1000)) return;
    fetchedAround.current = spot;
    fetchNearby(spot).then(setNearby, () => {});
  }, [spot]);

  const duplicate = spot ? nearby.find((b) => metresBetween(spot, b) < DUPLICATE_RADIUS_M) : undefined;
  const fromYou = gps && spot ? metresBetween(gps, spot) : null;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    try {
      const blob = await shrinkPhoto(file);
      setPhoto((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { blob, url: URL.createObjectURL(blob) };
      });
    } catch (err) {
      setProblem({ text: err instanceof Error ? err.message : "Couldn't read that photo. Try another." });
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!photo || !spot || !type) return;
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    setProblem(null);
    try {
      setSending("Uploading photo…");
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>("/dustbins/upload-url?contentType=image/jpeg");
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo.blob });
      if (!put.ok) throw new Error("The photo didn't upload. Check your connection and try again.");

      setSending("Checking the photo…");
      const bin = await api<{ id: string }>("/dustbins", {
        method: "POST",
        body: { imageKey: key, type, latitude: spot.lat, longitude: spot.lng, ...(name && { name }) },
      });
      // The map only loads bins around you, so pass where this one is in case it's further away
      router.replace(`/app?bin=${bin.id}&added=1&lat=${spot.lat}&lng=${spot.lng}`);
    } catch (err) {
      setSending(null);
      if (err instanceof ApiError && err.code === "DUPLICATE_NEARBY") {
        setProblem({ title: "This bin is already on the map", text: err.message, existingBinId: err.details?.existingBinId as string });
      } else if (err instanceof ApiError && err.code === "NOT_A_BIN") {
        setPhoto(null);
        setProblem({ title: "We couldn't see a dustbin in that photo", text: "Take a clearer photo with the whole bin in view." });
      } else {
        setProblem({ text: err instanceof Error ? err.message : "Something went wrong, try again." });
      }
    }
  }

  // Step 1: move the map until the pin sits on the bin
  if (step === "where") {
    return (
      <div className="fixed inset-0 overflow-hidden bg-map">
        {locating ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-3 rounded-full bg-card px-5 py-3 shadow-float">
              <Spinner /> Finding your location…
            </span>
          </div>
        ) : (
          <LocationPicker
            start={spot ?? gps ?? lastKnownLocation() ?? INDIA_VIEW.center}
            startZoom={spot || gps || lastKnownLocation() ? 18 : INDIA_VIEW.zoom}
            you={gps}
            bins={nearby}
            recenter={recenter}
            onMove={setSpot}
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-between p-4">
          <Button size="icon-lg" className={`pointer-events-auto ${floating}`} render={<Link href="/app" aria-label="Cancel and go back to the map" />} nativeButton={false}>
            <ArrowLeftIcon />
          </Button>
          <Button
            size="icon-lg"
            aria-label="Use my location"
            className={`pointer-events-auto ${floating}`}
            onClick={() => (gps ? setRecenter((n) => n + 1) : locate())}
          >
            <LocateFixedIcon />
          </Button>
        </div>

        <section className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-4 rounded-t-3xl bg-card p-5 shadow-sheet md:inset-auto md:bottom-4 md:left-4 md:w-100 md:rounded-2xl">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl">Where is the bin?</h1>
            <p className="text-muted-foreground">Move the map so the pin sits right on the bin. Zoom in to be exact.</p>
          </div>

          {duplicate ? (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>There&apos;s already a bin here</AlertTitle>
              <AlertDescription>
                {duplicate.name} is {formatDistance(metresBetween(spot!, duplicate))} from the pin. Bins need to be at least{" "}
                {DUPLICATE_RADIUS_M} m apart.
              </AlertDescription>
              <AlertAction>
                <Button variant="secondary" render={<Link href={`/app?bin=${duplicate.id}`} />} nativeButton={false}>
                  View it
                </Button>
              </AlertAction>
            </Alert>
          ) : gpsError ? (
            <Alert variant="warning">
              <MapPinOffIcon />
              <AlertDescription>We couldn&apos;t find your location, so move the map to the bin yourself.</AlertDescription>
            </Alert>
          ) : fromYou !== null && fromYou > 100 ? (
            <p className="text-sm text-muted-foreground">
              The pin is {formatDistance(fromYou)} from you. Make sure it&apos;s on the right bin.
            </p>
          ) : gps ? (
            <p className="text-sm text-muted-foreground">Your location is accurate to about {Math.max(1, Math.round(gps.accuracy))} m.</p>
          ) : null}

          <Button size="xl" disabled={!spot || !!duplicate} onClick={() => setStep("details")}>
            {spot ? "Confirm location" : "Move the map to the bin"}
          </Button>
        </section>
      </div>
    );
  }

  // Step 2: photo, type and name
  return (
    <>
      <AppTopBar title="Add a bin" onBack={() => setStep("where")} backLabel="Back to location" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="flex items-center gap-3 rounded-2xl bg-muted p-4">
              <MapPinIcon className="size-5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm">
                Location set
                {fromYou !== null && <span className="text-muted-foreground">, {formatDistance(fromYou)} from you</span>}
              </p>
              <Button type="button" variant="secondary" onClick={() => setStep("where")}>
                Change
              </Button>
            </div>

            <Field>
              <FieldLabel htmlFor="photo">Photo of the bin</FieldLabel>
              <input
                ref={fileInput}
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => choosePhoto(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="relative grid aspect-4/3 w-full place-items-center overflow-hidden rounded-2xl bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {photo ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                    <img src={photo.url} alt="Your photo of the bin" className="absolute inset-0 size-full object-cover" />
                    <span className="absolute right-3 bottom-3 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground shadow-float">
                      Retake
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center gap-2">
                    <CameraIcon className="size-8" aria-hidden="true" />
                    <span className="font-medium text-foreground">Take a photo</span>
                    <span className="text-sm">Get the whole bin in the picture</span>
                  </span>
                )}
              </button>
            </Field>

            <FieldSet>
              <FieldLegend>What does it take?</FieldLegend>
              <ToggleGroup
                value={type ? [type] : []}
                onValueChange={(v) => setType((v[0] as BinType) ?? null)}
                variant="chip"
                size="chip"
                className="flex-wrap"
              >
                <ToggleGroupItem value="WET">
                  <span className="size-2.5 rounded-full bg-wet" aria-hidden="true" />
                  Wet
                </ToggleGroupItem>
                <ToggleGroupItem value="DRY">
                  <span className="size-2.5 rounded-full bg-dry" aria-hidden="true" />
                  Dry
                </ToggleGroupItem>
                <ToggleGroupItem value="BOTH">Wet and dry</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>Green bins are usually for wet waste, blue bins for dry.</FieldDescription>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="name">Name it (optional)</FieldLabel>
              <Input id="name" name="name" maxLength={100} placeholder="e.g. Next to metro gate 2" />
              <FieldDescription>Helps people find it, like a landmark or shop name.</FieldDescription>
            </Field>

            {problem && (
              <Alert variant="destructive" role="alert">
                <AlertCircleIcon />
                {problem.title && <AlertTitle>{problem.title}</AlertTitle>}
                <AlertDescription>{problem.text}</AlertDescription>
                {problem.existingBinId && (
                  <AlertAction>
                    <Button variant="secondary" render={<Link href={`/app?bin=${problem.existingBinId}`} />} nativeButton={false}>
                      View it
                    </Button>
                  </AlertAction>
                )}
              </Alert>
            )}

            <Button type="submit" size="xl" disabled={!photo || !type || !!sending}>
              {sending && <Spinner data-icon="inline-start" />}
              {sending ?? (!photo ? "Add a photo to continue" : !type ? "Choose wet or dry" : "Add bin")}
            </Button>
          </FieldGroup>
        </form>
      </main>
    </>
  );
}
