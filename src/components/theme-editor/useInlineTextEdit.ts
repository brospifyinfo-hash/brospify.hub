"use client";

// ─── Inline-Text-Bearbeitung in der Live-Vorschau ───────────────────────────
// Klick auf einen Text in der Vorschau → das Element wird direkt editierbar
// (contentEditable), Bestätigen mit Blur/Enter schreibt den neuen Text ins
// Dokument (dispatch setText, Undo-koalesziert). Es wird NICHTS in der
// Section-Replica annotiert: beim Klick wird der Text-Inhalt des angeklickten
// Blatt-Elements gegen die aufgelösten Feld-Werte der Section gematcht
// (resolveTexts) → so kennen wir uid + Feld. Nur einfache Text-/Textarea-
// Felder (kein HTML, keine dekorierten/zusammengesetzten Texte).
//
// ROBUSTHEIT (wichtig, da wir React-verwaltete Textknoten anfassen):
//  - Der editierte Knoten ist in SectionReplica als EIN reiner Text-Kind
//    gerendert (<h2>{t.heading}</h2>). Er darf NIE Kind-Elemente bekommen,
//    sonst zerschießt das Reacts Reconciliation (removeChild/stale nodeValue).
//    Deshalb: contenteditable="plaintext-only", Enter COMMITTET immer (fügt
//    nie einen Umbruch/Block ein), und Paste wird auf reinen Text reduziert.
//  - Restore beim Abbruch passiert IN-PLACE über nodeValue des bestehenden
//    Textknotens (React-Referenz bleibt gültig) — kein textContent-Replace.
//  - Der Listener wird EINMAL angehängt und liest den Zustand über Refs, damit
//    ein fremder Re-Render eine laufende Bearbeitung nicht abbricht.
// Mehrzeilige Felder bleiben editierbar; neue Umbrüche fügt man über die rechte
// Leiste ein (bestehende \n bleiben beim Inline-Editieren erhalten).

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { getSectionDef, resolveTexts } from "@/lib/theme-library";
import type { SectionInstance } from "@/lib/theme-doc";

interface FieldHit {
  field: string;
  multiline: boolean;
}

/** Einzeilige Normalisierung: NBSP/Whitespace → ein Space, trimmen. */
function normSingle(s: string): string {
  return s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

/** Mehrzeilige Normalisierung: Zeilenumbrüche BEHALTEN, nur je Zeile die
 *  horizontalen Whitespaces kollabieren; Leerzeilen-Ketten begrenzen. */
function normMulti(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Baut die Karte sichtbarer-Text → Feld für eine Section-Instanz. */
function buildFieldMap(inst: SectionInstance): Map<string, FieldHit> {
  const def = getSectionDef(inst.type);
  const map = new Map<string, FieldHit>();
  if (!def) return map;
  const texts = resolveTexts(inst);
  for (const f of def.fields) {
    // Nur echte Freitext-Felder inline bearbeitbar; HTML/Bild/Sonstiges nicht.
    if (f.kind !== "text" && f.kind !== "textarea") continue;
    if (f.html) continue;
    const val = texts[f.id];
    if (typeof val !== "string" || !val.trim() || val.includes("<")) continue;
    const multiline = f.kind === "textarea";
    // Matchen gegen die passende Normalisierung des sichtbaren Textes.
    const key = multiline ? normMulti(val) : normSingle(val);
    if (!map.has(key)) map.set(key, { field: f.id, multiline });
  }
  return map;
}

export function useInlineTextEdit(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  sections: SectionInstance[] | undefined,
  onCommit: (uid: string, field: string, value: string) => void,
) {
  // Aktueller Zustand über Refs — der Listener bleibt stabil angehängt.
  const enabledRef = useRef(enabled);
  const sectionsRef = useRef(sections);
  const commitRef = useRef(onCommit);
  enabledRef.current = enabled;
  sectionsRef.current = sections;
  commitRef.current = onCommit;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let active: { el: HTMLElement; uid: string; field: string; original: string; multiline: boolean } | null = null;
    let cancel = false;

    /** Text eines Blatt-Knotens IN-PLACE setzen (React-Textreferenz behalten). */
    const setLeafText = (el: HTMLElement, text: string) => {
      if (el.childNodes.length === 1 && el.firstChild && el.firstChild.nodeType === 3) {
        el.firstChild.nodeValue = text;
      } else {
        el.textContent = text;
      }
    };

    const finish = (commit: boolean) => {
      if (!active) return;
      const a = active;
      active = null;
      a.el.removeEventListener("keydown", onKey);
      a.el.removeEventListener("blur", onBlur);
      a.el.removeEventListener("paste", onPaste);
      a.el.removeAttribute("contenteditable");
      a.el.classList.remove("pm-editing");
      const norm = a.multiline ? normMulti : normSingle;
      const next = norm(a.el.innerText);
      // DOM immer auf den Originalwert zurücksetzen — React rendert die Section
      // beim Commit ohnehin mit dem neuen Wert neu (konsistente Reconciliation).
      setLeafText(a.el, a.original);
      if (commit && !cancel && next && next !== norm(a.original)) {
        commitRef.current(a.uid, a.field, next);
      }
      cancel = false;
    };

    const onBlur = () => finish(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancel = true;
        active?.el.blur();
      } else if (e.key === "Enter") {
        // Enter committet IMMER — nie einen Umbruch/Block-Knoten einfügen.
        e.preventDefault();
        active?.el.blur();
      }
    };
    // Paste auf reinen Text reduzieren (falls plaintext-only nicht greift).
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain");
      if (text == null) return;
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(text.replace(/\r\n?/g, " ")));
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    };

    const onClick = (e: MouseEvent) => {
      if (!enabledRef.current) return;
      const secs = sectionsRef.current;
      if (!secs?.length) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Klick auf das gerade editierte Element → Caret setzen lassen.
      if (active && (target === active.el || active.el.contains(target))) return;
      if (active) finish(true); // offenen Editor sauber schließen

      const sectionEl = target.closest<HTMLElement>("[data-section-uid]");
      if (!sectionEl || !root.contains(sectionEl)) return;
      const uid = sectionEl.getAttribute("data-section-uid") || "";
      const inst = secs.find((s) => s.uid === uid);
      if (!inst) return;

      // Blatt-Element bestimmen (nur reiner Text, keine Kind-Elemente).
      let leaf: HTMLElement | null = target;
      if (leaf.childElementCount > 0) {
        if (leaf.childElementCount === 1 && (leaf.firstElementChild as HTMLElement).childElementCount === 0) {
          leaf = leaf.firstElementChild as HTMLElement;
        } else {
          return;
        }
      }
      if (leaf.tagName === "BUTTON" || leaf.tagName === "A" || leaf.isContentEditable) return;

      const map = buildFieldMap(inst);
      const shown = leaf.innerText;
      const hit = map.get(normSingle(shown)) || map.get(normMulti(shown));
      if (!hit) return; // dekorierter/zusammengesetzter Text → nicht inline editierbar

      // Section-Auswahl NICHT auslösen (kein Re-Render, das den Editor wegwirft).
      e.stopPropagation();
      e.preventDefault();

      active = { el: leaf, uid, field: hit.field, original: leaf.innerText, multiline: hit.multiline };
      // plaintext-only verhindert Rich-Content/Block-Knoten; Fallback "true".
      leaf.setAttribute("contenteditable", "plaintext-only");
      if (leaf.contentEditable !== "plaintext-only") leaf.setAttribute("contenteditable", "true");
      leaf.classList.add("pm-editing");
      leaf.addEventListener("keydown", onKey);
      leaf.addEventListener("blur", onBlur);
      leaf.addEventListener("paste", onPaste);
      leaf.focus();
      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.selectNodeContents(leaf);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    };

    // Capture-Phase: läuft VOR den React-Bubble-Handlern (Section-Select),
    // sodass ein Text-Klick die Auswahl nicht umschaltet.
    root.addEventListener("click", onClick, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      if (active) finish(true); // laufende Bearbeitung beim echten Unmount sichern
    };
  }, [rootRef]);
}
