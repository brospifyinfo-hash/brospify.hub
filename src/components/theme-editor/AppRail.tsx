"use client";

// ─── AppRail: linke Programm-Leiste des Editors (Desktop) ───────────────
// Wie die Datei-Leiste eines Desktop-Programms (Word-Backstage): oben die
// Projekt-Aktionen (Neu / Öffnen / Speichern / Speichern unter), darunter
// Design-Werkzeuge, unten Hilfe + Konto. Schmale Spalte, Icon + Mini-Label,
// Tooltips über title. Nur im Editor-Modus sichtbar (lg+).

import {
  FilePlus2, FolderOpen, Save, SaveAll, Palette, Shuffle, Maximize2,
  Keyboard, Settings, type LucideIcon,
} from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface AppRailT {
  groupProject: string;
  groupDesign: string;
  newProject: string;
  openProjects: string;
  save: string;
  saveAs: string;
  style: string;
  randomize: string;
  fullPreview: string;
  shortcuts: string;
  account: string;
  unsavedHint: string;
  /** Lokalisierte Modifier-Taste („Strg"/„Ctrl") für den Speichern-Tooltip. */
  ctrl: string;
}

function RailButton({
  icon: Ico, label, onClick, disabled, title, accent, dot,
}: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean;
  title?: string; accent?: boolean; dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      className="group relative w-full flex flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition"
    >
      <span className="relative">
        <Ico className="w-[17px] h-[17px]" style={accent ? { color: ACCENT } : undefined} />
        {dot && (
          <span
            className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-white group-hover:ring-transparent"
            aria-hidden
          />
        )}
      </span>
      <span className="block w-full text-center text-[8.5px] font-semibold leading-[1.15] tracking-tight">
        {label}
      </span>
    </button>
  );
}

function RailGroupLabel({ children }: { children: string }) {
  return (
    <span className="block text-center text-[7.5px] uppercase tracking-[0.16em] font-bold text-zinc-500 mt-1 mb-0.5 select-none">
      {children}
    </span>
  );
}

export default function AppRail({
  t, dirty, busy, hasProject,
  onNew, onOpen, onSave, onSaveAs, onStyle, onRandomize, onFullPreview, onShortcuts, onAccount,
}: {
  t: AppRailT;
  /** Ungespeicherte Änderungen (amber Punkt am Speichern-Button). */
  dirty: boolean;
  /** AI-/Genesis-Lauf: alle mutierenden Aktionen gesperrt. */
  busy: boolean;
  /** Es gibt ein aktives Produkt/Dokument. */
  hasProject: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onStyle: () => void;
  onRandomize: () => void;
  onFullPreview: () => void;
  onShortcuts: () => void;
  onAccount: () => void;
}) {
  return (
    <nav
      aria-label={t.groupProject}
      className="glass-strong rounded-xl border border-white/[0.08] w-[72px] h-full shrink-0 flex flex-col items-stretch px-1 py-1.5 overflow-y-auto no-scrollbar"
    >
      <RailGroupLabel>{t.groupProject}</RailGroupLabel>
      <RailButton icon={FilePlus2} label={t.newProject} onClick={onNew} disabled={busy} />
      <RailButton icon={FolderOpen} label={t.openProjects} onClick={onOpen} disabled={busy || !hasProject} />
      <RailButton
        icon={Save}
        label={t.save}
        onClick={onSave}
        disabled={busy || !hasProject}
        title={dirty ? `${t.save} — ${t.unsavedHint} (${t.ctrl}+S)` : `${t.save} (${t.ctrl}+S)`}
        dot={dirty && hasProject}
      />
      <RailButton icon={SaveAll} label={t.saveAs} onClick={onSaveAs} disabled={busy || !hasProject} />

      <div className="h-px bg-white/10 mx-1.5 my-1.5" aria-hidden />

      <RailGroupLabel>{t.groupDesign}</RailGroupLabel>
      <RailButton icon={Palette} label={t.style} onClick={onStyle} disabled={busy || !hasProject} accent />
      <RailButton icon={Shuffle} label={t.randomize} onClick={onRandomize} disabled={busy || !hasProject} />
      <RailButton icon={Maximize2} label={t.fullPreview} onClick={onFullPreview} disabled={!hasProject} />

      <div className="mt-auto" aria-hidden />
      <div className="h-px bg-white/10 mx-1.5 my-1.5" aria-hidden />
      <RailButton icon={Keyboard} label={t.shortcuts} onClick={onShortcuts} />
      <RailButton icon={Settings} label={t.account} onClick={onAccount} />
    </nav>
  );
}
