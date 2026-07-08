"use client";

// ─── Wiederverwendbares Bild-Upload-Feld (Theme-Editor) ─────────────
// Drag&Drop ODER Klick → lädt EIN Bild zu /api/upload (Vercel Blob) hoch und
// gibt die öffentliche URL über onChange zurück. Zeigt Vorschau, Ladezustand,
// Ersetzen/Entfernen. Bewusst kompakt im Stil der übrigen Inspector-Felder.
// Der einzige geteilte Upload-Helfer im Projekt (vorher überall inline kopiert).

import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Muss zum Limit in /api/upload passen (Bilder: 5 MB).
const MAX_BYTES = 5 * 1024 * 1024;

/** Lädt EIN Bild zu /api/upload (Vercel Blob) hoch und gibt die öffentliche
 *  URL zurück. Wirft mit stabilem Code ("type" | "size" | sonst) — der Aufrufer
 *  übersetzt ihn. Der einzige geteilte Client-Upload-Helfer. */
export async function uploadImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("type");
  if (file.size > MAX_BYTES) throw new Error("size");
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const d = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
  if (!res.ok || typeof d?.url !== "string") {
    throw new Error(typeof d?.error === "string" ? d.error : "upload");
  }
  return d.url;
}

export function ImageUploadField({
  value,
  onChange,
  round,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Runde Vorschau (für Avatare/Logos). */
  round?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handle = async (file: File | null | undefined) => {
    if (!file || busy) return;
    setErr(null);
    setBusy(true);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
    } catch (e) {
      const code = e instanceof Error ? e.message : "upload";
      setErr(
        code === "size" ? t.themes.imgUploadTooBig : code === "type" ? t.themes.imgUploadType : t.themes.imgUploadErr,
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    handle(e.dataTransfer?.files?.[0]);
  };

  const shape = round ? "rounded-full" : "rounded-md";

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1.5">
          <span className={`relative w-10 h-10 shrink-0 overflow-hidden border border-white/15 ${shape}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="w-full h-full object-cover" />
            {busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </span>
            )}
          </span>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex-1 min-w-0 truncate rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-[10.5px] font-semibold text-zinc-200 hover:text-white hover:bg-white/[0.08] transition disabled:opacity-50"
          >
            {t.themes.imgUploadReplace}
          </button>
          <button
            onClick={() => onChange("")}
            disabled={busy}
            title={t.themes.imgUploadRemove}
            aria-label={t.themes.imgUploadRemove}
            className="w-6 h-6 shrink-0 rounded border border-red-400/25 bg-red-500/[0.08] text-red-300 hover:bg-red-500/[0.16] flex items-center justify-center disabled:opacity-50"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          disabled={busy}
          className={`w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed px-2 py-2.5 text-[10.5px] font-semibold transition ${
            drag
              ? "border-[#95BF47]/70 bg-[#95BF47]/[0.1] text-white"
              : "border-white/15 bg-white/[0.02] text-zinc-400 hover:text-white hover:border-white/25"
          }`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
          {busy ? t.themes.imgUploadBusy : t.themes.imgUploadCta}
        </button>
      )}
      {err && <div className="mt-1 text-[9.5px] font-medium text-red-300">{err}</div>}
    </div>
  );
}
