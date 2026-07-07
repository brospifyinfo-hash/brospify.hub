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
import { DEFAULT_BENEFIT_ICONS } from "@/lib/theme-icons";
import { fontStack, googleFontsUrlFor } from "@/lib/theme-fonts";
import { getIconAny } from "@/lib/theme-icon-resolver";

/** Baustein-Typen, die die Runtime im Shop rendern kann. `free_gift` und
 *  `complementary` brauchen Shop-Daten (Geschenk-Produkte/Empfehlungen),
 *  die der Hub nicht hat — sie bleiben der statischen Welt vorbehalten. */
export const DYNAMIC_SUPPORTED = new Set([
  "sale_banner", "urgency_text", "custom_title", "custom_rating", "benefits_list",
  "stock_indicator", "variant_picker", "quantity_selector", "custom_price",
  "bundle_selector", "buy_buttons", "payment_icons", "delivery_timeline",
  "feature_box", "icon-with-text", "description", "custom_divider", "text",
  "custom_accordion", "collapsible_tab", "share",
  // NEU (nur Runtime): rein designbasiert, keine Shop-Daten nötig.
  "trust_badges", "stock_bar", "guarantee", "highlights", "social_proof",
  "countdown_timer", "press_bar", "spec_list",
  "value_stack", "review_quote", "ship_countdown", "return_promise",
  "fit_check", "mini_compare", "coupon_code", "price_per_day",
  "benefit_cards", "usp_grid", "avatar_proof",
  // free_gift = Angebots-Box (Text); complementary = Shopify-Empfehlungen
  // (Runtime holt /recommendations/products.json live im Shop).
  "free_gift", "complementary",
]);

export interface BuyboxPlanBlock {
  type: string;
  /** Aufgelöste Icon-SVG-Pfade (z. B. icon-with-text) — Runtime rendert sie
   *  direkt, statt hartkodierte Icons zu zeigen. */
  icons?: string[][];
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
    gap: number;
  };
  fonts: { heading: string; body: string; url: string };
  blocks: BuyboxPlanBlock[];
  /** Aufgelöste Vorteile (SVG-Pfade + Emoji + Text) für benefits_list. */
  benefits: { paths: string[]; emoji: string; text: string }[];
}

// Google-Fonts-URL nur für die zwei benötigten Familien (Storefront-Perf).
// Gewichts-Sonderfälle (Display-Fonts ohne 600/800) löst die zentrale
// Font-Bibliothek (theme-fonts.ts) über per-Font-Parameter.
function googleFontsUrl(headingHandle: string, bodyHandle: string): string {
  return googleFontsUrlFor([headingHandle, bodyHandle]);
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
    case "free_gift":
      return {
        title: values.GIFT_TITLE || "Gratis-Geschenk sichern",
        subtitle: values.GIFT_SUBTITLE || "Bei jeder Bestellung — solange der Vorrat reicht.",
      };
    case "complementary":
      return { block_heading: "Passt perfekt dazu" };
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

    const block: BuyboxPlanBlock = { type, s, t };
    // icon-with-text: Icon-Settings (Legacy-Select-Werte) serverseitig zu
    // SVG-Pfaden auflösen — die Runtime zeigte hier früher immer dieselben
    // 3 hartkodierten Icons, egal was eingestellt war.
    if (type === "icon-with-text") {
      const legacy: Record<string, string> = { return: "rotate", package: "box", lightning: "bolt" };
      const fallbacks = ["truck", "rotate", "lock"];
      block.icons = [1, 2, 3].map((n) => {
        const raw = s[`icon_${n}`];
        const v = typeof raw === "string" && raw ? raw : fallbacks[n - 1];
        return getIconAny(legacy[v] || v).paths;
      });
    }
    blocks.push(block);
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
    const icon = getIconAny(bb.benefitIcons?.[i] || DEFAULT_BENEFIT_ICONS[i] || "check");
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
      gap: Math.max(4, Math.min(40, typeof bb.spacing === "number" ? bb.spacing : 15)),
    },
    fonts: {
      heading: fontStack(g.headingFont),
      body: fontStack(g.bodyFont),
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
