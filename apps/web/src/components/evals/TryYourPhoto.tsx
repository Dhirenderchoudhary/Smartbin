"use client";

import { AlertCircleIcon, CameraIcon, CheckIcon, ImageUpIcon, LogInIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { CameraCapture } from "@/components/CameraCapture";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api, type Me } from "@/lib/api";

interface Verdict {
  accepted: boolean;
  confidence: number;
  reason: string;
  ms: number;
  triesLeft: number;
}

// Same size the app sends for new bins
async function shrink(file: Blob): Promise<Blob> {
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

export function TryYourPhoto({
  me,
  tries,
  onChecked,
}: {
  me: Me | null;
  tries?: { total: number; accepted: number; limitPerDay: number };
  onChecked: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(photo: Blob) {
    setCameraOpen(false);
    setError(null);
    setVerdict(null);
    setBusy(true);
    try {
      const blob = await shrink(photo);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>("/dustbins/upload-url?contentType=image/jpeg");
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!put.ok) throw new Error("The photo didn't upload. Check your connection and try again.");
      setVerdict(await api<Verdict>("/evals/try", { method: "POST", body: { imageKey: key } }));
      onChecked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong, try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Try to fool it yourself</CardTitle>
        <CardDescription>
          Point your camera at a bucket, a bin, a post box, anything, and see what the AI decides and why. Your photo is deleted right after the
          check, and no bin is added to the map.
          {tries && tries.total > 0 && (
            <> So far {tries.total} photo{tries.total === 1 ? " has" : "s have"} been tried here; {tries.accepted} passed.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {me ? (
            <>
              <Button size="xl" onClick={() => setCameraOpen(true)} disabled={busy}>
                <CameraIcon data-icon="inline-start" />
                Take a photo
              </Button>
              <Button size="xl" variant="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
                <ImageUpIcon data-icon="inline-start" />
                Choose a photo
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) check(f);
                }}
              />
              <p className="text-sm text-muted-foreground">
                Choosing a photo is allowed here because nothing is saved. Adding a real bin needs the live camera.
                {tries && <> Up to {tries.limitPerDay} checks per person per day.</>}
              </p>
            </>
          ) : (
            <>
              <Button size="xl" render={<Link href="/login?next=/evals" />} nativeButton={false}>
                <LogInIcon data-icon="inline-start" />
                Sign in to try it
              </Button>
              <p className="text-sm text-muted-foreground">Signing in keeps the AI costs in check. It&apos;s free and takes a few seconds.</p>
            </>
          )}
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-col gap-3" aria-live="polite">
          {preview ? (
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={preview} alt="Your photo" className="absolute inset-0 size-full object-cover" />
              {busy && (
                <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                  <span className="flex items-center gap-2">
                    <Spinner /> Checking…
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid aspect-4/3 place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">
              {busy ? <Spinner /> : "Your photo and the verdict appear here"}
            </div>
          )}
          {verdict && (
            <div className={`rounded-2xl p-4 ${verdict.accepted ? "bg-wet/15" : "bg-destructive/10"}`}>
              <p className={`flex items-center gap-2 text-lg font-bold ${verdict.accepted ? "text-wet" : "text-destructive"}`}>
                {verdict.accepted ? <CheckIcon className="size-5" /> : <XIcon className="size-5" />}
                {verdict.accepted ? "Accepted as a dustbin" : "Rejected: not a dustbin"}
              </p>
              <p className="mt-2 text-sm">&ldquo;{verdict.reason}&rdquo;</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Confidence {Math.round(verdict.confidence * 100)}% · checked in {(verdict.ms / 1000).toFixed(1)} s · {verdict.triesLeft} checks left
                today
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {cameraOpen && <CameraCapture onCapture={check} onClose={() => setCameraOpen(false)} />}
    </Card>
  );
}
