// ─── Buybox-Render-Plan (Live-Sync der dynamischen Buy Box) ─────────
// Löst den buybox-Teil eines ThemeDocument VOLLSTÄNDIG auf (Presets,
// Palette-Refs, Feld-Defaults, KI-Texte, Icon-SVGs) und erzeugt einen
// flachen, stabilen Plan. Der wird unter dem Sync-Code gespeichert und
// vom Kunden-Shop abgerufen — die Storefront-Runtime (public/bspx-runtime.js)
// rendert ihn 1:1, ohne die Bibliothek zu kennen. Produktdaten (Varianten,
// Preise, Titel) kommen NICHT aus dem Plan, sondern lokal aus dem Shop
// ({{ product | json }} im Liquid-Block).
// Client-safe (wird server- und clientseitig gebaut).

import type { ThemeDocument } from "@/lib/theme-doc";
import { getPlaceholderValues, type ThemeCopy } from "@/lib/theme-placeholders";
import {
  getBuyboxLib,
  resolveBlockSettings,
  effectiveBuyboxPresetId,
  getBuyboxPreset,
} from "@/lib/theme-library";
import { getIcon, DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";
import { FONT_FAMILY } from "@/components/theme-editor/editor-ui";

/** Baustein-Typen, die die Runtime im Shop rendern kann. `free_gift` und
 *  `complementary` brauchen Shop-Daten (Geschenk-Produkte/Empfehlungen),
 *  die der Hub nicht hat — sie bleiben der statischen Welt vorbehalten. */
export const DYNAMIC_SUPPORTED = new Set([
  "sale_banner", "urgency_text", "custom_title", "custom_rating", "benefits_list",
  "stock_indicator", "variant_picker", "quantity_selector", "custom_price",
  "bundle_selector", "buy_buttons", "payment_icons", "delivery_timeline",
  "feature_box", "icon-with-text", "description", "custom_divider", "text",
  "custom_accordion", "collapsible_tab", "share",
]);

export interface BuyboxPlanBlock {
  type: string;
  /** Aufgelöste Preset-Settings (Palette-Refs bereits ersetzt). */
  s: Record<string, string | number | boolean>;
  /** Aufgelöste Texte (Feld-Defaults ⊕ KI-Texte ⊕ Nutzer-Eingaben). */
  t: Record<string, string>;
}

export interface BuyboxPlan {
  v: 1;
  productId: string;
  vars: {
    bg: string; text: string; btn: string; btnText: string; accent: string;
    radius: number; shadow: 0 | 1 | 2; border: 1 | 2; iconStyle: string;
  };
  fonts: { heading: string; body: string; url: string };
  blocks: BuyboxPlanBlock[];
  /** Aufgelöste Vorteile (SVG-Pfade + Emoji + Text) für benefits_list. */
  benefits: { paths: string[]; emoji: string; text: string }[];
}

// Google-Fonts-URL nur für die zwei benötigten Familien (Storefront-Perf).
function googleFontsUrl(headingHandle: string, bodyHandle: string): string {
  const fam = (h: string) => (FONT_FAMILY[h] || "'Work Sans'").replace(/'/g, "");
  const families = Array.from(new Set([fam(headingHandle), fam(bodyHandle)]));
  const parts = families.map((f) =>
    f === "Bebas Neue" || f === "Acme"
      ? `family=${f.replace(/ /g, "+")}`
      : `family=${f.replace(/ /g, "+")}:wght@400;600;800`,
  );
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

/** KI-Texte je Baustein-Typ als Text-Defaults einspeisen (gleiche Quellen
 *  wie die Editor-Vorschau → Vorschau = Shop). */
function aiTextSeed(type: string, values: ThemeCopy): Record<string, string> {
  switch (type) {
    case "benefits_list":
      return {
        text_1: values.PRODUCT_USP_1 || "Kostenloser Blitzversand",
        text_2: values.PRODUCT_USP_2 || "30 Tage Rückgaberecht",
        text_3: values.PRODUCT_USP_3 || "100% Sichere Bezahlung",
        text_4: values.PRODUCT_USP_4 || "Premium-Qualität",
      };
    case "stock_indicator":
      return { text: values.PRODUCT_STOCK_TEXT || "Auf Lager – Sofort verfügbar" };
    case "bundle_selector":
      return { heading: values.BUNDLE_HEADING || "Zeitlich begrenztes Angebot" };
    case "buy_buttons":
      return { add_to_cart_text: "In den Warenkorb" };
    case "custom_rating":
      return { rating_text: values.PRODUCT_RATING_TEXT || "361 Bewertungen" };
    case "custom_accordion":
      return {
        heading: values.ACCORDION_1_HEADING || "Häufige Fragen",
        content: values.ACCORDION_1_CONTENT || "",
      };
    default:
      return {};
  }
}

export function buildBuyboxPlan(doc: ThemeDocument, themeCopy: ThemeCopy | undefined): BuyboxPlan {
  const g = doc.global;
  const bb = doc.buybox;
  const values = getPlaceholderValues(themeCopy || {});
  const blockCfgs = bb.blocks || {};

  const hidden = new Set(bb.hidden || []);
  const blocks: BuyboxPlanBlock[] = [];
  for (const type of bb.order || []) {
    if (hidden.has(type) || !DYNAMIC_SUPPORTED.has(type)) continue;
    const cfg = blockCfgs[type];
    const lib = getBuyboxLib(type);

    // Settings: Basis-Preset (auch design-abgeleitet) + Palette aufgelöst.
    const s = resolveBlockSettings(type, cfg, g.colors, g.design);
    // Preset-ID mitschreiben (Runtime nutzt sie für Layout-Varianten).
    const presetId = effectiveBuyboxPresetId(type, cfg, g.design) || getBuyboxPreset(type, undefined)?.id || "";
    if (presetId) s.__preset = presetId;

    // Texte: Feld-Defaults → KI-Texte → Nutzer-Eingaben.
    const t: Record<string, string> = {};
    for (const f of lib?.fields || []) t[f.id] = f.def;
    Object.assign(t, aiTextSeed(type, values));
    for (const [k, v] of Object.entries(cfg?.texts || {})) {
      if (typeof v === "string" && v.trim()) t[k] = v;
    }

    blocks.push({ type, s, t });
  }

  // Vorteile: gewählte Icons (SVG-Pfade für die Runtime) + Texte.
  const benefitTexts = [
    values.PRODUCT_USP_1 || "Kostenloser Blitzversand",
    values.PRODUCT_USP_2 || "30 Tage Rückgaberecht",
    values.PRODUCT_USP_3 || "100% Sichere Bezahlung",
    values.PRODUCT_USP_4 || "Premium-Qualität",
  ];
  const benefitsCfg = blockCfgs["benefits_list"]?.texts || {};
  const benefits = [0, 1, 2, 3].map((i) => {
    const icon = getIcon(bb.benefitIcons?.[i] || DEFAULT_BENEFIT_ICONS[i] || "check");
    const userText = benefitsCfg[`text_${i + 1}`];
    return {
      paths: icon.paths,
      emoji: icon.emoji,
      text: typeof userText === "string" && userText.trim() ? userText : benefitTexts[i],
    };
  });

  return {
    v: 1,
    productId: doc.productId,
    vars: {
      bg: g.colors.background,
      text: g.colors.text,
      btn: g.colors.button,
      btnText: g.colors.buttonText,
      accent: g.colors.accent,
      radius: Math.max(0, Math.min(40, g.radius)),
      shadow: g.design.shadow,
      border: g.design.border,
      iconStyle: g.design.iconStyle,
    },
    fonts: {
      heading: (FONT_FAMILY[g.headingFont] || "'Work Sans'") + ", sans-serif",
      body: (FONT_FAMILY[g.bodyFont] || "'Work Sans'") + ", sans-serif",
      url: googleFontsUrl(g.headingFont, g.bodyFont),
    },
    blocks,
    benefits,
  };
}

/** Unerratbarer Sync-Code (öffentlich abrufbar, daher lang + zufällig). */
export function generateSyncCode(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 24; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `bspx_${s}`;
}
