"use client";

// ─── Kompakte Premium-UI-Bausteine des Theme-Editors ────────────────
// Dicht wie der Shopify-Theme-Editor: viel Einstellungen ohne Scrollen,
// trotzdem edel & klar. Kleine Schriften, enge Abstände, saubere Flächen.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

/** Kleiner Abschnitts-Header mit Akzent-Strich (dicht). */
export function GroupTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1 mt-0.5">
      <div className="flex items-center gap-1">
        <span className="h-2 w-[2.5px] rounded-full" style={{ background: ACCENT }} />
        <span className="text-[9px] uppercase tracking-[0.13em] font-bold text-zinc-400">{children}</span>
      </div>
      {right}
    </div>
  );
}

/** Aufklappbare kompakte Gruppe. */
export function Collapsible({
  title, icon, open, onToggle, children,
}: {
  title: string; icon?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-1.5 px-2.5 py-2 hover:bg-white/[0.03] transition">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <span className="text-[10px] uppercase tracking-[0.12em] font-bold text-white flex-1 text-left">{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-2.5 pb-2.5 pt-0.5 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

/** Kompakte Style-Art-Pille (dicht, mehrere pro Zeile). Häkchen wenn aktiv. */
export function PresetPill({ label, hint, active, onClick }: { label: string; hint?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-[2px] text-[10px] font-semibold leading-none transition ${
        active
          ? "border-[#95BF47]/60 bg-[#95BF47]/[0.14] text-white"
          : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white hover:border-white/[0.16]"
      }`}
    >
      {active && (
        <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      )}
      {label}
    </button>
  );
}

/** Feld-Label (klein, dicht). */
export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-0.5 leading-none">
      <span className="text-[9px] font-medium text-zinc-400 truncate">{children}</span>
      {right && <span className="text-[9px] font-mono text-zinc-500 shrink-0 ml-1">{right}</span>}
    </div>
  );
}

/** Kompakter Textinput. */
export function TextField({ value, placeholder, onChange, textarea }: { value: string; placeholder?: string; onChange: (v: string) => void; textarea?: boolean }) {
  const cls =
    "w-full bg-black/25 border border-white/[0.1] rounded px-1.5 py-[2px] text-[10.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/50 transition";
  return textarea ? (
    <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls + " resize-y leading-snug"} />
  ) : (
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
  );
}

/** Kompakter Segment-Umschalter (2–4 Optionen). */
export function Segmented<T extends string | number>({ options, value, onChange }: { options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex w-full rounded border border-white/[0.1] bg-black/25 p-[2px]">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-[3px] px-1 py-[2px] text-[9.5px] font-semibold leading-none transition ${value === v ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-400 hover:text-white"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** Kompakte Farbwahl (Swatch + Hex). */
export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1 bg-black/25 border border-white/[0.1] rounded px-1 py-[1px]">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-[15px] h-[15px] rounded bg-transparent border-0 p-0 cursor-pointer shrink-0" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent text-[9.5px] font-mono text-white outline-none" />
    </div>
  );
}

/** Kompakter Slider mit Wert-Anzeige. */
export function SliderField({ value, min, max, step = 1, onChange, suffix = "" }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-1 accent-[#95BF47] cursor-pointer" />
      <span className="text-[9px] font-mono text-zinc-400 w-7 text-right shrink-0">{value}{suffix}</span>
    </div>
  );
}
