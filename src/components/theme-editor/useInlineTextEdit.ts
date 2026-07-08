"use client";

// ─── Inline-Text-Bearbeitung in der Live-Vorschau (reine DOM-Mechanik) ──────
// Klick auf einen Text → das Blatt-Element wird editierbar (contentEditable),
// Bestätigen mit Blur/Enter ruft commit(neuerText). WELCHES Feld ein Text ist,
// entscheidet der übergebene resolve()-Callback (matcht gegen Section- ODER
// Kaufbox-Felder). Dieser Hook kümmert sich nur um Auswahl, contentEditable,
// Commit und React-Sicherheit.
//
// ROBUSTHEIT (wir fassen React-verwaltete Textknoten an):
//  - Der editierte Knoten ist als EIN reiner Text-Kind gerendert
//    (<h2>{t.heading}</h2>). Er darf NIE Kind-Elemente bekommen, sonst
//    zerschießt das Reacts Reconciliation. Deshalb: contenteditable=
//    "plaintext-only", Enter COMMITTET immer (kein Umbruch/Block), Paste →
//    reiner Text. Restore beim Abbruch IN-PLACE über nodeValue (React-Referenz
//    bleibt gültig). Der Listener wird EINMAL angehängt (Zustand via Refs),
//    damit ein fremder Re-Render eine laufende Bearbeitung nicht abbricht.

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { normSingle, normMulti } from "@/components/theme-editor/inlineTextMatch";

export interface InlineEditTarget {
  multiline: boolean;
  commit: (value: string) => void;
}

export function useInlineTextEdit(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  resolve: (leaf: HTMLElement) => InlineEditTarget | null,
) {
  const enabledRef = useRef(enabled);
  const resolveRef = useRef(resolve);
  enabledRef.current = enabled;
  resolveRef.current = resolve;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let active: { el: HTMLElement; original: string; multiline: boolean; commit: (v: string) => void } | null = null;
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
      // DOM immer auf den Originalwert zurücksetzen — React rendert beim Commit
      // ohnehin mit dem neuen Wert neu (konsistente Reconciliation).
      setLeafText(a.el, a.original);
      if (commit && !cancel && next && next !== norm(a.original)) {
        a.commit(next);
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
        e.preventDefault(); // Enter committet IMMER — nie einen Block einfügen.
        active?.el.blur();
      }
    };
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
      const target = e.target as HTMLElement | null;
      if (!target || !root.contains(target)) return;
      if (active && (target === active.el || active.el.contains(target))) return;
      if (active) finish(true);

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

      const tgt = resolveRef.current(leaf);
      if (!tgt) return; // kein editierbares Feld an dieser Stelle

      // Section-/Baustein-Auswahl NICHT auslösen (kein Re-Render, der den
      // Editor wegwirft).
      e.stopPropagation();
      e.preventDefault();

      active = { el: leaf, original: leaf.innerText, multiline: tgt.multiline, commit: tgt.commit };
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

    root.addEventListener("click", onClick, true);
    return () => {
      root.removeEventListener("click", onClick, true);
      if (active) finish(true);
    };
  }, [rootRef]);
}
