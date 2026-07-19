"use client";

// ─── AppRail: linke Programm-Leiste des Editors (Desktop) ───────────────
// Wie die Datei-Leiste eines Desktop-Programms (Word-Backstage): oben die
// Projekt-Aktionen (Neu / Öffnen / Speichern / Speichern unter), darunter
// Werkzeuge (Shop-Check, Fokus-Modus, Projekt-Datei Export/Import). KEINE
// Duplikate von Buttons, die woanders leben (Stil-Galerie/Zufall → Bereich
// „Allgemeines Design", Vollbild → Vorschau-Toolbar, Kürzel/Konto →
// Profil-Menü). Über den Pfeil unten lässt sich die Leiste zu einem
// schmalen Streifen einklappen (Schnell-Speichern bleibt erreichbar).

import { useRef } from "react";
import {
  FilePlus2, FolderOpen, Save, SaveAll, ClipboardCheck, Eye, FileDown, FileUp,
  ChevronsLeft, ChevronsRight, type LucideIcon,
} from "lucide-react";
import { ACCENT } from "@/components/theme-editor/editor-ui";

export interface AppRailT {
  groupProject: string;
  groupTools: string;
  newProject: string;
  openProjects: string;
  save: string;
  saveAs: string;
  shopCheck: string;
  shopCheckHint: string;
  focus: string;
  focusHint: string;
  exportFile: string;
  exportHint: string;
  importFile: string;
  importHint: string;
  collapse: string;
  expand: string;
  unsavedHint: string;
  /** Lokalisierte Modifier-Taste („Strg"/„Ctrl") für den Speichern-Tooltip. */
  ctrl: string;
}

function RailButton({
  icon: Ico, label, onClick, disabled, title, accent, dot, active,
}: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean;
  title?: string; accent?: boolean; dot?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-pressed={active}
      className={`group relative w-full flex flex-col items-center gap-1 rounded-lg px-0.5 py-2 disabled:opacity-30 disabled:pointer-events-none transition ${
        active
          ? "bg-[#95BF47]/[0.14] text-white border border-[#95BF47]/40"
          : "text-zinc-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
      }`}
    >
      <span className="relative">
        <Ico className="w-[17px] h-[17px]" style={accent || active ? { color: ACCENT } : undefined} />
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
  t, dirty, busy, hasProject, saving, collapsed, focusMode,
  onNew, onOpen, onSave, onSaveAs, onShopCheck, onToggleFocus, onExport, onImportFile, onToggleCollapse,
}: {
  t: AppRailT;
  /** Ungespeicherte Änderungen (amber Punkt am Speichern-Button). */
  dirty: boolean;
  /** AI-/Genesis-Lauf: alle mutierenden Aktionen gesperrt. */
  busy: boolean;
  /** Es gibt ein aktives Produkt/Dokument. */
  hasProject: boolean;
  /** Speichern-Fetch läuft (Neu/Öffnen bleiben gesperrt, kein Rail-Flackern). */
  saving: boolean;
  /** Eingeklappt: schmaler Streifen, nur Ausklappen + Schnell-Speichern. */
  collapsed: boolean;
  /** Fokus-Modus aktiv (Seitenleisten ausgeblendet). */
  focusMode: boolean;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onShopCheck: () => void;
  onToggleFocus: () => void;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onToggleCollapse: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (collapsed) {
    return (
      <nav
        aria-label={t.groupProject}
        className="glass-strong rounded-xl border border-white/[0.08] w-9 h-full shrink-0 flex flex-col items-center px-0.5 py-1.5 gap-1"
      >
        <button
          onClick={onToggleCollapse}
          title={t.expand}
          aria-label={t.expand}
          className="w-full flex items-center justify-center rounded-lg py-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
        <div className="h-px w-4 bg-white/10" aria-hidden />
        {/* Schnell-Speichern bleibt auch eingeklappt erreichbar */}
        <button
          onClick={onSave}
          disabled={busy || !hasProject || saving}
          title={dirty ? `${t.save} — ${t.unsavedHint} (${t.ctrl}+S)` : `${t.save} (${t.ctrl}+S)`}
          aria-label={t.save}
          className="group relative w-full flex items-center justify-center rounded-lg py-2 text-zinc-300 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <Save className="w-4 h-4" />
          {dirty && hasProject && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-white group-hover:ring-transparent" aria-hidden />
          )}
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t.groupProject}
      className="glass-strong rounded-xl border border-white/[0.08] w-[72px] h-full shrink-0 flex flex-col items-stretch px-1 py-1.5 overflow-y-auto no-scrollbar"
    >
      <RailGroupLabel>{t.groupProject}</RailGroupLabel>
      <RailButton icon={FilePlus2} label={t.newProject} onClick={onNew} disabled={busy || saving} />
      <RailButton icon={FolderOpen} label={t.openProjects} onClick={onOpen} disabled={busy || saving || !hasProject} />
      <RailButton
        icon={Save}
        label={t.save}
        onClick={onSave}
        disabled={busy || !hasProject || saving}
        title={dirty ? `${t.save} — ${t.unsavedHint} (${t.ctrl}+S)` : `${t.save} (${t.ctrl}+S)`}
        dot={dirty && hasProject}
      />
      <RailButton icon={SaveAll} label={t.saveAs} onClick={onSaveAs} disabled={busy || saving || !hasProject} />
      <RailButton
        icon={FileDown}
        label={t.exportFile}
        onClick={onExport}
        disabled={!hasProject}
        title={t.exportHint}
      />
      <RailButton
        icon={FileUp}
        label={t.importFile}
        onClick={() => fileRef.current?.click()}
        disabled={busy || !hasProject}
        title={t.importHint}
      />
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />

      <div className="h-px bg-white/10 mx-1.5 my-1.5" aria-hidden />

      <RailGroupLabel>{t.groupTools}</RailGroupLabel>
      <RailButton
        icon={ClipboardCheck}
        label={t.shopCheck}
        onClick={onShopCheck}
        disabled={!hasProject}
        title={t.shopCheckHint}
        accent
      />
      <RailButton
        icon={Eye}
        label={t.focus}
        onClick={onToggleFocus}
        disabled={!hasProject}
        title={t.focusHint}
        active={focusMode}
      />

      <div className="mt-auto" aria-hidden />
      <div className="h-px bg-white/10 mx-1.5 my-1.5" aria-hidden />
      <button
        onClick={onToggleCollapse}
        title={t.collapse}
        aria-label={t.collapse}
        className="w-full flex items-center justify-center rounded-lg py-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] transition"
      >
        <ChevronsLeft className="w-4 h-4" />
      </button>
    </nav>
  );
}
