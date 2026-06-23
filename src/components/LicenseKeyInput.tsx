"use client";

import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

// Segmentierte Lizenzschlüssel-Eingabe: 3 Kästchen + automatischer
// Bindestrich + 6 Kästchen (Format XXX-XXXXXX). Der Bindestrich ist fest
// gerendert (kein eigenes Feld), die Eingabe springt automatisch weiter.
//
// Das Alphabet entspricht `generateLicenseKey()` in sheets.ts: keine
// mehrdeutigen Zeichen (I, O, 0, 1). Eingaben werden in Großbuchstaben
// gewandelt und ungültige Zeichen verworfen.

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function sanitizeChar(c: string): string {
  const up = (c || "").toUpperCase();
  return KEY_ALPHABET.includes(up) ? up : "";
}

function sanitizeKey(raw: string, max: number): string {
  return (raw || "")
    .toUpperCase()
    .split("")
    .filter((c) => KEY_ALPHABET.includes(c))
    .join("")
    .slice(0, max);
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  prefixLen?: number;
  bodyLen?: number;
  autoFocus?: boolean;
}

export default function LicenseKeyInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  prefixLen = 3,
  bodyLen = 6,
  autoFocus = false,
}: Props) {
  const total = prefixLen + bodyLen;
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Aktuellen Wert in Einzelzeichen zerlegen (Bindestrich entfernen) und
  // auf die volle Kästchen-Anzahl auffüllen.
  const flat = sanitizeKey(value.replace(/-/g, ""), total);
  const cells: string[] = Array.from({ length: total }, (_, i) => flat[i] || "");

  function emit(next: string[]) {
    const joined = next.join("");
    const prefix = joined.slice(0, prefixLen);
    const body = joined.slice(prefixLen);
    // Bindestrich automatisch einsetzen, sobald der zweite Block beginnt
    // (bzw. sobald der erste Block voll ist), damit die ausgegebene Form
    // immer XXX-XXXXXX ist.
    const combined =
      joined.length > prefixLen || joined.length === prefixLen
        ? body
          ? `${prefix}-${body}`
          : prefix.length === prefixLen
            ? `${prefix}-`
            : prefix
        : prefix;
    onChange(combined);
    if (joined.length === total) onComplete?.(combined);
  }

  function focusCell(i: number) {
    const idx = Math.max(0, Math.min(total - 1, i));
    const el = refs.current[idx];
    el?.focus();
    el?.select();
  }

  function handleChange(i: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (raw === "") {
      const next = [...cells];
      next[i] = "";
      emit(next);
      return;
    }
    // Letztes getipptes Zeichen nehmen (deckt auch das Überschreiben eines
    // bereits gefüllten Kästchens ab).
    const ch = sanitizeChar(raw.slice(-1));
    if (!ch) return; // ungültiges Zeichen ignorieren, Kästchen unverändert
    const next = [...cells];
    next[i] = ch;
    emit(next);
    focusCell(i + 1);
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...cells];
      if (next[i]) {
        next[i] = "";
        emit(next);
      } else if (i > 0) {
        next[i - 1] = "";
        emit(next);
        focusCell(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusCell(i + 1);
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = sanitizeKey(e.clipboardData.getData("text"), total);
    if (!pasted) return;
    const next = [...cells];
    // Mehrere Zeichen = wahrscheinlich der ganze Key → ab vorne füllen.
    let pos = pasted.length > 1 ? 0 : i;
    for (const ch of pasted) {
      if (pos >= total) break;
      next[pos] = ch;
      pos += 1;
    }
    emit(next);
    focusCell(pos);
  }

  function renderCell(i: number) {
    return (
      <input
        key={i}
        ref={(el) => {
          refs.current[i] = el;
        }}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        maxLength={1}
        value={cells[i]}
        disabled={disabled}
        autoFocus={autoFocus && i === 0}
        aria-label={`Zeichen ${i + 1}`}
        onChange={(e) => handleChange(i, e)}
        onKeyDown={(e) => handleKeyDown(i, e)}
        onPaste={(e) => handlePaste(i, e)}
        onFocus={(e) => e.target.select()}
        className="w-7 h-10 sm:w-9 sm:h-12 rounded-lg bg-white/[0.04] border border-white/12 text-center text-base sm:text-lg font-semibold uppercase tracking-wider text-white outline-none transition focus:border-[#95BF47] focus:bg-[#95BF47]/5 focus:ring-2 focus:ring-[#95BF47]/30 disabled:opacity-50"
      />
    );
  }

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-1.5">
      {Array.from({ length: prefixLen }, (_, i) => renderCell(i))}
      <span
        aria-hidden="true"
        className="px-0.5 sm:px-1 text-lg sm:text-xl font-bold text-white/30 select-none"
      >
        –
      </span>
      {Array.from({ length: bodyLen }, (_, i) => renderCell(prefixLen + i))}
    </div>
  );
}
