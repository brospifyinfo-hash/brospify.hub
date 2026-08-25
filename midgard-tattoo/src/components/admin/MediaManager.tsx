"use client";

// ─── Bilder verwalten ────────────────────────────────────────────
// Hochladen, beschriften, sortieren, löschen — und festlegen, was in
// der Galerie und was in der Hero-Slideshow erscheint.
//
// Der Upload nimmt mehrere Dateien auf einmal und schickt sie
// nacheinander: Ein Handyfoto durch die Umwandlung zu schicken dauert
// ein bis zwei Sekunden, zehn parallel würden die Funktion überlaufen
// lassen. Der Fortschritt steht daneben, damit die Wartezeit erklärt ist.

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

export function MediaManager({
  media,
  onChanged,
}: {
  media: MediaItem[];
  onChanged: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  const [ziehen, setZiehen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(id);
  }, [note]);

  const sortiert = media.slice().sort((a, b) => a.sortIndex - b.sortIndex);
  const imHero = sortiert.filter((m) => m.inHero).length;

  const hochladen = useCallback(
    async (dateien: FileList | File[]) => {
      const liste = Array.from(dateien);
      if (!liste.length) return;
      setBusy(true);
      setFehler(null);
      setFortschritt({ fertig: 0, gesamt: liste.length });

      let erfolgreich = 0;
      for (const [i, datei] of liste.entries()) {
        const form = new FormData();
        form.append("file", datei);
        // Der Dateiname ist als erster Titel besser als "Ohne Titel" —
        // der Inhaber schreibt ihn ohnehin gleich um.
        form.append("title", datei.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 80));
        try {
          const res = await fetch("/api/admin/media", { method: "POST", body: form });
          if (res.ok) erfolgreich += 1;
          else {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            setFehler(`${datei.name}: ${data.error ?? "Upload fehlgeschlagen."}`);
          }
        } catch {
          setFehler(`${datei.name}: keine Verbindung zum Server.`);
        }
        setFortschritt({ fertig: i + 1, gesamt: liste.length });
      }

      await onChanged();
      setBusy(false);
      setFortschritt(null);
      if (erfolgreich) {
        setNote(`${erfolgreich} ${erfolgreich === 1 ? "Bild" : "Bilder"} hochgeladen.`);
      }
      if (inputRef.current) inputRef.current.value = "";
    },
    [onChanged],
  );

  async function aendern(id: string, patch: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFehler(data.error ?? "Änderung fehlgeschlagen.");
        return;
      }
      await onChanged();
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  async function loeschen(item: MediaItem) {
    if (!window.confirm(`„${item.title}" wirklich löschen? Das Bild ist danach weg.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/media?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!res.ok) { setFehler("Löschen fehlgeschlagen."); return; }
      await onChanged();
      setNote("Bild gelöscht.");
    } catch {
      setFehler("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* ── Ablagefläche ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setZiehen(true); }}
        onDragLeave={() => setZiehen(false)}
        onDrop={(e) => {
          e.preventDefault();
          setZiehen(false);
          if (e.dataTransfer.files?.length) void hochladen(e.dataTransfer.files);
        }}
        className="card flex flex-col items-center justify-center gap-3 p-8 text-center transition-colors"
        style={{
          borderStyle: "dashed",
          borderColor: ziehen ? "var(--signal)" : "var(--ink-hair-strong)",
          background: ziehen ? "rgba(255,210,0,0.05)" : "var(--ink-card)",
        }}
      >
        <span className="display text-lg">Bilder hierher ziehen</span>
        <p className="max-w-[42ch] text-sm" style={{ color: "var(--bone-soft)" }}>
          Oder unten auswählen. JPG, PNG, WebP oder AVIF, bis 12 MB je Bild. Größe,
          Format und Vorschau macht die Seite automatisch.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          disabled={busy}
          onChange={(e) => e.target.files && void hochladen(e.target.files)}
          className="sr-only-visually"
          id="media-upload"
        />
        <label htmlFor="media-upload" className="btn btn-signal mt-2 cursor-pointer">
          {busy && fortschritt ? `${fortschritt.fertig} von ${fortschritt.gesamt} …` : "Bilder auswählen"}
        </label>
      </div>

      <AnimatePresence>
        {fehler && (
          <motion.p
            className="mt-4 rounded p-3 text-sm"
            style={{ background: "rgba(226,86,74,0.1)", color: "var(--danger)" }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            role="alert"
          >
            {fehler}
          </motion.p>
        )}
        {note && (
          <motion.p
            className="mt-4 rounded p-3 text-sm"
            style={{ background: "rgba(255,210,0,0.08)", color: "var(--signal)" }}
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            role="status"
          >
            {note}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Hinweis zur Slideshow ── */}
      <p className="mt-6 text-sm" style={{ color: "var(--bone-soft)" }}>
        {imHero === 0
          ? "Für die Slideshow oben auf der Startseite ist noch nichts markiert — dort laufen dann automatisch die ersten Galeriebilder."
          : `${imHero} ${imHero === 1 ? "Bild läuft" : "Bilder laufen"} in der Slideshow auf der Startseite.`}
      </p>

      {/* ── Liste ── */}
      {sortiert.length === 0 ? (
        <p className="py-12 text-center text-sm" style={{ color: "var(--bone-dim)" }}>
          Noch keine eigenen Bilder. Solange hier nichts steht, zeigt die Website die
          fünf mitgelieferten Motive.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          <AnimatePresence initial={false}>
            {sortiert.map((item, i) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="card overflow-hidden"
              >
                <div className="grid gap-4 p-4 sm:grid-cols-[120px_1fr]">
                  <div
                    className="relative aspect-[4/5] w-full overflow-hidden sm:w-[120px]"
                    style={{ border: "1px solid var(--ink-hair)" }}
                  >
                    <Image
                      src={item.url}
                      alt=""
                      fill
                      placeholder="blur"
                      blurDataURL={item.blur}
                      sizes="120px"
                      className="object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="eyebrow mb-1 block">Titel</span>
                        <input
                          className="field"
                          defaultValue={item.title}
                          // Beim Verlassen speichern statt bei jedem
                          // Tastendruck — sonst ein Schreibvorgang je Zeichen.
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value && value !== item.title) void aendern(item.id, { title: value });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow mb-1 block">Stil</span>
                        <input
                          className="field"
                          defaultValue={item.style}
                          placeholder="z. B. Black & Grey"
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value !== item.style) void aendern(item.id, { style: value });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow mb-1 block">Körperstelle</span>
                        <input
                          className="field"
                          defaultValue={item.placement}
                          placeholder="z. B. Unterarm"
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value !== item.placement) void aendern(item.id, { placement: value });
                          }}
                        />
                      </label>
                      <label className="block">
                        <span className="eyebrow mb-1 block">Bildbeschreibung</span>
                        <input
                          className="field"
                          defaultValue={item.alt}
                          placeholder="Was ist zu sehen?"
                          onBlur={(e) => {
                            const value = e.target.value.trim();
                            if (value !== item.alt) void aendern(item.id, { alt: value });
                          }}
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <Schalter
                        checked={item.inGallery}
                        disabled={busy}
                        onChange={(v) => void aendern(item.id, { inGallery: v })}
                        label="In der Galerie"
                      />
                      <Schalter
                        checked={item.inHero}
                        disabled={busy}
                        onChange={(v) => void aendern(item.id, { inHero: v })}
                        label="In der Slideshow"
                      />

                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy || i === 0}
                          onClick={() => void aendern(item.id, { move: -1 })}
                          aria-label="Nach vorne"
                          className="flex h-9 w-9 items-center justify-center rounded disabled:opacity-25"
                          style={{ border: "1px solid var(--ink-hair)" }}
                        >↑</button>
                        <button
                          type="button"
                          disabled={busy || i === sortiert.length - 1}
                          onClick={() => void aendern(item.id, { move: 1 })}
                          aria-label="Nach hinten"
                          className="flex h-9 w-9 items-center justify-center rounded disabled:opacity-25"
                          style={{ border: "1px solid var(--ink-hair)" }}
                        >↓</button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void loeschen(item)}
                          className="ml-2 min-h-[36px] rounded px-3 text-xs"
                          style={{ border: "1px solid rgba(226,86,74,0.35)", color: "var(--danger)" }}
                        >
                          Löschen
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function Schalter({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 cursor-pointer"
        style={{ accentColor: "var(--signal)" }}
      />
      <span className="text-sm" style={{ color: "var(--bone-soft)" }}>{label}</span>
    </label>
  );
}
