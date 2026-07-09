"use client";

// ─── Admin: Bro-Maskottchen-Bilder verwalten ────────────────────────
// 3 Gruppen à 3 Bilder (Default/Idle · Nachdenken · Arbeiten). Jedes Bild
// wird sofort per /api/bro-mascot gespeichert (kein globaler Speichern-Klick).
// Eigener, isolierter Store — fasst den großen Settings-Blob NICHT an.

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, Smile } from "lucide-react";
import { ImageUploadField } from "@/components/theme-editor/ImageUploadField";

type Group = "idle" | "thinking" | "working";
interface Cfg {
  idle: string[];
  thinking: string[];
  working: string[];
}

const pad3 = (a: string[] = []): string[] => [a[0] || "", a[1] || "", a[2] || ""];
const emptyCfg = (): Cfg => ({ idle: pad3(), thinking: pad3(), working: pad3() });

const GROUPS: { key: Group; label: string; hint: string; emoji: string }[] = [
  { key: "idle", label: "Standard", hint: "Wenn die AI gerade nichts macht.", emoji: "🙂" },
  { key: "thinking", label: "Nachdenken", hint: "Während die AI einen Plan erstellt.", emoji: "🤔" },
  { key: "working", label: "Arbeiten", hint: "Während die AI das Theme umsetzt.", emoji: "🛠️" },
];

export function BroMascotAdmin() {
  const [cfg, setCfg] = useState<Cfg>(emptyCfg);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/bro-mascot", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d === "object") {
          setCfg({ idle: pad3(d.idle), thinking: pad3(d.thinking), working: pad3(d.working) });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Speichern strikt SERIALISIEREN: schnelle Uploads auf mehrere Slots dürfen
  // sich nicht überholen — sonst rollt eine verspätete Antwort ein neueres Bild
  // zurück, und der allererste gleichzeitige Save könnte doppelte Store-Zeilen
  // anlegen. Kein Re-Sync aus der Server-Antwort: die optimistische UI IST die
  // Wahrheit (der Server sanitized nur, pad3 hält die 3 Slots ohnehin stabil).
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);

  function persist(next: Cfg) {
    setCfg(next); // optimistisch
    setErr(null);
    pending.current += 1;
    setSaving(true);
    chain.current = chain.current
      .catch(() => {}) // ein früherer Fehler blockiert die Kette nicht
      .then(() =>
        fetch("/api/bro-mascot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        }).then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        }),
      )
      .then(
        () => setSavedAt(Date.now()),
        () => setErr("Speichern fehlgeschlagen — bitte erneut versuchen."),
      )
      .finally(() => {
        pending.current -= 1;
        if (pending.current === 0) setSaving(false);
      });
  }

  const setSlot = (group: Group, i: number, url: string) =>
    persist({ ...cfg, [group]: cfg[group].map((u, ix) => (ix === i ? url : u)) });

  const justSaved = savedAt > 0 && Date.now() - savedAt < 4000;

  return (
    <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Smile className="w-5 h-5 text-[#95BF47]" />
          Bro-Maskottchen
        </h3>
        <span className="text-xs">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Speichern …
            </span>
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1 text-[#95BF47]">
              <Check className="w-3.5 h-3.5" /> Gespeichert
            </span>
          ) : null}
        </span>
      </div>
      <p className="text-zinc-400 text-sm">
        Bro erscheint als kleines Profilbild unten an der AI-Eingabe im Theme-Editor. Pro Zustand kannst du bis
        zu 3 Bilder hinterlegen — sie wechseln automatisch. PNG, JPG, WebP oder animierte <strong>GIFs</strong>{" "}
        (GIFs bis 15 MB, sonst 5 MB) — animierte GIFs laufen von selbst. Ohne Bilder zeigt Bro einen Emoji als Platzhalter.
      </p>

      {err && (
        <div className="rounded-lg border border-red-400/25 bg-red-500/[0.08] px-3 py-2 text-[12px] font-medium text-red-300">
          {err}
        </div>
      )}

      <div className="space-y-5">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="text-lg leading-none">{g.emoji}</span>
              <span className="text-sm font-semibold text-white">{g.label}</span>
              <span className="text-xs text-zinc-500">{g.hint}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <ImageUploadField
                  key={i}
                  value={cfg[g.key][i] || ""}
                  onChange={(url) => setSlot(g.key, i, url)}
                  round
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
