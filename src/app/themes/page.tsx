"use client";

// ─── /themes — Shopify-Theme-Download für Kunden ─────────────────
// Listet die vom Admin hochgeladenen Theme-ZIPs (neueste zuerst). Ein
// Klick lädt die Blob-Datei. Ein ausklappbares "Hilfe"-Panel erklärt
// Schritt für Schritt den Import in Shopify.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutTemplate,
  Download,
  Sparkles,
  HelpCircle,
  ChevronDown,
  Package,
  CheckCircle2,
  Monitor,
  Smartphone,
  Shuffle,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n, type Locale } from "@/lib/i18n";
import ThemePreview, { type PreviewData } from "@/components/ThemePreview";
import { THEME_STYLES, getThemeStyle, DEFAULT_STYLE_ID, radiusForStyle, DEFAULT_DESIGN, type StyleDesign } from "@/lib/theme-styles";
import { PRODUCT_SECTIONS, BUYBOX_BLOCKS, BUYBOX_DEFAULT_ORDER } from "@/lib/theme-sections";
import { ChevronUp, Eye, EyeOff } from "lucide-react";

const ACCENT = "#95BF47";

interface Theme {
  id: string;
  name: string;
  version: string;
  url: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

function formatBytes(n: number): string {
  if (!n || n <= 0) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function formatDate(iso: string, lang: Locale = "de"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

export default function ThemesPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [themes, setThemes] = useState<Theme[] | null>(null);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/themes", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || t.themes.errLoad);
          setThemes([]);
          return;
        }
        setThemes(Array.isArray(data.themes) ? data.themes : []);
      } catch {
        if (!cancelled) {
          setError(t.themes.errConnection);
          setThemes([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4 sm:py-7 lg:py-9">
          {/* Header */}
          <header className="mb-5 sm:mb-7 text-center">
            <div
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
              style={{ color: ACCENT }}
            >
              <LayoutTemplate className="w-3 h-3" />
              Shopify Theme
            </div>
            <h1 className="text-[24px] sm:text-[32px] font-bold tracking-tight text-white leading-tight font-sf-display">
              {t.themes.title}
            </h1>
            <p className="mt-2 text-[12.5px] sm:text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              {t.themes.subtitle}
            </p>
          </header>

          {/* Hilfe-Dropdown */}
          <HelpPanel open={helpOpen} onToggle={() => setHelpOpen((v) => !v)} />

          {/* Fertiges Produkt-Theme bauen */}
          <div className="mt-5">
            <ThemeBuilderCard />
          </div>

          {/* Theme-Liste */}
          <div className="mt-5">
            {themes === null ? (
              <LoadingCard />
            ) : themes.length === 0 ? (
              <EmptyCard error={error} />
            ) : (
              <div className="space-y-3">
                {themes.map((th, i) => (
                  <ThemeCard key={th.id} theme={th} latest={i === 0} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

// ─── Theme-Karte ─────────────────────────────────────────────────

function ThemeCard({ theme, latest }: { theme: Theme; latest: boolean }) {
  const { t, lang } = useI18n();
  return (
    <div className="glass-strong rounded-2xl border border-white/[0.08] p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "var(--accent-light)", border: `1px solid ${ACCENT}33` }}
      >
        <LayoutTemplate className="w-5 h-5" style={{ color: ACCENT }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[14px] sm:text-[15px] font-semibold text-white truncate">{theme.name}</h3>
          {latest && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#95BF47]/15 text-[#cfe9a3] border border-[#95BF47]/25">
              {t.themes.latest}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
          {theme.version && <span className="font-mono">{theme.version}</span>}
          {theme.sizeBytes > 0 && <span>· {formatBytes(theme.sizeBytes)}</span>}
          {theme.createdAt && <span>· {formatDate(theme.createdAt, lang)}</span>}
        </div>
      </div>
      <a
        href={theme.url}
        download={theme.fileName || true}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-deploy flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-[12.5px] sm:text-[13px] shrink-0"
      >
        <Download className="w-4 h-4" />
        <span>Download</span>
      </a>
    </div>
  );
}

// ─── Hilfe-Panel (ausklappbar) ───────────────────────────────────

function HelpPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const STEPS = [
    { title: t.themes.s1t, body: t.themes.s1b },
    { title: t.themes.s2t, body: t.themes.s2b },
    { title: t.themes.s3t, body: t.themes.s3b },
    { title: t.themes.s4t, body: t.themes.s4b },
    { title: t.themes.s5t, body: t.themes.s5b },
  ];
  return (
    <div className="glass-strong rounded-2xl border border-white/[0.08] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-white/[0.02] transition"
      >
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
          <HelpCircle className="w-4 h-4" style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold text-white">{t.themes.helpTitle}</div>
          <div className="text-[11px] text-zinc-500">{t.themes.helpSub}</div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-white/[0.06] space-y-3">
              {STEPS.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                      style={{ background: "var(--accent-light)", color: ACCENT }}
                    >
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="w-px flex-1 bg-white/[0.08] mt-1" />}
                  </div>
                  <div className="pb-1">
                    <div className="text-[13px] font-semibold text-white">{s.title}</div>
                    <p className="mt-0.5 text-[12px] text-zinc-400 leading-snug">{s.body}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-2 rounded-xl bg-[#95BF47]/[0.06] border border-[#95BF47]/15 px-3 py-2.5 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: ACCENT }} />
                <p className="text-[11.5px] text-zinc-300 leading-snug">
                  {t.themes.tip}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Zustände ────────────────────────────────────────────────────

function LoadingCard() {
  const { t } = useI18n();
  return (
    <div className="glass-strong rounded-2xl border border-white/[0.08] p-8 text-center">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        className="inline-flex mb-3"
      >
        <Sparkles className="w-6 h-6" style={{ color: ACCENT }} />
      </motion.span>
      <p className="text-sm text-zinc-400">{t.themes.loading}</p>
    </div>
  );
}

function EmptyCard({ error }: { error?: string }) {
  const { t } = useI18n();
  return (
    <div className="glass-strong rounded-2xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
        <Package className="w-6 h-6 text-zinc-500" />
      </div>
      <h2 className="text-base font-semibold text-white">
        {error ? t.themes.emptyError : t.themes.emptyTitle}
      </h2>
      <p className="mt-2 text-[13px] text-zinc-400 max-w-sm mx-auto leading-snug">
        {error || t.themes.emptyDesc}
      </p>
    </div>
  );
}

// ─── Produkt-Theme-Builder ───────────────────────────────────────
// Kunde wählt ein gezogenes Produkt + Farbe + Schrift → lädt ein fertig
// befülltes Shopify-Theme (KI-Texte + Branding) über /api/theme-export.

const BUILDER_FONTS = [
  { value: "work_sans_n4", label: "Work Sans" },
  { value: "poppins_n4", label: "Poppins" },
  { value: "montserrat_n4", label: "Montserrat" },
  { value: "inter_n4", label: "Inter" },
  { value: "roboto_n4", label: "Roboto" },
  { value: "lato_n4", label: "Lato" },
  { value: "nunito_n4", label: "Nunito" },
  { value: "raleway_n4", label: "Raleway" },
  { value: "dmsans_n4", label: "DM Sans" },
  { value: "assistant_n4", label: "Assistant" },
  { value: "oswald_n4", label: "Oswald" },
  { value: "bebas_neue_n4", label: "Bebas Neue" },
  { value: "playfair_n4", label: "Playfair Display" },
  { value: "merriweather_n4", label: "Merriweather" },
  { value: "acme_n4", label: "Acme" },
];

type ThemeColors = { button: string; buttonText: string; background: string; text: string; accent: string };

function randFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
/** Kräftiger, gut lesbarer Zufalls-Akzent (HSL → Hex). */
function randomAccent(): string {
  return hslToHex(Math.floor(Math.random() * 360), 62 + Math.floor(Math.random() * 20), 45 + Math.floor(Math.random() * 12));
}

function ThemeBuilderCard() {
  const { t, lang } = useI18n();
  const [products, setProducts] = useState<{ id: string; titel: string }[]>([]);
  const [productId, setProductId] = useState("");
  const DEF = getThemeStyle(DEFAULT_STYLE_ID);
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [colors, setColors] = useState<ThemeColors>(DEF.palette);
  const [font, setFont] = useState(DEF.bodyFont);
  const [headingFont, setHeadingFont] = useState(DEF.headingFont);
  const [radius, setRadius] = useState(radiusForStyle(DEF));
  const [cost, setCost] = useState<number | null>(null);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [hiddenSections, setHiddenSections] = useState<string[]>(DEF.hiddenSections ?? []);
  const [sectionHeadings, setSectionHeadings] = useState<Record<string, string>>({});
  const [buyboxOrder, setBuyboxOrder] = useState<string[]>(DEF.buyboxOrder ?? BUYBOX_DEFAULT_ORDER);
  const [hiddenBlocks, setHiddenBlocks] = useState<string[]>(DEF.hiddenBlocks ?? []);
  const [design, setDesign] = useState<StyleDesign>(DEF.design ?? DEFAULT_DESIGN);
  const blockLabel = (type: string) => BUYBOX_BLOCKS.find((b) => b.type === type)?.label || type;
  const segCls = (on: boolean) =>
    `rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
      on ? "border-[#95BF47]/60 bg-[#95BF47]/10 text-white" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
    }`;

  const COLOR_FIELDS: { key: keyof ThemeColors; label: string }[] = [
    { key: "button", label: t.themes.builderColorButton },
    { key: "buttonText", label: t.themes.builderColorButtonText },
    { key: "background", label: t.themes.builderColorBackground },
    { key: "text", label: t.themes.builderColorText },
    { key: "accent", label: t.themes.builderColorAccent },
  ];

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/charts/draw?lang=${lang}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = Array.isArray(d.drawn)
          ? (d.drawn as { id: string; titel: string }[]).map((p) => ({ id: p.id, titel: p.titel }))
          : [];
        setProducts(list);
        if (list[0]) setProductId((prev) => prev || list[0].id);
      })
      .catch(() => {});
    fetch("/api/credit-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const c = d?.costs?.THEME_EXPORT;
        setCost(Number.isFinite(c) ? c : 100);
      })
      .catch(() => setCost(100));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Vorschau-DATEN (Titel/Preis/Bilder/Texte) laden — NUR bei Produktwechsel.
  // Farben, Schriften, Ecken & Stil wirken rein clientseitig über CSS-Variablen
  // in der Nachbildung → sofortige Vorschau ohne Server-Runde.
  useEffect(() => {
    if (!productId) {
      setPreviewData(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/theme-export/preview?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d.title === "string") setPreviewData(d as PreviewData);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  function setColor(key: keyof ThemeColors, value: string) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  // Stil wählen → setzt Palette + Schriften auf die Style-Defaults (danach
  // einzeln anpassbar). `styleId` steuert zusätzlich Section-Sichtbarkeit +
  // globale Settings serverseitig.
  function pickStyle(id: string) {
    const s = getThemeStyle(id);
    setStyleId(id);
    setColors(s.palette);
    setFont(s.bodyFont);
    setHeadingFont(s.headingFont);
    setRadius(radiusForStyle(s));
    // Jeder Stil bringt eine eigene Anordnung, Sichtbarkeit & Design-Ausprägung.
    setBuyboxOrder(s.buyboxOrder ?? BUYBOX_DEFAULT_ORDER);
    setHiddenBlocks(s.hiddenBlocks ?? []);
    setHiddenSections(s.hiddenSections ?? []);
    setDesign(s.design ?? DEFAULT_DESIGN);
  }

  // Zufallsgenerator: zufälliger Stil als Basis + frisch gewürfelter Akzent,
  // Schriften und Ecken → große Varianz, bleibt aber stimmig/lesbar.
  function randomize() {
    const s = randFrom(THEME_STYLES);
    setStyleId(s.id);
    setColors({ ...s.palette, accent: randomAccent() });
    setHeadingFont(randFrom(BUILDER_FONTS).value);
    setFont(randFrom(BUILDER_FONTS).value);
    setRadius(randFrom([0, 4, 8, 14, 22, 30]));
    setBuyboxOrder(s.buyboxOrder ?? BUYBOX_DEFAULT_ORDER);
    setHiddenBlocks(s.hiddenBlocks ?? []);
    setHiddenSections(s.hiddenSections ?? []);
    setDesign({
      shadow: randFrom([0, 1, 2]) as StyleDesign["shadow"],
      border: randFrom([1, 2]) as StyleDesign["border"],
      iconStyle: randFrom(["dark", "accent", "outline"]) as StyleDesign["iconStyle"],
    });
  }

  function toggleSection(type: string) {
    setHiddenSections((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }
  function setSectionHeading(type: string, value: string) {
    setSectionHeadings((prev) => ({ ...prev, [type]: value }));
  }
  function toggleBlock(type: string) {
    setHiddenBlocks((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }
  function moveBlock(type: string, dir: -1 | 1) {
    setBuyboxOrder((prev) => {
      const i = prev.indexOf(type);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleDownload() {
    if (!productId || building) return;
    setBuilding(true);
    setMsg(null);
    try {
      const res = await fetch("/api/theme-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ productId, colors, font, headingFont, style: styleId, radius, hiddenSections, sectionHeadings, buyboxOrder, hiddenBlocks, design }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const text =
          res.status === 409
            ? t.themes.builderNoCopy
            : res.status === 402
              ? data?.error || t.themes.builderNotEnough
              : data?.error || t.themes.builderErr;
        setMsg({ kind: "err", text });
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const cd = res.headers.get("Content-Disposition") || "";
      const fileMatch = cd.match(/filename="(.+?)"/);
      a.download = fileMatch ? fileMatch[1] : "theme.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setMsg({ kind: "ok", text: t.themes.builderDone });
    } catch {
      setMsg({ kind: "err", text: t.themes.builderErr });
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="glass-strong rounded-2xl border border-[#95BF47]/20 p-4 sm:p-5" style={{ background: "var(--accent-light)" }}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-[14px] sm:text-[15px] font-semibold text-white">{t.themes.builderTitle}</h3>
      </div>
      <p className="text-[12px] text-zinc-400 leading-snug mb-4">{t.themes.builderSub}</p>

      {products.length === 0 ? (
        <p className="text-[12.5px] text-zinc-400">{t.themes.builderNoProducts}</p>
      ) : (
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-6 lg:items-start">
          {/* ── Einstellungen (Desktop: links · Handy: unter der Vorschau) ── */}
          <div className="order-2 lg:order-1">
            {/* 1. Produktauswahl ZUERST */}
            <label className="block">
              <span className="block text-[11px] text-zinc-500 mb-1">{t.themes.builderProduct}</span>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#95BF47]/40"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.titel}
                  </option>
                ))}
              </select>
            </label>

            {/* 2. Stil + Zufallsgenerator */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06] mb-2">
              <span className="text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400">{t.themes.builderStyle}</span>
              <button
                onClick={randomize}
                title={t.themes.builderRandomHint}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#cfe9a3] hover:text-white transition rounded-md border border-[#95BF47]/30 bg-[#95BF47]/10 px-2 py-1"
              >
                <Shuffle className="w-3 h-3" /> {t.themes.builderRandom}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStyle(s.id)}
                  className={`text-left rounded-lg border px-3 py-2 transition ${
                    styleId === s.id
                      ? "border-[#95BF47]/60 bg-[#95BF47]/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                  }`}
                >
                  <span className="block text-[12.5px] font-semibold text-white">{s.label}</span>
                  <span className="block text-[10px] text-zinc-500 leading-tight">{s.hint}</span>
                </button>
              ))}
            </div>

            {/* 3. Schriften */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="block text-[11px] text-zinc-500 mb-1">{t.themes.builderFontHeading}</span>
                <select
                  value={headingFont}
                  onChange={(e) => setHeadingFont(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-[#95BF47]/40"
                >
                  {BUILDER_FONTS.map((f) => (
                    <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[11px] text-zinc-500 mb-1">{t.themes.builderFontBody}</span>
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-sm text-white outline-none focus:border-[#95BF47]/40"
                >
                  {BUILDER_FONTS.map((f) => (
                    <option key={f.value} value={f.value} className="bg-zinc-900">{f.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 4. Ecken (feiner Slider) */}
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06] mb-2">
              <span className="text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400">{t.themes.builderCorners}</span>
              <span className="text-[11px] font-mono text-zinc-400">{radius}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-[#95BF47] cursor-pointer"
            />

            {/* Design: Schatten / Randstärke / Icon-Stil */}
            <span className="block text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mt-5 pt-4 border-t border-white/[0.06] mb-2">{t.themes.builderDesign}</span>
            <div className="space-y-2.5">
              <div>
                <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderShadow}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([[0, "Aus"], [1, "Weich"], [2, "Stark"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setDesign((d) => ({ ...d, shadow: v }))} className={segCls(design.shadow === v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderBorder}</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {([[1, "Dünn"], [2, "Dick"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setDesign((d) => ({ ...d, border: v }))} className={segCls(design.border === v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-[10px] text-zinc-500 mb-1">{t.themes.builderIcons}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {([["dark", "Dunkel"], ["accent", "Akzent"], ["outline", "Umriss"]] as const).map(([v, l]) => (
                    <button key={v} onClick={() => setDesign((d) => ({ ...d, iconStyle: v }))} className={segCls(design.iconStyle === v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <span className="block text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mt-5 pt-4 border-t border-white/[0.06] mb-2">{t.themes.builderColors}</span>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <span className="block text-[10px] text-zinc-500 mb-1">{f.label}</span>
                  <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/10 rounded-lg px-1.5 py-1">
                    <input
                      type="color"
                      value={colors[f.key]}
                      onChange={(e) => setColor(f.key, e.target.value)}
                      className="w-7 h-7 rounded bg-transparent border-0 p-0 cursor-pointer shrink-0"
                    />
                    <input
                      type="text"
                      value={colors[f.key]}
                      onChange={(e) => setColor(f.key, e.target.value)}
                      className="w-full min-w-0 bg-transparent text-[11px] text-white outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* 6. Kaufbox-Bausteine: umsortieren + ein-/ausblenden */}
            <span className="block text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mt-5 pt-4 border-t border-white/[0.06] mb-2">{t.themes.builderBlocks}</span>
            <div className="space-y-1.5">
              {buyboxOrder.map((type, i) => {
                const visible = !hiddenBlocks.includes(type);
                return (
                  <div
                    key={type}
                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${
                      visible ? "border-white/10 bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.01] opacity-55"
                    }`}
                  >
                    <div className="flex flex-col -my-0.5">
                      <button onClick={() => moveBlock(type, -1)} disabled={i === 0} aria-label="hoch" className="text-zinc-500 hover:text-white disabled:opacity-20 leading-none">
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moveBlock(type, 1)} disabled={i === buyboxOrder.length - 1} aria-label="runter" className="text-zinc-500 hover:text-white disabled:opacity-20 leading-none">
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-[12px] font-medium text-white flex-1 min-w-0 truncate">{blockLabel(type)}</span>
                    <button onClick={() => toggleBlock(type)} aria-label={blockLabel(type)} className="text-zinc-400 hover:text-white shrink-0">
                      {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 7. Sektionen ein-/ausblenden + Überschrift bearbeiten */}
            <span className="block text-[10px] uppercase tracking-[0.13em] font-semibold text-zinc-400 mt-5 pt-4 border-t border-white/[0.06] mb-2">{t.themes.builderSections}</span>
            <div className="space-y-2">
              {PRODUCT_SECTIONS.map((s) => {
                const visible = !hiddenSections.includes(s.type);
                return (
                  <div key={s.type} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-white">{s.label}</span>
                      <button
                        onClick={() => toggleSection(s.type)}
                        role="switch"
                        aria-checked={visible}
                        aria-label={s.label}
                        className={`relative w-9 h-5 rounded-full transition shrink-0 ${visible ? "bg-[#95BF47]" : "bg-white/15"}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${visible ? "translate-x-4" : ""}`} />
                      </button>
                    </div>
                    {visible && (
                      <input
                        value={sectionHeadings[s.type] ?? ""}
                        onChange={(e) => setSectionHeading(s.type, e.target.value)}
                        placeholder={s.defaultHeading}
                        className="mt-2 w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-[11.5px] text-white placeholder:text-zinc-600 outline-none focus:border-[#95BF47]/40"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={building || !productId}
                className="btn-deploy flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] disabled:opacity-50"
              >
                {building ? <Sparkles className="w-4 h-4 animate-pulse" /> : <Download className="w-4 h-4" />}
                <span>{building ? t.themes.builderBuilding : t.themes.builderDownload}</span>
              </button>
              {cost !== null && cost > 0 && (
                <span className="text-[11.5px] text-zinc-400">{t.themes.builderCost.replace("{n}", String(cost))}</span>
              )}
            </div>

            {msg && (
              <p className={`mt-2 text-[12px] ${msg.kind === "ok" ? "text-[#cfe9a3]" : "text-amber-300/90"}`}>
                {msg.text}
              </p>
            )}
          </div>

          {/* ── Live-Vorschau (Desktop: rechts sticky · Handy: oben sticky) ── */}
          <div className="order-1 lg:order-2 mb-4 lg:mb-0 sticky top-2 lg:top-4 self-start z-10">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-[12px] font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                {t.themes.builderPreview}
              </span>
              {/* PC / Handy-Umschalter */}
              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                <button
                  onClick={() => setViewMode("desktop")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${viewMode === "desktop" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  <Monitor className="w-3.5 h-3.5" /> {t.themes.builderViewDesktop}
                </button>
                <button
                  onClick={() => setViewMode("mobile")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${viewMode === "mobile" ? "bg-white/12 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> {t.themes.builderViewMobile}
                </button>
              </div>
            </div>
            <ThemePreview
              data={previewData}
              colors={colors}
              headingFont={headingFont}
              bodyFont={font}
              radius={radius}
              loading={previewLoading}
              label={t.themes.builderPageProduct}
              viewMode={viewMode}
              hiddenSections={hiddenSections}
              sectionHeadings={sectionHeadings}
              buyboxOrder={buyboxOrder}
              hiddenBlocks={hiddenBlocks}
              shadow={design.shadow}
              border={design.border}
              iconStyle={design.iconStyle}
            />
          </div>
        </div>
      )}
    </div>
  );
}
