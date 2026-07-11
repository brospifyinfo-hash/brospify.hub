"use client";

// ─── „Eigenes Produkt"-Intake (Start-Fenster → Schritt 2) ───────────
// Pflicht: min. 3 Produktbilder (max. 5), Name, kurze Beschreibung.
// Bilder laden SOFORT beim Hinzufügen hoch (/api/upload → Blob-URL) und
// behalten parallel ihre dataURL + Farbpalette für den echten AI-Plan.
// Beim Start wird das Produkt via /api/custom-products angelegt (inkl.
// images[]) und alles Nötige an den Genesis-Flow des Editors übergeben.

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ClipboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, CircleDashed, ImagePlus, Sparkles, X } from "lucide-react";
import { ACCENT, extractPalette } from "@/components/theme-editor/editor-ui";

export interface IntakeTexts {
  title: string;
  sub: string;
  name: string;
  namePh: string;
  desc: string;
  descPh: string;
  images: string;
  imagesHint: string;
  add: string;
  reqName: string;
  reqDesc: string;
  reqImages: string;
  start: string;
  cancel: string;
  uploadErr: string;
  remove: string;
  /** Preis-Feld (nur Edit-Modus gerendert). */
  price?: string;
  pricePh?: string;
}

export interface IntakeResult {
  productId: string;
  titel: string;
  beschreibung: string;
  /** Preis-Angabe (leer, wenn nicht gesetzt) — fließt in den AI-Brief ein. */
  preis: string;
  /** Hochgeladene Blob-URLs (für das Produkt/Preview). */
  imageUrls: string[];
  /** dataURLs der ersten Bilder ≤ 4.5 MB (für den AI-Plan, max. 3). */
  dataUrls: string[];
  /** Dominante Bildfarben (paletteHints für den AI-Plan, max. 8). */
  paletteHints: string[];
}

interface IntakeImage {
  /** Lokale Vorschau + AI-Input (data:image/…). */
  dataUrl: string;
  /** Blob-URL nach erfolgreichem Upload ("" solange er läuft). */
  url: string;
  /** Bild-Bytes (AI nimmt nur Bilder ≤ 4.5 MB an). */
  bytes: number;
  hints: string[];
  uploading: boolean;
  failed: boolean;
}

export const INTAKE_MIN_IMAGES = 3;
const MAX_IMAGES = 5;
const AI_IMAGE_MAX_BYTES = 4.5 * 1024 * 1024;
const DESC_MIN = 10;

export default function ProductIntakeOverlay({
  open, onBack, onStart, t, mode = "genesis", productId = "", initial,
}: {
  open: boolean;
  onBack: () => void;
  /** Formular gespeichert → Genesis starten (genesis) bzw. fertig (edit). */
  onStart: (r: IntakeResult) => void;
  t: IntakeTexts;
  /** "genesis" = Pflichtfelder + Shop-Generierung · "edit" = Produkt
   *  NACHTRÄGLICH bearbeiten/speichern (alles optional, kein Genesis-Lauf). */
  mode?: "genesis" | "edit";
  /** Bestehende Produkt-ID (edit) — Speichern aktualisiert statt anzulegen. */
  productId?: string;
  /** Vorbefüllung (edit) mit den aktuellen Produktdaten. */
  initial?: { titel?: string; beschreibung?: string; preis?: string; imageUrls?: string[] };
}) {
  const isEdit = mode === "edit";
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  // Preis wird nur im Edit-Modus angezeigt — aber IMMER durchgereicht, damit
  // ein Save den bestehenden Preis nie still löscht (Update-Merge überschreibt
  // fehlende Keys mit undefined).
  const [preis, setPreis] = useState("");
  const [images, setImages] = useState<IntakeImage[]>([]);
  const [drag, setDrag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  // Bei einem Retry (Genesis-Start schlug fehl, Formular ist noch gefüllt)
  // das BESTEHENDE Produkt aktualisieren statt ein Duplikat anzulegen.
  const createdIdRef = useRef("");

  // Edit-Modus: beim Öffnen einmalig mit den aktuellen Produktdaten befüllen
  // (bereits hochgeladene Bilder gelten als fertig — dataUrl = Blob-URL).
  const openedRef = useRef(false);
  useEffect(() => {
    if (!open) { openedRef.current = false; return; }
    if (openedRef.current) return;
    openedRef.current = true;
    if (!isEdit) return;
    setTitel(initial?.titel || "");
    setBeschreibung(initial?.beschreibung || "");
    setPreis(initial?.preis || "");
    setImages((initial?.imageUrls || []).map((u) => ({ dataUrl: u, url: u, bytes: 0, hints: [], uploading: false, failed: false })));
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);

  // Fokus-Management (Haus-Muster wie FullPreviewOverlay): initialer Fokus
  // ins Formular, Tab-Falle im Dialog, ESC schließt (wie Backdrop-Klick).
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const focusables = () =>
      [...(panelRef.current?.querySelectorAll<HTMLElement>("button, input:not([type='file']), textarea") || [])].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    requestAnimationFrame(() => focusables()[0]?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
        return;
      }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onBack]);

  const addFiles = useCallback(async (files: FileList | File[] | null | undefined) => {
    if (!files) return;
    setError("");
    const room = MAX_IMAGES - images.length;
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (!dataUrl.startsWith("data:image/")) continue;
      const hints = await extractPalette(dataUrl);
      const entry: IntakeImage = { dataUrl, url: "", bytes: file.size, hints, uploading: true, failed: false };
      setImages((prev) => (prev.length >= MAX_IMAGES ? prev : [...prev, entry]));
      // Upload direkt anstoßen — Ergebnis über die dataUrl-Identität zuordnen.
      (async () => {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const d = await res.json().catch(() => ({}));
          const ok = res.ok && typeof d?.url === "string";
          setImages((prev) => prev.map((im) => (im.dataUrl === dataUrl ? { ...im, url: ok ? (d.url as string) : "", uploading: false, failed: !ok } : im)));
          if (!ok) setError(d?.error || t.uploadErr);
        } catch {
          setImages((prev) => prev.map((im) => (im.dataUrl === dataUrl ? { ...im, uploading: false, failed: true } : im)));
          setError(t.uploadErr);
        }
      })();
    }
  }, [images.length, t.uploadErr]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer?.files);
  };
  const onPaste = (e: ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
    if (files.length) addFiles(files);
  };
  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const uploaded = useMemo(() => images.filter((i) => i.url), [images]);
  const reqName = titel.trim().length > 0;
  const reqDesc = beschreibung.trim().length >= DESC_MIN;
  const reqImages = uploaded.length >= INTAKE_MIN_IMAGES;
  const uploadsPending = images.some((i) => i.uploading);
  // Edit-Modus: alles optional (eigene Produkte erlauben leere Felder) —
  // nur laufende Uploads blockieren das Speichern.
  const canStart = isEdit
    ? !uploadsPending && !saving
    : reqName && reqDesc && reqImages && !uploadsPending && !saving;

  async function handleStart() {
    if (!canStart) return;
    setSaving(true);
    setError("");
    try {
      const urls = uploaded.map((i) => i.url);
      const res = await fetch("/api/custom-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: productId || createdIdRef.current || undefined,
          titel: titel.trim(),
          beschreibung: beschreibung.trim(),
          preis: preis.trim(),
          bildUrl: urls[0],
          images: urls,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.product?.id) {
        setError(d?.error || t.uploadErr);
        return;
      }
      createdIdRef.current = d.product.id as string;
      onStart({
        productId: d.product.id as string,
        titel: titel.trim(),
        beschreibung: beschreibung.trim(),
        preis: preis.trim(),
        imageUrls: urls,
        dataUrls: uploaded.filter((i) => i.bytes <= AI_IMAGE_MAX_BYTES).slice(0, 3).map((i) => i.dataUrl),
        paletteHints: uploaded.flatMap((i) => i.hints).slice(0, 8),
      });
    } catch {
      setError(t.uploadErr);
    } finally {
      setSaving(false);
    }
  }

  const reqs: { ok: boolean; label: string }[] = [
    { ok: reqImages, label: t.reqImages },
    { ok: reqName, label: t.reqName },
    { ok: reqDesc, label: t.reqDesc },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[75] flex items-center justify-center p-4 sm:p-6"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onBack} aria-hidden />
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={t.title}
            className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="p-5 sm:p-7">
              <div className="flex items-start gap-3 mb-5">
                <button
                  onClick={onBack}
                  className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white transition"
                  aria-label={t.cancel}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-white font-sf-display">{t.title}</h2>
                  <p className="mt-0.5 text-[12px] text-zinc-400">{t.sub}</p>
                </div>
              </div>

              {error && <p className="mb-3 text-[11.5px] text-amber-300/90 leading-snug">{error}</p>}

              {/* Bilder — Pflicht, min. 3 */}
              <div className="mb-4">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-[12px] font-bold text-white">{t.images} {!isEdit && <span className="text-amber-300">*</span>}</span>
                  {!isEdit && (
                    <span className={`text-[10.5px] tabular-nums ${reqImages ? "text-[#cfe9a3]" : "text-zinc-500"}`}>{uploaded.length} / {INTAKE_MIN_IMAGES}+</span>
                  )}
                </div>
                <p className="text-[10.5px] text-zinc-500 mb-2">{t.imagesHint}</p>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={onDrop}
                  onPaste={onPaste}
                  className={`grid grid-cols-3 sm:grid-cols-5 gap-2 rounded-2xl border border-dashed p-2.5 transition ${
                    drag ? "border-[#95BF47] bg-[#95BF47]/[0.08]" : "border-white/15 bg-white/[0.02]"
                  }`}
                >
                  <AnimatePresence initial={false}>
                    {images.map((img, i) => (
                      <motion.div
                        key={img.dataUrl.slice(-48) + i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.22 }}
                        className="relative aspect-square rounded-xl overflow-hidden border border-white/12 bg-white/[0.04]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.dataUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        {(img.uploading || img.failed) && (
                          <span className={`absolute inset-0 flex items-center justify-center ${img.failed ? "bg-red-950/60" : "bg-black/55"}`}>
                            {img.failed
                              ? <X className="w-4 h-4 text-red-300" />
                              : <CircleDashed className="w-4 h-4 animate-spin text-[#cfe9a3]" />}
                          </span>
                        )}
                        {!img.uploading && !img.failed && (
                          <motion.span
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="absolute bottom-1 right-1 w-4.5 h-4.5 rounded-full bg-[#95BF47] flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-[#0a0a0a]" />
                          </motion.span>
                        )}
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 border border-white/20 text-zinc-300 hover:text-white flex items-center justify-center transition"
                          aria-label={t.remove}
                          title={t.remove}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {images.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="aspect-square rounded-xl border border-dashed border-[#95BF47]/40 bg-[#95BF47]/[0.05] hover:bg-[#95BF47]/[0.12] transition flex flex-col items-center justify-center gap-1"
                    >
                      <ImagePlus className="w-5 h-5" style={{ color: ACCENT }} />
                      <span className="text-[9px] font-semibold text-[#cfe9a3] px-1 text-center leading-tight">{t.add}</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
              </div>

              {/* Name + Beschreibung — Pflicht */}
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-[12px] font-bold text-white mb-1.5">{t.name} {!isEdit && <span className="text-amber-300">*</span>}</label>
                  <input
                    value={titel}
                    onChange={(e) => setTitel(e.target.value)}
                    placeholder={t.namePh}
                    maxLength={140}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition"
                  />
                </div>
                {isEdit && (
                  <div>
                    <label className="block text-[12px] font-bold text-white mb-1.5">{t.price}</label>
                    <input
                      value={preis}
                      onChange={(e) => setPreis(e.target.value)}
                      placeholder={t.pricePh}
                      maxLength={40}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-bold text-white mb-1.5">{t.desc} {!isEdit && <span className="text-amber-300">*</span>}</label>
                  <textarea
                    value={beschreibung}
                    onChange={(e) => setBeschreibung(e.target.value)}
                    placeholder={t.descPh}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-zinc-600 focus:border-[#95BF47]/60 outline-none transition resize-none"
                  />
                </div>
              </div>

              {/* Anforderungs-Checkliste — hakt live ab (nur Genesis; im
                  Edit-Modus ist alles optional) */}
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-5 ${isEdit ? "hidden" : ""}`}>
                {reqs.map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                    <motion.span
                      animate={r.ok ? { scale: [0.6, 1.15, 1] } : {}}
                      transition={{ duration: 0.3 }}
                      className={`flex items-center justify-center w-4 h-4 rounded-full border ${
                        r.ok ? "border-[#95BF47] bg-[#95BF47]" : "border-white/25"
                      }`}
                    >
                      {r.ok && <Check className="w-2.5 h-2.5 text-[#0a0a0a]" />}
                    </motion.span>
                    <span className={r.ok ? "text-[#cfe9a3]" : "text-zinc-500"}>{r.label}</span>
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={onBack}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[12.5px] font-semibold text-zinc-300 hover:text-white transition"
                >
                  {t.cancel}
                </button>
                <motion.button
                  onClick={handleStart}
                  disabled={!canStart}
                  whileTap={canStart ? { scale: 0.97 } : undefined}
                  className="btn-deploy flex items-center gap-2 px-5 py-2.5 text-[13px] disabled:opacity-40 disabled:saturate-50"
                >
                  {saving || uploadsPending
                    ? <CircleDashed className="w-4 h-4 animate-spin" />
                    : isEdit ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {t.start}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
