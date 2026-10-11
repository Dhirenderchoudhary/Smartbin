"use client";

import { AlertCircleIcon, SwitchCameraIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// The API asks for photos of about 1280 px; this also keeps uploads well under 5 MB
const MAX_SIDE = 1280;

type Facing = "environment" | "user";

// Why the camera couldn't open, in words people can act on
function cameraProblem(err: unknown): { title: string; text: string } {
  const name = (err as { name?: string })?.name;
  if (!window.isSecureContext) {
    return {
      title: "Camera needs a secure connection",
      text: "Open SmartBin over https (or on localhost) to use the camera.",
    };
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      title: "Camera permission is off",
      text: "Allow camera access for this site in your browser settings, then try again.",
    };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { title: "No camera found", text: "Use a phone or a device with a camera to add a bin." };
  }
  if (name === "NotReadableError") {
    return { title: "Camera is busy", text: "Close other apps using the camera, then try again." };
  }
  return { title: "Couldn't open the camera", text: "Try again, or reload the page." };
}

// Live camera inside the page: the only way to get a photo is to take one now (no gallery or files)
export function CameraCapture({ onCapture, onClose }: { onCapture: (photo: Blob) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [canSwitch, setCanSwitch] = useState(false);
  const [problem, setProblem] = useState<{ title: string; text: string } | null>(null);
  const [taking, setTaking] = useState(false);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setReady(false);
      setProblem(null);
      stop();
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: "NotFoundError" });
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play().catch(() => undefined);
        }
        const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (!cancelled) {
          setCanSwitch(cameras.length > 1);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setProblem(cameraProblem(err));
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  // Close with the Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function takePhoto() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setTaking(true);
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setTaking(false);
        if (!blob) {
          setProblem({ title: "Couldn't take the photo", text: "Try again." });
          return;
        }
        stop();
        onCapture(blob);
      },
      "image/jpeg",
      0.85
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Take a photo of the bin" className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        {/* muted + playsInline: needed for iPhones to show the live preview inside the page */}
        <video ref={video} muted playsInline autoPlay className="absolute inset-0 size-full object-cover" />

        {!ready && !problem && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="flex items-center gap-3 rounded-full bg-black/60 px-5 py-3">
              <Spinner /> Opening camera…
            </span>
          </div>
        )}

        {problem && (
          <div className="absolute inset-0 grid place-items-center p-6">
            <Alert variant="destructive" className="max-w-sm">
              <AlertCircleIcon />
              <AlertTitle>{problem.title}</AlertTitle>
              <AlertDescription>{problem.text}</AlertDescription>
            </Alert>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex justify-between p-4">
          <Button size="icon-lg" variant="secondary" aria-label="Close camera" onClick={onClose}>
            <XIcon />
          </Button>
          {canSwitch && ready && (
            <Button
              size="icon-lg"
              variant="secondary"
              aria-label="Switch camera"
              onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            >
              <SwitchCameraIcon />
            </Button>
          )}
        </div>

        {ready && (
          <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/90 drop-shadow">
            Get the whole bin in the picture
          </p>
        )}
      </div>

      <div className="flex items-center justify-center bg-black py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={takePhoto}
          disabled={!ready || taking}
          aria-label="Take photo"
          className="grid size-18 place-items-center rounded-full border-4 border-white outline-none focus-visible:ring-4 focus-visible:ring-white/60 disabled:opacity-40"
        >
          <span className="size-14 rounded-full bg-white transition-transform active:scale-90" />
        </button>
      </div>
    </div>
  );
}
