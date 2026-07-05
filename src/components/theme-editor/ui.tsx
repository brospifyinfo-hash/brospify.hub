"use client";

// ─── Premium-UI-Bausteine des Theme-Editors ─────────────────────────
// Konsistente, hochwertige Grundelemente (Karten, Gruppen-Header, Preset-
// Kacheln, Feld-Labels), damit der ganze Editor edel & verständlich wirkt.
// Bewusst schlicht gehalten: klare Hierarchie, dezente Glas-Flächen, Icons.

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

/** Abschnitts-Überschrift mit Akzent-Strich (klare Gliederung). */
export function GroupTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2 mt-0.5">
      <div className="flex items-center gap-1.5">
        <span className="h-3 w-[3px] rounded-full" style={{ background: ACCENT }} />
        <span className="text-[10.5px] uppercase tracking-[0.15em] font-bold text-zinc-400">{children}</span>
      </div>
      {right}
    </div>
  );
}

/** Aufklappbare Premium-Gruppe (Glas-Karte + Chevron). */
export function Collapsible({
  title, icon, open, onToggle, children,
}: {
  title: string; icon?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <span className="text-[11px] uppercase tracking-[0.13em] font-bold text-white flex-1 text-left">{title}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3.5 pt-0.5 border-t border-white/[0.05]">{children}</div>}
    </div>
  );
}

/** Große, klar erkennbare Style-Art-Kachel (statt schlichter Chips). */
export function PresetTile({
  label, hint, active, onClick,
}: {
  label: string; hint?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative text-left rounded-xl border px-3 py-2.5 transition ${
        active
          ? "border-[#95BF47]/60 bg-[#95BF47]/[0.12] shadow-[0_2px_14px_-6px_rgba(149,191,71,0.5)]"
          : "border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/[0.14]"
      }`}
    >
      <span className={`block text-[12.5px] font-semibold ${active ? "text-white" : "text-zinc-200"}`}>{label}</span>
      {hint && <span className="block text-[10px] text-zinc-500 leading-tight mt-0.5">{hint}</span>}
      {active && (
        <span className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#0a0a0a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
      )}
    </button>
  );
}

/** Feld-Label über einem Eingabefeld. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="block text-[10.5px] font-medium text-zinc-400 mb-1">{children}</span>;
}

/** Premium-Textinput (konsistenter Look). */
export function TextField({
  value, placeholder, onChange, textarea,
}: {
  value: string; placeholder?: string; onChange: (v: string) => void; textarea?: boolean;
}) {
  const cls =
    "w-full bg-black/20 border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[12px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/50 focus:bg-black/30 transition";
  return textarea ? (
    <textarea rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls + " resize-y leading-snug"} />
  ) : (
    <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cls} />
  );
}

/** Segment-Umschalter (2–3 Optionen) — hochwertiger als lose Buttons. */
export function Segmented<T extends string | number>({
  options, value, onChange,
}: {
  options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-lg border border-white/[0.1] bg-black/20 p-0.5">
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition ${
            value === v ? "bg-[#95BF47] text-[#0a0a0a]" : "text-zinc-400 hover:text-white"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
