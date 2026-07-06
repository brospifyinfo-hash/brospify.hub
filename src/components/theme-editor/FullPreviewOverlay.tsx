"use client";

// ─── Fast-Vollbild-Vorschau (Overlay) ───────────────────────────────
// Zeigt die Live-Vorschau fast bildschirmfüllend (kleiner Rand bleibt) —
// reine Ansicht, keine Bearbeitung (keine Auswahl-/Einfüge-Handler).
// Eigener PC/Handy-Umschalter + Zoom-Regler; ESC, X oder Backdrop schließt.
// Fokus wandert beim Öffnen auf den Schließen-Button und bleibt per
// Tab-Trap im Overlay (dahinter liegen dokument-mutierende Editor-Buttons).

import { useEffect, useRef, useState } from "react";
import { X, Monitor, Smartphone, ZoomIn, ZoomOut, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import { ACCENT } from "@/components/theme-editor/editor-ui";
import type { ThemeDocument, SectionInstance, EditorPage } from "@/lib/theme-doc";

export default function FullPreviewOverlay({
  open, onClose, data, doc, sections, page, label, initialViewMode = "desktop",
  viewDesktop, viewMobile, zoomResetTitle, zoomLabel, closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  data: PreviewData | null;
  doc: ThemeDocument;
  /** Sections der gerade bearbeiteten Seite (Produkt- oder Startseite). */
  sections: SectionInstance[];
  page: EditorPage;
  label: string;
  initialViewMode?: "desktop" | "mobile";
  viewDesktop: string;
  viewMobile: string;
  zoomResetTitle: string;
  zoomLabel: string;
  closeLabel: string;
}) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">(initialViewMode);
  const [zoom, setZoom] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Beim Öffnen: Gerät aus dem Editor übernehmen, Zoom zurücksetzen,
  // Hintergrund-Scroll sperren, Fokus auf X; ESC schließt, Tab bleibt drin.
  useEffect(() => {
    if (!open) return;
    setViewMode(initialViewMode);
    setZoom(1);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])")]
        .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80]"
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.995 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-2 sm:inset-4 lg:inset-6 flex flex-col rounded-2xl border border-white/[0.1] bg-[#101014]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Kopfzeile: Label · PC/Handy · Zoom · Schließen */}
            <div className="flex items-center gap-2 px-2.5 sm:px-4 py-2 border-b border-white/[0.07] shrink-0">
              <Eye className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
              <span className="text-[13px] font-bold text-white truncate">{label}</span>
              <div className="ml-auto flex items-center gap-1.5 min-w-0">
                <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 shrink-0">
                  <button
                    onClick={() => setViewMode("desktop")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition ${viewMode === "desktop" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                  >
                    <Monitor className="w-3 h-3" /> <span className="hidden sm:inline">{viewDesktop}</span>
                  </button>
                  <button
                    onClick={() => setViewMode("mobile")}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-medium transition ${viewMode === "mobile" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                  >
                    <Smartphone className="w-3 h-3" /> <span className="hidden sm:inline">{viewMobile}</span>
                  </button>
                </div>
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))}
                  disabled={zoom <= 0.5}
                  className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-white disabled:opacity-25 transition"
                  aria-label={`${zoomLabel} −`}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={Math.round(zoom * 100)}
                  onChange={(e) => setZoom(Number(e.target.value) / 100)}
                  className="w-[70px] sm:w-[130px] accent-[#95BF47] cursor-pointer"
                  aria-label={zoomLabel}
                />
                <button
                  onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}
                  disabled={zoom >= 2}
                  className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-white disabled:opacity-25 transition"
                  aria-label={`${zoomLabel} +`}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  title={zoomResetTitle}
                  className="shrink-0 w-[34px] text-right text-[10.5px] font-semibold tabular-nums text-zinc-300 hover:text-white transition hidden sm:block"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  ref={closeRef}
                  onClick={onClose}
                  className="shrink-0 w-8 h-8 rounded-lg border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white flex items-center justify-center transition"
                  aria-label={closeLabel}
                  title={closeLabel}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Vorschau — nur Ansehen (keine Editor-Handler) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4">
              <ThemePreview
                data={data}
                colors={doc.global.colors}
                headingFont={doc.global.headingFont}
                bodyFont={doc.global.bodyFont}
                radius={doc.global.radius}
                loading={false}
                label={label}
                viewMode={viewMode}
                zoom={zoom}
                buyboxOrder={doc.buybox.order}
                hiddenBlocks={doc.buybox.hidden}
                shadow={doc.global.design.shadow}
                border={doc.global.design.border}
                iconStyle={doc.global.design.iconStyle}
                benefitIcons={doc.buybox.benefitIcons}
                buyboxCfg={doc.buybox.blocks}
                gallery={doc.buybox.gallery}
                spacing={doc.buybox.spacing}
                docSections={sections}
                page={page}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
