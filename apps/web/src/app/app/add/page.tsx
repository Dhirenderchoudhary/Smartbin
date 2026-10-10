"use client";

import { AlertCircleIcon, CameraIcon, MapPinCheckIcon, MapPinOffIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppTopBar } from "@/components/AppTopBar";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api, ApiError } from "@/lib/api";
import { currentPosition, type BinType, type LatLng } from "@/lib/bins";

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
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [where, setWhere] = useState<LatLng | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [type, setType] = useState<BinType | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  function locate() {
    setLocError(null);
    currentPosition().then(setWhere, (e: Error) => setLocError(e.message));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- start finding the location as soon as the page opens
  useEffect(locate, []);

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
    if (!photo || !where || !type) return;
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    setProblem(null);
    try {
      setStep("Uploading photo…");
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>("/dustbins/upload-url?contentType=image/jpeg");
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: photo.blob });
      if (!put.ok) throw new Error("The photo didn't upload. Check your connection and try again.");

      setStep("Checking the photo…");
      const bin = await api<{ id: string }>("/dustbins", {
        method: "POST",
        body: { imageKey: key, type, latitude: where.lat, longitude: where.lng, ...(name && { name }) },
      });
      router.replace(`/app?bin=${bin.id}`);
    } catch (err) {
      setStep(null);
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

  const ready = photo && where && type && !step;

  return (
    <>
      <AppTopBar title="Add a bin" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <form onSubmit={submit}>
          <FieldGroup>
            {/* Photo */}
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
                className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl bg-muted text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {/* Location */}
            <div className="flex items-center gap-3 rounded-2xl bg-muted p-4">
              {where ? (
                <MapPinCheckIcon className="size-5 shrink-0 text-wet" aria-hidden="true" />
              ) : locError ? (
                <MapPinOffIcon className="size-5 shrink-0 text-destructive" aria-hidden="true" />
              ) : (
                <Spinner className="size-5" />
              )}
              <p className="flex-1 text-sm">
                {where ? "Using your current location. Stand right next to the bin." : locError ?? "Finding your location…"}
              </p>
              {locError && (
                <Button type="button" size="sm" variant="secondary" onClick={locate}>
                  <RefreshCwIcon data-icon="inline-start" />
                  Retry
                </Button>
              )}
            </div>

            {/* Type */}
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

            {/* Name */}
            <Field>
              <FieldLabel htmlFor="name">Where is it? (optional)</FieldLabel>
              <Input id="name" name="name" maxLength={100} placeholder="e.g. Next to metro gate 2" />
            </Field>

            {problem && (
              <Alert variant="destructive" role="alert">
                <AlertCircleIcon />
                {problem.title && <AlertTitle>{problem.title}</AlertTitle>}
                <AlertDescription>{problem.text}</AlertDescription>
                {problem.existingBinId && (
                  <AlertAction>
                    <Button size="sm" variant="secondary" render={<Link href={`/app?bin=${problem.existingBinId}`} />} nativeButton={false}>
                      View it
                    </Button>
                  </AlertAction>
                )}
              </Alert>
            )}

            <Button type="submit" size="xl" disabled={!ready}>
              {step && <Spinner data-icon="inline-start" />}
              {step ?? "Add bin"}
            </Button>
          </FieldGroup>
        </form>
      </main>
    </>
  );
}
