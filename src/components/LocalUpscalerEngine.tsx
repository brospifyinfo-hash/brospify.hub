"use client";

// ─── <LocalUpscalerEngine /> ─────────────────────────────────────
// Headless component that owns the heavy bits: tensorflow.js + the
// UpscalerJS default model. It is *only* rendered through next/dynamic
// with `ssr: false` (see HybridUpscaler.tsx) so this module never runs
// during the server build — UpscalerJS touches `window` at import time
// and would otherwise crash `next build` on Vercel.
//
// Lifecycle: render with a File and three callbacks. The component
// performs one upscale on mount, reports progress / result / error
// through the callbacks, then becomes idle. Re-mount it (key prop) to
// run another pass.

import { useEffect, useRef } from "react";
import Upscaler from "upscaler";

interface Props {
  file: File;
  onProgress?: (pct: number) => void;
  onResult: (blob: Blob, dims: { width: number; height: number }) => void;
  onError: (msg: string) => void;
}

// Cache the singleton — building the model is expensive (downloads
// weights + warms up TF). Re-using avoids the cost on subsequent runs.
type UpscalerInstance = InstanceType<typeof Upscaler>;
let upscalerSingleton: UpscalerInstance | null = null;
function getUpscaler(): UpscalerInstance {
  if (!upscalerSingleton) upscalerSingleton = new Upscaler();
  return upscalerSingleton;
}

export default function LocalUpscalerEngine({
  file,
  onProgress,
  onResult,
  onError,
}: Props) {
  // StrictMode in dev double-invokes effects → guard against running
  // the upscale twice for the same File instance.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        // 1. Load file → HTMLImageElement (UpscalerJS accepts img refs).
        objectUrl = URL.createObjectURL(file);
        const img = await loadImage(objectUrl);
        if (cancelled) return;

        // 2. Run the upscale. Default model = ESRGAN-slim (4×).
        const upscaler = getUpscaler();
        const result = await upscaler.upscale(img, {
          patchSize: 64,
          padding: 2,
          output: "base64",
          progress: (rate: number) => {
            if (!cancelled) onProgress?.(Math.min(0.99, rate));
          },
        });
        if (cancelled) return;

        // 3. Convert the base64 data URI back to a Blob so the parent
        //    can render it via createObjectURL like the cloud branch.
        const blob = await fetch(result).then((r) => r.blob());
        if (!blob.size) throw new Error("UpscalerJS lieferte ein leeres Bild.");

        // 4. Read final dimensions for the parent's UI.
        const finalImg = await loadImage(URL.createObjectURL(blob));
        const dims = { width: finalImg.naturalWidth, height: finalImg.naturalHeight };
        URL.revokeObjectURL(finalImg.src);

        onProgress?.(1);
        onResult(blob, dims);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error
            ? err.message
            : "Unbekannter Fehler beim lokalen Upscaling.";
        onError(msg);
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Deliberately one-shot — re-runs are triggered by remounting via `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = src;
  });
}
