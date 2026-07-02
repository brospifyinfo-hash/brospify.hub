// ─── Icon-Bibliothek (geteilt: Builder, Vorschau, Download) ──────────
// SVG-Line-Icons für die Vorteile-Liste (und weitere Bausteine). Jedes Icon
// hat eine Emoji-Entsprechung, damit die Auswahl auch ins heruntergeladene
// Theme (benefits_list nutzt Emoji) übernommen werden kann → Vorschau ≈ Theme.

export interface ThemeIcon {
  id: string;
  label: string;
  emoji: string;
  paths: string[];
}

export const THEME_ICONS: ThemeIcon[] = [
  { id: "truck", label: "Versand", emoji: "🚚", paths: ["M2 5h11v9H2z", "M13 8h4l3 3v3h-3", "M6.5 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M17.5 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"] },
  { id: "rotate", label: "Rückgabe", emoji: "↩️", paths: ["M12 21a9 9 0 1 0-9-9", "M3 12l3-3", "M3 12l3 3"] },
  { id: "shield", label: "Sicherheit", emoji: "🛡️", paths: ["M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z", "M9 12l2 2 4-4"] },
  { id: "star", label: "Qualität", emoji: "⭐", paths: ["M12 3l2.5 5.5 6 .5-4.5 4 1.4 5.9L12 16.9 6.1 18.9 7.5 13 3 9l6-.5z"] },
  { id: "lock", label: "Verschlüsselt", emoji: "🔒", paths: ["M5 11h14v9H5z", "M8 11V8a4 4 0 0 1 8 0v3", "M12 15v2"] },
  { id: "card", label: "Bezahlung", emoji: "💳", paths: ["M3 6h18v12H3z", "M3 10h18"] },
  { id: "gift", label: "Geschenk", emoji: "🎁", paths: ["M4 12h16v8H4z", "M3 8h18v4H3z", "M12 8v12", "M12 8C10 8 8 6.5 9 5.2s3 2.8 3 2.8", "M12 8c2 0 4-1.5 3-2.8s-3 2.8-3 2.8"] },
  { id: "heart", label: "Beliebt", emoji: "❤️", paths: ["M12 20l-7.4-7.4a4.2 4.2 0 0 1 6-6L12 7l1.4-1.4a4.2 4.2 0 0 1 6 6z"] },
  { id: "leaf", label: "Natürlich", emoji: "🌿", paths: ["M4 20c0-8 6-14 16-14 0 10-6 14-14 14", "M5 19c3-6 7-8 10-9"] },
  { id: "clock", label: "Schnell", emoji: "⏱️", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"] },
  { id: "check", label: "Geprüft", emoji: "✅", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M8 12l3 3 5-5"] },
  { id: "bolt", label: "Kraftvoll", emoji: "⚡", paths: ["M13 3 5 13h6l-1 8 8-11h-6z"] },
  { id: "box", label: "Verpackung", emoji: "📦", paths: ["M12 3l8 4.5v9L12 21l-8-4.5v-9z", "M4 7.5l8 4.5 8-4.5", "M12 12v9"] },
  { id: "medal", label: "Prämiert", emoji: "🏅", paths: ["M9 3l3 5 3-5", "M12 21a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 15.5v1.5"] },
  { id: "thumb", label: "Empfohlen", emoji: "👍", paths: ["M7 10v10H3V10z", "M7 10l4-7a2 2 0 0 1 3 2l-1 4h5a2 2 0 0 1 2 2.3l-1.4 6A2 2 0 0 1 16.6 20H7"] },
  { id: "sparkle", label: "Premium", emoji: "✨", paths: ["M12 3l1.5 5L19 9.5 13.5 11 12 16.5 10.5 11 5 9.5 10.5 8z"] },
  { id: "globe", label: "Weltweit", emoji: "🌍", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M3 12h18", "M12 3c3 3.5 3 14.5 0 18", "M12 3c-3 3.5-3 14.5 0 18"] },
  { id: "fire", label: "Angesagt", emoji: "🔥", paths: ["M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 2 1 3 3 3"] },
];

export const DEFAULT_BENEFIT_ICONS = ["truck", "rotate", "shield", "star"];

const ICON_MAP: Record<string, ThemeIcon> = Object.fromEntries(THEME_ICONS.map((i) => [i.id, i]));
export function getIcon(id: string): ThemeIcon {
  return ICON_MAP[id] || THEME_ICONS[0];
}
