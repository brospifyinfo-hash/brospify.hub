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
  // ── Nischen-Icons: die AI wählt daraus produkt-passende Symbole ──
  { id: "droplet", label: "Feuchtigkeit", emoji: "💧", paths: ["M12 3c3.5 4 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-6 6-10z"] },
  { id: "sun", label: "Strahlend", emoji: "☀️", paths: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3", "M4.9 4.9l2.1 2.1", "M17 17l2.1 2.1", "M19.1 4.9 17 7", "M7 17l-2.1 2.1"] },
  { id: "moon", label: "Schlaf", emoji: "🌙", paths: ["M20 14A8.5 8.5 0 0 1 10 4a8 8 0 1 0 10 10z"] },
  { id: "smile", label: "Wohlfühlen", emoji: "😊", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9 10h.01", "M15 10h.01", "M8.5 14a4.5 4.5 0 0 0 7 0"] },
  { id: "sprout", label: "Pflanzlich", emoji: "🌱", paths: ["M12 21v-8", "M12 13c0-4-3-6-7-6 0 4 3 6 7 6z", "M12 13c0-4 3-6 7-6 0 4-3 6-7 6z"] },
  { id: "pulse", label: "Vitalität", emoji: "💓", paths: ["M3 12h4l2-5 4 10 2-5h6"] },
  { id: "medic", label: "Gesundheit", emoji: "🩺", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 8v8", "M8 12h8"] },
  { id: "home", label: "Zuhause", emoji: "🏠", paths: ["M4 11l8-7 8 7", "M6 10v10h12V10", "M10 20v-6h4v6"] },
  { id: "utensils", label: "Küche", emoji: "🍴", paths: ["M6 3v6a2 2 0 0 0 4 0V3", "M8 3v18", "M17 3c-1.5 1.5-2 4-2 6s.5 3 2 3v9", "M17 3v18"] },
  { id: "coffee", label: "Genuss", emoji: "☕", paths: ["M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z", "M16 10h2a2.5 2.5 0 0 1 0 5h-2"] },
  { id: "bed", label: "Erholung", emoji: "🛏️", paths: ["M3 18v-8h18v8", "M3 18v2", "M21 18v2", "M5 10V7h6v3", "M3 14h18"] },
  { id: "plug", label: "Strom", emoji: "🔌", paths: ["M9 3v5", "M15 3v5", "M7 8h10v3a5 5 0 0 1-10 0z", "M12 16v5"] },
  { id: "battery", label: "Ausdauer", emoji: "🔋", paths: ["M3 8h15v8H3z", "M21 11v2", "M6 10.5v3", "M9 10.5v3", "M12 10.5v3"] },
  { id: "wifi", label: "Kabellos", emoji: "📶", paths: ["M2 9a14 14 0 0 1 20 0", "M5.5 12.5a9 9 0 0 1 13 0", "M9 16a4.5 4.5 0 0 1 6 0", "M12 19.5h.01"] },
  { id: "chip", label: "Smart", emoji: "🤖", paths: ["M8 8h8v8H8z", "M9 3v3", "M15 3v3", "M9 18v3", "M15 18v3", "M3 9h3", "M3 15h3", "M18 9h3", "M18 15h3"] },
  { id: "phone", label: "App", emoji: "📱", paths: ["M7 3h10v18H7z", "M11 18h2"] },
  { id: "camera", label: "Foto", emoji: "📷", paths: ["M4 7h4l2-2h4l2 2h4v11H4z", "M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"] },
  { id: "headphones", label: "Sound", emoji: "🎧", paths: ["M4 18v-5a8 8 0 0 1 16 0v5", "M4 14h3v6H4z", "M17 14h3v6h-3z"] },
  { id: "paw", label: "Haustier", emoji: "🐾", paths: ["M12 12c2.5 0 5 2 5 4.5 0 1.5-1 2.5-2.5 2.5-1 0-1.7-.5-2.5-.5s-1.5.5-2.5.5C8 19 7 18 7 16.5 7 14 9.5 12 12 12z", "M8.2 10a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z", "M15.8 10a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z", "M4.8 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M19.2 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"] },
  { id: "mountain", label: "Outdoor", emoji: "⛰️", paths: ["M3 19h18", "M4 19l6-11 4 7", "M13 15l3-5 5 9"] },
  { id: "compass", label: "Abenteuer", emoji: "🧭", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M15.5 8.5l-2 5-5 2 2-5z"] },
  { id: "tree", label: "Natur", emoji: "🌲", paths: ["M12 3l5 6h-3l4 5h-4l3 4H7l3-4H6l4-5H7z", "M12 18v3"] },
  { id: "shirt", label: "Passform", emoji: "👕", paths: ["M8 4l4 2 4-2 4 4-3 2v11H7V10L4 8z"] },
  { id: "diamond", label: "Edel", emoji: "💎", paths: ["M7 4h10l4 5-9 12L3 9z", "M3 9h18", "M9.5 9 12 21", "M14.5 9 12 21"] },
  { id: "custom", label: "Anpassbar", emoji: "🎛️", paths: ["M3 7h18", "M3 12h18", "M3 17h18", "M8 5.5v3", "M16 10.5v3", "M10 15.5v3"] },
  { id: "feather", label: "Federleicht", emoji: "🪶", paths: ["M20 4c-7-1-13 5-13 12v4", "M20 4c1 7-5 13-12 13", "M7 15h6"] },
  { id: "target", label: "Präzise", emoji: "🎯", paths: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"] },
  { id: "trophy", label: "Testsieger", emoji: "🏆", paths: ["M8 4h8v6a4 4 0 0 1-8 0z", "M8 5H5a3 3 0 0 0 3 5", "M16 5h3a3 3 0 0 1-3 5", "M12 14v3", "M9 20h6", "M12 17v3"] },
  { id: "wind", label: "Atmungsaktiv", emoji: "💨", paths: ["M3 8h9a2.5 2.5 0 1 0-2.5-2.5", "M3 12h13a3 3 0 1 1-3 3", "M3 16h6"] },
  { id: "baby", label: "Baby", emoji: "🍼", paths: ["M10 3h4", "M11 3v3", "M13 3v3", "M9 6h6v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z", "M9 10h6"] },
  { id: "percent", label: "Ersparnis", emoji: "🏷️", paths: ["M19 5 5 19", "M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z", "M16.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"] },
  { id: "calendar", label: "Routine", emoji: "📅", paths: ["M4 6h16v15H4z", "M4 10h16", "M8 3v5", "M16 3v5"] },
];

export const DEFAULT_BENEFIT_ICONS = ["truck", "rotate", "shield", "star"];

const ICON_MAP: Record<string, ThemeIcon> = Object.fromEntries(THEME_ICONS.map((i) => [i.id, i]));
export function getIcon(id: string): ThemeIcon {
  return ICON_MAP[id] || THEME_ICONS[0];
}
