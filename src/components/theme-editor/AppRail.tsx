"use client";

// ─── AppRail: linke Programm-Leiste des Editors (Desktop) ───────────────
// Edle, EXPLIZIT HELLE Werkzeug-Spalte (der Editor ist fest hell — bewusst
// nicht über die generischen theme-light-Wildcards gestylt, sondern mit
// festen Farben wie das Profil-Menü): weiße Karte, Icon-Kacheln mit
// weichen Hover-/Aktiv-Zuständen (Klassen bspx-rail-* in globals.css),
// Gruppen-Labels, Amber-Zustand am Speichern bei ungespeicherten
// Änderungen, Grün-Akzent für das Signature-Feature Shop-Check. KEINE
// Duplikate von Buttons, die woanders leben. Über den Griff unten
// einklappbar (Schnell-Speichern bleibt erreichbar).

import { useRef } from "react";
import {
  FilePlus2, FolderOpen, Save, SaveAll, ClipboardCheck, Eye, FileDown, FileUp,
  ChevronsLeft, ChevronsRight, type LucideIcon,
} from "lucide-react";

const INK_SOFT = "#5c5a66";
const INK_FAINT = "#a5a3ad";
const LINE = "#ecece9";
const GREEN_DEEP = "#55771f";
const GREEN_WASH = "rgba(149,191,71,0.14)";
const AMBER = "#f59e0b";
const AMBER_DEEP = "#92600a";
const AMBER_WASH = "rgba(245,158,11,0.13)";

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

/** Icon-Kachel + Mini-Label. tone steuert die Kachel-Färbung:
 *  neutral (Standard) · green (Signature-Feature) · amber (ungespeichert). */
function RailButton({
  icon: Ico, label, onClick, disabled, title, dot, active, tone = "neutral",
}: {
  icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean;
  title?: string; dot?: boolean; active?: boolean; tone?: "neutral" | "green" | "amber";
}) {
  const tileStyle: React.CSSProperties =
    active
      ? { background: GREEN_WASH, boxShadow: "inset 0 0 0 1.5px rgba(149,191,71,0.55)" }
      : tone === "green"
        ? { background: "linear-gradient(135deg, rgba(149,191,71,0.18), rgba(149,191,71,0.05))" }
        : tone === "amber"
          ? { background: AMBER_WASH }
          : {};
  const iconColor = active || tone === "green" ? GREEN_DEEP : tone === "amber" ? AMBER_DEEP : INK_SOFT;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title || label}
      aria-pressed={active}
      data-tone={active || tone !== "neutral" ? "tinted" : "neutral"}
      className="bspx-rail-btn group w-full flex flex-col items-center gap-[3px] py-[5px] disabled:opacity-[0.28] disabled:pointer-events-none"
      style={{ background: "transparent", border: 0, cursor: "pointer", padding: "5px 0" }}
    >
      <span
        className="bspx-rail-tile relative flex items-center justify-center rounded-xl"
        style={{ width: 40, height: 40, ...tileStyle }}
      >
        <Ico style={{ width: 18, height: 18, color: iconColor }} strokeWidth={1.8} />
        {dot && (
          <span
            className="absolute rounded-full"
            style={{ top: 5, right: 5, width: 7, height: 7, background: AMBER, boxShadow: "0 0 0 2px #ffffff" }}
            aria-hidden
          />
        )}
      </span>
      <span
        className="bspx-rail-label block w-full text-center font-semibold leading-[1.15]"
        style={{ fontSize: 9, letterSpacing: "-0.01em" }}
      >
        {label}
      </span>
    </button>
  );
}

function RailGroupLabel({ children }: { children: string }) {
  return (
    <span
      className="block text-center uppercase select-none"
      style={{ fontSize: 7.5, letterSpacing: "0.2em", fontWeight: 800, color: INK_FAINT, margin: "8px 0 3px" }}
    >
      {children}
    </span>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: LINE, margin: "8px 10px" }} aria-hidden />;
}

const CARD: React.CSSProperties = {
  background: "#ffffff",
  border: `1px solid ${LINE}`,
  borderRadius: 16,
  boxShadow: "0 1px 2px rgba(20,18,26,0.04), 0 14px 36px -22px rgba(20,18,26,0.22)",
};

export default function AppRail({
  t, dirty, busy, hasProject, saving, collapsed, focusMode,
  onNew, onOpen, onSave, onSaveAs, onShopCheck, onToggleFocus, onExport, onImportFile, onToggleCollapse,
}: {
  t: AppRailT;
  dirty: boolean;
  busy: boolean;
  hasProject: boolean;
  saving: boolean;
  collapsed: boolean;
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
  const saveTitle = dirty ? `${t.save} — ${t.unsavedHint} (${t.ctrl}+S)` : `${t.save} (${t.ctrl}+S)`;

  if (collapsed) {
    return (
      <nav
        aria-label={t.groupProject}
        className="h-full shrink-0 flex flex-col items-center gap-1"
        style={{ ...CARD, width: 44, padding: "8px 4px" }}
      >
        <button
          onClick={onToggleCollapse}
          title={t.expand}
          aria-label={t.expand}
          className="bspx-rail-slim flex items-center justify-center rounded-lg"
          style={{ width: 32, height: 32, background: "transparent", border: 0, cursor: "pointer" }}
        >
          <ChevronsRight style={{ width: 16, height: 16 }} strokeWidth={1.8} />
        </button>
        <div style={{ height: 1, background: LINE, width: 20 }} aria-hidden />
        {/* Schnell-Speichern bleibt auch eingeklappt erreichbar */}
        <button
          onClick={onSave}
          disabled={busy || !hasProject || saving}
          title={saveTitle}
          aria-label={t.save}
          className="bspx-rail-slim relative flex items-center justify-center rounded-lg disabled:opacity-[0.28] disabled:pointer-events-none"
          style={{
            width: 32, height: 32, border: 0, cursor: "pointer",
            background: dirty && hasProject ? AMBER_WASH : "transparent",
            color: dirty && hasProject ? AMBER_DEEP : undefined,
          }}
        >
          <Save style={{ width: 16, height: 16 }} strokeWidth={1.8} />
          {dirty && hasProject && (
            <span
              className="absolute rounded-full"
              style={{ top: 3, right: 3, width: 6, height: 6, background: AMBER, boxShadow: "0 0 0 2px #ffffff" }}
              aria-hidden
            />
          )}
        </button>
      </nav>
    );
  }

  return (
    <nav
      aria-label={t.groupProject}
      className="h-full shrink-0 flex flex-col items-stretch overflow-y-auto no-scrollbar"
      style={{ ...CARD, width: 78, padding: "6px 5px 8px" }}
    >
      <RailGroupLabel>{t.groupProject}</RailGroupLabel>
      <RailButton icon={FilePlus2} label={t.newProject} onClick={onNew} disabled={busy || saving} />
      <RailButton icon={FolderOpen} label={t.openProjects} onClick={onOpen} disabled={busy || saving || !hasProject} />
      <RailButton
        icon={Save}
        label={t.save}
        onClick={onSave}
        disabled={busy || !hasProject || saving}
        title={saveTitle}
        dot={dirty && hasProject}
        tone={dirty && hasProject ? "amber" : "neutral"}
      />
      <RailButton icon={SaveAll} label={t.saveAs} onClick={onSaveAs} disabled={busy || saving || !hasProject} />
      <RailButton icon={FileDown} label={t.exportFile} onClick={onExport} disabled={!hasProject} title={t.exportHint} />
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

      <Hairline />

      <RailGroupLabel>{t.groupTools}</RailGroupLabel>
      <RailButton
        icon={ClipboardCheck}
        label={t.shopCheck}
        onClick={onShopCheck}
        disabled={!hasProject}
        title={t.shopCheckHint}
        tone="green"
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
      <Hairline />
      <button
        onClick={onToggleCollapse}
        title={t.collapse}
        aria-label={t.collapse}
        className="bspx-rail-slim mx-auto flex items-center justify-center rounded-lg"
        style={{ width: 34, height: 26, background: "transparent", border: 0, cursor: "pointer" }}
      >
        <ChevronsLeft style={{ width: 15, height: 15 }} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
