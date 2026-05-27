"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  X,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Info,
  BarChart3,
  Zap,
  ShoppingBag,
  Target,
  PieChart,
  DollarSign,
  Link2,
  ArrowRight,
  Store,
  Music2,
  Camera,
  Users,
  PlayCircle,
  Megaphone,
  Calendar,
  TrendingDown,
  Flame,
  Layers,
  Crosshair,
  Eye,
  Wallet,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Award,
  Filter,
  // Category icons
  Dumbbell,
  Sparkle,
  Home,
  UtensilsCrossed,
  Cpu,
  Dog,
  Baby,
  Car,
  Leaf,
  Shirt,
  Moon,
  Lightbulb,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Navigation from "@/components/Navigation";

// ─── Types ───────────────────────────────────────────────────────

interface ProduktStats {
  trendScore: number;
  viralScore: number;
  impulseBuyFactor: number;
  problemSolverIndex: number;
  marketSaturation: number;
}

interface ProduktFinances {
  buyPrice: number;
  recommendedSellPrice: number;
  profitMargin: number;
}

interface ProduktAds {
  tiktok?: string[];
  instagram?: string[];
  facebook?: string[];
  youtube?: string[];
}

interface ProduktLinks {
  aliExpressProduct?: string;
  aliExpressCategory?: string;
  dropshippingExample?: { url: string; title?: string };
  dropshippingExamples?: { url: string; title?: string }[];
}

interface ProduktLinkStatus {
  aliExpressProductOk?: boolean;
  aliExpressCategoryOk?: boolean;
  dropshippingExampleOk?: boolean;
  lastCheckedAt?: string;
}

interface ProduktDeepStats {
  competition?: number;
  seasonality?: number;
  peakMonths?: number[];
  growth90d?: number;
  repeatPurchaseRate?: number;
}

interface ProduktAudience {
  primary?: string;
  ageRange?: string;
  genderSkew?: "male" | "female" | "balanced";
  interests?: string[];
  painPoint?: string;
}

interface ProduktAdStrategy {
  dailyMinEur?: number;
  dailyRecommendedEur?: number;
  estimatedCpmEur?: number;
  bestFormat?: string;
  adHooks?: string[];
  testDurationDays?: number;
}

interface ProduktVotes {
  ups?: number;
  downs?: number;
  manualBoost?: number;
}

interface Produkt {
  id: string;
  sku: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
  extra: {
    stats?: ProduktStats;
    finances?: ProduktFinances;
    images?: string[];
    links?: ProduktLinks;
    ads?: ProduktAds;
    linkStatus?: ProduktLinkStatus;
    deepStats?: ProduktDeepStats;
    audience?: ProduktAudience;
    adStrategy?: ProduktAdStrategy;
    votes?: ProduktVotes;
  };
}

/** Marge in Prozent (Aufschlag auf den Einkaufspreis).
 *  Beispiel: Einkauf 5€, Verkauf 25€ → (25-5)/5*100 = 400%.
 *  Ranking-Maßstab: 100% bedeutet doppelter Preis, 300% = 4-fach. */
function marginPercent(p: Produkt): number {
  const f = p.extra?.finances;
  if (!f) return 0;
  const buy = f.buyPrice ?? 0;
  const margin = f.profitMargin ?? 0;
  if (buy <= 0) return 0;
  return Math.round((margin / buy) * 100);
}

/** REAL Score nur aus echten Stimmen + Admin-Override. */
function rawVoteScore(v?: ProduktVotes): number {
  if (!v) return 0;
  return (v.ups ?? 0) - (v.downs ?? 0) + (v.manualBoost ?? 0);
}

/**
 * Deterministischer Seed-Wert pro Produkt — wird ZUM tatsaechlichen
 * Score addiert, damit kein Produkt jemals bei 0 startet. Ableitung
 * aus den vorhandenen Metriken:
 *  - trendScore (50%) + viralScore (40%) → Basis
 *  - growth90d → Bonus wenn positiv
 *  - Hash der id → 0-19 fuer Variation, damit nicht alle Produkte
 *    mit gleichen Stats exakt denselben Seed haben
 * Stets ≥ 5, nie negativ. Da deterministisch: bleibt fuer dasselbe
 * Produkt immer gleich.
 */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seedScore(p: Produkt): number {
  // ALLE verfuegbaren Stats fliessen in die Quality-Berechnung ein —
  // sonst landen Produkte mit aehnlichen Trend-/Viral-Werten alle
  // in der gleichen Range.
  const trend = Math.max(0, Math.min(100, p.extra?.stats?.trendScore ?? 50));
  const viral = Math.max(0, Math.min(100, p.extra?.stats?.viralScore ?? 50));
  const impulse = Math.max(0, Math.min(100, p.extra?.stats?.impulseBuyFactor ?? 50));
  const problem = Math.max(0, Math.min(100, p.extra?.stats?.problemSolverIndex ?? 50));
  const compInv = Math.max(0, Math.min(100, 100 - (p.extra?.deepStats?.competition ?? 50)));
  const growth = Math.max(0, Math.min(100, Math.max(0, p.extra?.deepStats?.growth90d ?? 0) / 2));
  const quality =
    (trend * 0.25 + viral * 0.2 + impulse * 0.15 + problem * 0.1 + compInv * 0.15 + growth * 0.15) / 100;

  // ID-Hash treibt die PRIMAERE Streuung — 0..310 random.
  const h = simpleHash(p.id);
  const hashSpread = h % 311;

  // Quality biased nur ±50 (also Top-Produkt bekommt im Schnitt +50,
  // schwaches -50). Hashspread bleibt dominant -> echte Variation.
  const qualityBoost = Math.round((quality - 0.5) * 100);

  // Zusaetzliches kleines Rauschen aus zweitem Hash-Slice (±15).
  const noise = ((h >> 8) % 31) - 15;

  return Math.max(20, Math.min(350, 20 + hashSpread + qualityBoost + noise));
}

/** Endgueltiger Score wie er dem User gezeigt wird = echt + Seed. */
function displayedScore(p: Produkt, v?: ProduktVotes): number {
  return rawVoteScore(v) + seedScore(p);
}

// Veraltete API behalten — wird intern fuer Admin-Editor benutzt.
function voteScore(v?: ProduktVotes): number {
  return rawVoteScore(v);
}

// Sortier-Keys für die UI-Toolbar.
type SortKey = "trend" | "viral" | "margin" | "growth" | "lowCompetition" | "popular";

const MONTH_LABEL_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

// ─── Vorgefertigte Themen-Kategorien ────────────────────────────
// Werden als zusaetzliche Rows UNTER den Trend-Rows gerendert.
// Matching: case-insensitive Substring der `sku` ODER `titel`/`beschreibung`
// gegen `keywords`. Eine Row wird nur gerendert wenn sie min. 1 Produkt
// hat. Erstes passendes Keyword gewinnt — Doppelzuordnungen sind ok
// (ein Produkt darf in mehreren Rows auftauchen, z.B. "Yoga-Matte"
// in Sport + Wellness).
const PREDEFINED_CATEGORIES: {
  key: string;
  label: string;
  icon: typeof Flame;
  tint: string;
  keywords: string[];
}[] = [
  {
    key: "sport",
    label: "Sport & Fitness",
    icon: Dumbbell,
    tint: "#F97316",
    keywords: ["sport", "fitness", "gym", "yoga", "training", "laufen", "workout", "muskel", "ausdauer"],
  },
  {
    key: "beauty",
    label: "Beauty & Pflege",
    icon: Sparkle,
    tint: "#EC4899",
    keywords: ["beauty", "pflege", "kosmetik", "skincare", "haut", "haar", "make-up", "makeup", "nail", "lippen"],
  },
  {
    key: "haushalt",
    label: "Haushalt & Ordnung",
    icon: Home,
    tint: "#3B82F6",
    keywords: ["haushalt", "putzen", "putz", "ordnung", "organize", "household", "reinigung", "staub", "wäsche"],
  },
  {
    key: "kueche",
    label: "Küche & Kochen",
    icon: UtensilsCrossed,
    tint: "#A855F7",
    keywords: ["küche", "kueche", "kochen", "kitchen", "food", "essen", "backen", "trinken", "schneiden"],
  },
  {
    key: "gadgets",
    label: "Gadgets & Tech",
    icon: Cpu,
    tint: "#06B6D4",
    keywords: ["gadget", "tech", "elektronik", "smart", "wireless", "bluetooth", "led", "usb", "akku", "ladegerät"],
  },
  {
    key: "haustier",
    label: "Haustier",
    icon: Dog,
    tint: "#F59E0B",
    keywords: ["haustier", "hund", "katze", "pet", "tier", "futter", "spielzeug für", "halsband"],
  },
  {
    key: "kinder",
    label: "Kinder & Baby",
    icon: Baby,
    tint: "#FB7185",
    keywords: ["kinder", "baby", "kids", "spielzeug", "lern", "kindersicher", "schnuller"],
  },
  {
    key: "auto",
    label: "Auto & Outdoor",
    icon: Car,
    tint: "#10B981",
    keywords: ["auto", "car", "outdoor", "camping", "fahrrad", "kfz", "reise", "wandern", "halter"],
  },
  {
    key: "garten",
    label: "Garten & Pflanzen",
    icon: Leaf,
    tint: "#22C55E",
    keywords: ["garten", "garden", "pflanze", "blumen", "rasen", "kräuter", "balkon", "samen"],
  },
  {
    key: "mode",
    label: "Mode & Accessoires",
    icon: Shirt,
    tint: "#8B5CF6",
    keywords: ["mode", "fashion", "schmuck", "accessoir", "armband", "kette", "tasche", "geldbörse", "uhr", "brille"],
  },
  {
    key: "wellness",
    label: "Wellness & Schlaf",
    icon: Moon,
    tint: "#6366F1",
    keywords: ["wellness", "schlaf", "sleep", "entspannung", "massage", "meditation", "stress", "aromatherapie"],
  },
  {
    key: "deko",
    label: "Heim-Deko & Licht",
    icon: Lightbulb,
    tint: "#FBBF24",
    keywords: ["deko", "decor", "home", "lampe", "licht", "kerze", "bild", "wand", "vase", "innendekoration"],
  },
];

/**
 * Prueft ob ein Produkt zu einer Kategorie passt — STRICT MODE:
 * NUR das sku-Feld wird gescannt (nicht titel/beschreibung), und
 * das Match ist ein Whole-Word-Match. So landet eine "Automatische
 * Fingernagelschere" mit sku="Beauty" nicht versehentlich unter
 * Kinder, nur weil das Wort "Kinder" irgendwo im Beipack-Text steht.
 */
function produktMatchesCategory(
  p: Produkt,
  keywords: string[],
): boolean {
  const sku = (p.sku || "").toLowerCase().trim();
  if (!sku) return false;
  // Whole-Word-Match: keyword muss umgeben sein von Wort-Grenzen
  // (Anfang/Ende, Whitespace, oder Punctuation).
  return keywords.some((kRaw) => {
    const k = kRaw.toLowerCase();
    if (sku === k) return true;
    // Regex mit Wortgrenzen — \b funktioniert auch fuer
    // unicode-Strings wenn die Keyword Letters ASCII sind.
    const re = new RegExp(`(^|[^a-zäöüß])${escapeRegex(k)}([^a-zäöüß]|$)`, "i");
    return re.test(sku);
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Defensive helpers ──────────────────────────────────────────
// Daten in der Sheet sind nicht immer komplett (alte Importe, aborted
// AI-Discovery, manuelle Bulk-JSONs). Diese Helper sorgen dafür, dass
// die User-Ansicht NIE leer/kaputt aussieht.

/** True wenn der Titel verdächtig nach einem Auto-ID aussieht. */
function looksLikeAutoId(s: string): boolean {
  return /^prod_\d+(_[a-z0-9]+)?$/i.test((s || "").trim());
}

/** Liefert einen anzeigbaren Titel — niemals leer, niemals nur die ID. */
function displayTitle(p: Produkt): string {
  const t = (p.titel || "").trim();
  if (!t || looksLikeAutoId(t)) return "Produkt-Details werden ergänzt…";
  return t;
}

/** Baut eine AliExpress-Kategorie-Such-URL aus dem besten verfügbaren Begriff. */
function synthesizeAliCategoryLink(p: Produkt): string {
  const q = (p.sku || p.titel || "").trim();
  if (!q || looksLikeAutoId(q)) return "";
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`;
}

// ─── Social-media meta (icons, labels, brand colors) ─────────────
// Reihenfolge bestimmt die Anzeigereihenfolge im Modal. Wir nutzen
// generische Lucide-Icons (Brand-Icons sind in dieser lucide-Version
// nicht enthalten); das Label macht die Plattform eindeutig.
const AD_PLATFORMS: {
  key: keyof ProduktAds;
  label: string;
  icon: typeof Music2;
  color: string;
}[] = [
  { key: "tiktok", label: "TikTok", icon: Music2, color: "text-pink-300" },
  { key: "instagram", label: "Instagram", icon: Camera, color: "text-rose-300" },
  { key: "facebook", label: "Facebook", icon: Users, color: "text-blue-300" },
  { key: "youtube", label: "YouTube", icon: PlayCircle, color: "text-red-300" },
];

// Uniform styling — no aggressive top-3 highlighting

// ─── Stat Bar Component ──────────────────────────────────────────

function StatBar({ label, value, icon: Icon, color, delay }: {
  label: string; value: number; icon: typeof Zap; color: string; delay: number;
}) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-zinc-400">
          <Icon className={`w-4 h-4 ${color}`} />
          {label}
        </span>
        <span className="font-bold text-white">{value}%</span>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            value >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
            value >= 50 ? "bg-gradient-to-r from-amber-500 to-amber-400" :
            "bg-gradient-to-r from-red-500 to-red-400"
          }`}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${value}%` : 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// ─── Image Slideshow ─────────────────────────────────────────────
// Bilder werden client-seitig gefiltert: schlägt ein <img> beim
// Laden fehl (CORS, Hotlinking, 404), wird die URL aus der Liste
// genommen und die Slideshow rückt nach. So sieht der Nutzer nie
// einen leeren Slot, auch wenn die Discover-Pipeline mal ein paar
// CDN-URLs erwischt, die der Browser nicht laden darf.

function ImageSlideshow({ images: initial }: { images: string[] }) {
  // Achtung: dieses Component muss vom Caller per `key` neu gemountet
  // werden, wenn sich das Produkt ändert (sonst bleibt der lokale
  // `broken`-Set/idx erhalten). useEffect-Reset würde den Lint-Hook
  // "set-state-in-effect" triggern.
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [idx, setIdx] = useState(0);

  const images = useMemo(
    () => initial.filter((u) => !broken.has(u)),
    [initial, broken],
  );

  if (images.length === 0)
    return (
      <div className="aspect-video bg-white/5 rounded-xl flex flex-col items-center justify-center text-zinc-600 gap-1.5">
        <ShoppingBag className="w-6 h-6" />
        <span className="text-xs">Kein Bild verfügbar</span>
      </div>
    );

  function onError(failedUrl: string) {
    setBroken((prev) => {
      if (prev.has(failedUrl)) return prev;
      const next = new Set(prev);
      next.add(failedUrl);
      return next;
    });
    // Index gleich klemmen — wenn das letzte Bild stirbt, soll der
    // Pointer nicht ins Leere zeigen.
    setIdx((cur) => {
      const remaining = initial.filter(
        (u) => u !== failedUrl && !broken.has(u),
      ).length;
      return remaining === 0 ? 0 : Math.min(cur, remaining - 1);
    });
  }

  const current = images[idx];

  return (
    <div className="relative aspect-video bg-white/5 rounded-xl overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.img
          key={`${idx}:${current}`}
          src={current}
          alt={`Slide ${idx + 1}`}
          className="w-full h-full object-contain"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.3 }}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => onError(current)}
        />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((u, i) => (
              <button key={u} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full ${i === idx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Try-host an image, skip on error ──────────────────────────
// Same pattern als die Slideshow, nur für das kleine Thumbnail in
// der Liste — wenn das Hauptbild blockt, zeigen wir einen Platzhalter.
function Thumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div className="w-full h-full flex items-center justify-center text-zinc-600">
        <ShoppingBag className="w-3.5 h-3.5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="w-full h-full object-cover"
    />
  );
}

// ─── Copy Field ──────────────────────────────────────────────────

function CopyField({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xs text-zinc-200 font-mono truncate">{text}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
        className="shrink-0 flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg text-xs">
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
      </button>
    </div>
  );
}

// ─── Ads Block (social-media icons + per-platform URLs) ─────────
// Zeigt NUR Icons der Plattformen, für die wirklich Ads gefunden
// wurden. Pro Plattform listen wir die Beispiel-URLs direkt drunter
// als kleine Chips — bewusst keine Video-Embeds, damit Insta/TikTok-
// Hotlinks-Sperren das Modal nicht aufblähen.

function AdsBlock({ ads }: { ads?: ProduktAds }) {
  const present = AD_PLATFORMS.filter(
    (p) => Array.isArray(ads?.[p.key]) && (ads![p.key] as string[]).length > 0,
  );
  if (present.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-purple-300" />
        Beispiel-Ads
      </h4>
      <div className="space-y-2.5">
        {present.map((p) => {
          const Icon = p.icon;
          const urls = (ads?.[p.key] || []) as string[];
          return (
            <div
              key={p.key}
              className="bg-white/[0.03] border border-white/10 rounded-xl p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${p.color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-200">
                  {p.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {urls.map((u, i) => (
                  <a
                    key={u}
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-300 hover:bg-white/10 hover:text-white transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ad {i + 1}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Dropshipping shop examples (multiple) ──────────────────────
function DropshippingBlock({
  examples,
  legacy,
  status,
}: {
  examples?: { url: string; title?: string }[];
  legacy?: { url: string; title?: string };
  status?: boolean;
}) {
  // Merge: array bevorzugt, sonst Legacy-Singular einklappen.
  const list = (examples && examples.length > 0)
    ? examples
    : (legacy?.url ? [legacy] : []);
  if (list.length === 0) return null;
  const broken = status === false;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Store className="w-4 h-4 text-indigo-300" />
        Beispiel Dropshipping-Shops
      </h4>
      <div className="space-y-1.5">
        {list.map((ex) => {
          let host = ex.url;
          try { host = new URL(ex.url).hostname.replace(/^www\./, ""); } catch {}
          return (
            <a
              key={ex.url}
              href={ex.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 hover:bg-indigo-500/15 transition text-sm min-w-0"
            >
              <Store className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="truncate font-medium">{ex.title || host}</div>
                <div className="truncate text-[10px] text-indigo-300/70 font-mono">{host}</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          );
        })}
      </div>
      {broken && <BrokenLinkHint />}
    </div>
  );
}

// ─── AliExpress link block (category + product) ─────────────────
function AliLinksBlock({
  produktLink,
  kategorieLink,
  productOk,
  categoryOk,
}: {
  produktLink?: string;
  kategorieLink?: string;
  productOk?: boolean;
  categoryOk?: boolean;
}) {
  if (!produktLink && !kategorieLink) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Link2 className="w-4 h-4 text-orange-300" />
        AliExpress Supplier
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {kategorieLink && (
          <div className="space-y-1">
            <a
              href={kategorieLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/5 border border-orange-500/20 text-orange-200 hover:bg-orange-500/10 transition text-sm"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">Kategorie suchen</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            {categoryOk === false && <BrokenLinkHint />}
          </div>
        )}
        {produktLink && (
          <div className="space-y-1">
            <a
              href={produktLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/25 text-orange-200 hover:bg-orange-500/15 transition text-sm"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">Genaues Produkt</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            {productOk === false && <BrokenLinkHint />}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deep-Stats-Panel (Wettbewerb / Saison / Wachstum) ──────────
function DeepStatsBlock({ ds }: { ds?: ProduktDeepStats }) {
  if (!ds) return null;
  const has =
    typeof ds.competition === "number" ||
    typeof ds.seasonality === "number" ||
    typeof ds.growth90d === "number" ||
    typeof ds.repeatPurchaseRate === "number" ||
    (Array.isArray(ds.peakMonths) && ds.peakMonths.length > 0);
  if (!has) return null;

  const peakSet = new Set(ds.peakMonths || []);
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-4">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Activity className="w-4 h-4 text-purple-300" />
        Markt & Saison
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {typeof ds.competition === "number" && (
          <MiniMeter
            label="Konkurrenz"
            value={ds.competition}
            // invert: niedrig = grün, hoch = rot
            invert
            icon={Crosshair}
          />
        )}
        {typeof ds.seasonality === "number" && (
          <MiniMeter label="Saison" value={ds.seasonality} icon={Calendar} />
        )}
        {typeof ds.repeatPurchaseRate === "number" && (
          <MiniMeter
            label="Rückkauf"
            value={ds.repeatPurchaseRate}
            icon={Award}
          />
        )}
        {typeof ds.growth90d === "number" && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
                Wachstum 90T
              </span>
              {ds.growth90d >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-400" />
              )}
            </div>
            <div
              className={`text-base font-bold tabular-nums ${
                ds.growth90d >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {ds.growth90d > 0 ? "+" : ""}
              {ds.growth90d}%
            </div>
          </div>
        )}
      </div>
      {Array.isArray(ds.peakMonths) && ds.peakMonths.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">
            Peak-Monate
          </div>
          <div className="grid grid-cols-12 gap-0.5">
            {MONTH_LABEL_DE.map((m, i) => {
              const isPeak = peakSet.has(i + 1);
              return (
                <div
                  key={m}
                  className={`text-center text-[9px] py-1 rounded ${
                    isPeak
                      ? "bg-purple-500/25 text-purple-100 font-semibold"
                      : "bg-white/[0.02] text-zinc-600"
                  }`}
                  title={isPeak ? `${m} — Peak` : m}
                >
                  {m}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniMeter({
  label,
  value,
  icon: Icon,
  invert,
}: {
  label: string;
  value: number;
  icon: typeof Crosshair;
  invert?: boolean;
}) {
  // tint je nach Wert (0-100). bei `invert` ist niedrig = grün.
  const v = Math.max(0, Math.min(100, value));
  const score = invert ? 100 - v : v;
  const color =
    score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div
      className="rounded-lg border p-2"
      style={{ borderColor: `${color}25`, background: `${color}08` }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
          {label}
        </span>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {v}%
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
        <div
          className="h-full rounded-full"
          style={{ width: `${v}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Audience-Panel ─────────────────────────────────────────────
function AudienceBlock({ a }: { a?: ProduktAudience }) {
  if (!a) return null;
  const has =
    a.primary || a.ageRange || a.painPoint || (a.interests && a.interests.length > 0);
  if (!has) return null;

  const genderLabel =
    a.genderSkew === "male" ? "Männlich" : a.genderSkew === "female" ? "Weiblich" : "Ausgeglichen";

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-300" />
        Zielgruppe & Targeting
      </h4>
      {a.primary && (
        <div className="text-sm text-zinc-200 font-medium">{a.primary}</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {a.ageRange && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">
              Alter
            </div>
            <div className="text-sm font-bold text-zinc-100">{a.ageRange}</div>
          </div>
        )}
        {a.genderSkew && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">
              Geschlecht
            </div>
            <div className="text-sm font-bold text-zinc-100">{genderLabel}</div>
          </div>
        )}
      </div>
      {a.painPoint && (
        <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2 text-xs text-zinc-300 leading-relaxed">
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">
            Pain-Point
          </div>
          {a.painPoint}
        </div>
      )}
      {Array.isArray(a.interests) && a.interests.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
            Targeting-Interessen
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.interests.map((i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-200"
              >
                <Hash className="w-2.5 h-2.5" />
                {i}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ad-Strategy-Panel ──────────────────────────────────────────
function AdStrategyBlock({ s }: { s?: ProduktAdStrategy }) {
  if (!s) return null;
  const has =
    s.dailyMinEur ||
    s.dailyRecommendedEur ||
    s.estimatedCpmEur ||
    s.bestFormat ||
    (s.adHooks && s.adHooks.length > 0);
  if (!has) return null;

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-amber-300" />
        Ad-Strategie
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <BudgetTile
          label="Min/Tag"
          value={`${s.dailyMinEur || 0}€`}
          sub="Validierung"
          color="#94A3B8"
        />
        <BudgetTile
          label="Empfohlen/Tag"
          value={`${s.dailyRecommendedEur || 0}€`}
          sub="Skalierung"
          color="#F59E0B"
        />
        <BudgetTile
          label="CPM"
          value={`${(s.estimatedCpmEur ?? 0).toFixed(2)}€`}
          sub="geschätzt"
          color="#A855F7"
        />
      </div>
      {s.bestFormat && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-100">
          <div className="text-[9px] uppercase tracking-widest text-amber-300/70 font-semibold mb-0.5">
            Bestes Format
          </div>
          {s.bestFormat}
        </div>
      )}
      {Array.isArray(s.adHooks) && s.adHooks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            Hook-Beispiele
          </div>
          {s.adHooks.map((h, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2"
            >
              <span className="shrink-0 text-[9px] font-bold text-amber-300 mt-0.5">
                #{i + 1}
              </span>
              <span className="text-xs text-zinc-200 leading-snug">{h}</span>
            </div>
          ))}
        </div>
      )}
      {typeof s.testDurationDays === "number" && s.testDurationDays > 0 && (
        <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
          <Eye className="w-3 h-3" />
          Empfohlene Testdauer: <strong className="text-zinc-300">{s.testDurationDays} Tage</strong>
        </div>
      )}
    </div>
  );
}

function BudgetTile({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border p-2 text-center"
      style={{ borderColor: `${color}25`, background: `${color}08` }}
    >
      <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">
        {label}
      </div>
      <div className="text-base font-bold tabular-nums mt-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-zinc-600">{sub}</div>
    </div>
  );
}

// ─── Stat-Tile (Overview-Strip oben auf der Seite) ──────────────
function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Flame;
  tint: string;
}) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: `${tint}25`, background: `${tint}08` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</span>
        <Icon className="w-3 h-3" style={{ color: tint }} />
      </div>
      <div className="text-base font-bold tabular-nums truncate" style={{ color: tint }}>{value}</div>
      {sub && <div className="text-[9px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Ein wiederverwendbarer Produktrow ───────────────────────────
// Wird sowohl in der gruppierten Sections-View als auch in der
// flachen List-View benutzt.
function ProduktRow({
  produkt,
  rank,
  votes,
  userVote,
  onVote,
  onInfo,
}: {
  produkt: Produkt;
  rank: number;
  votes: ProduktVotes;
  userVote: "up" | "down" | null;
  onVote: (id: string, direction: "up" | "down") => void;
  onInfo: (p: Produkt) => void;
}) {
  const price =
    produkt.extra?.finances?.recommendedSellPrice ||
    (produkt.preis && !Number.isNaN(Number(produkt.preis))
      ? Number(produkt.preis)
      : 0);
  const growth = produkt.extra?.deepStats?.growth90d;
  const competition = produkt.extra?.deepStats?.competition;
  return (
    <div className="flex items-center gap-2 border border-white/10 bg-white/[0.03] rounded-lg px-2 py-2 backdrop-blur-md hover:bg-white/[0.06] transition">
      <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-white/5">
        <span className="text-[11px] font-bold text-zinc-400 tabular-nums">{rank}</span>
      </div>
      <div className="w-10 h-10 rounded-md bg-white/5 overflow-hidden shrink-0">
        <Thumb src={produkt.bildUrl} />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-[12px] truncate text-zinc-200 leading-tight">
          {displayTitle(produkt)}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {price ? (
            <span className="text-sm font-bold text-[#95BF47] tabular-nums" title="Preis kann schwanken">
              {price}€<span className="text-[8px] text-zinc-500 ml-0.5">~</span>
            </span>
          ) : (
            <span className="text-[10px] text-zinc-500 italic">Preis folgt</span>
          )}
          {produkt.extra?.stats?.trendScore ? (
            <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">
              <Zap className="w-2.5 h-2.5" />
              {produkt.extra.stats.trendScore}%
            </span>
          ) : null}
          {typeof growth === "number" && growth !== 0 ? (
            <span
              className={`flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                growth > 0
                  ? "text-emerald-300 bg-emerald-500/10"
                  : "text-red-300 bg-red-500/10"
              }`}
              title="Wachstum (90 Tage)"
            >
              {growth > 0 ? (
                <ArrowUpRight className="w-2.5 h-2.5" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5" />
              )}
              {growth > 0 ? "+" : ""}
              {growth}%
            </span>
          ) : null}
          {typeof competition === "number" ? (
            <span
              className={`hidden sm:flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${
                competition < 40
                  ? "text-emerald-300 bg-emerald-500/10"
                  : competition < 70
                    ? "text-amber-300 bg-amber-500/10"
                    : "text-red-300 bg-red-500/10"
              }`}
              title="Marktkonkurrenz"
            >
              <Crosshair className="w-2.5 h-2.5" />
              {competition}
            </span>
          ) : null}
          {produkt.extra?.finances?.profitMargin ? (
            <span
              className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"
              title={`Marge: +${produkt.extra.finances.profitMargin.toFixed(2)}€ (${marginPercent(produkt)}%)`}
            >
              <DollarSign className="w-3 h-3" />
              +{marginPercent(produkt)}%
              <span className="opacity-60 text-[10px]">({produkt.extra.finances.profitMargin.toFixed(2)}€)</span>
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <VoteButtons
          produkt={produkt}
          votes={votes}
          userVote={userVote}
          onVote={(d) => onVote(produkt.id, d)}
          size="sm"
        />
        <button
          onClick={() => onInfo(produkt)}
          className="px-2.5 py-1.5 text-zinc-200 bg-white/5 border border-white/10 hover:bg-white/10 rounded-md flex items-center gap-1.5 text-xs font-medium transition"
        >
          <Info className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Details</span>
        </button>
      </div>
    </div>
  );
}

// ─── Vote-Buttons (Pfeil hoch / Pfeil runter + Score) ──────────
// Klassischer Reddit-Style: ein Pfeil hoch, ein Pfeil runter, in der
// Mitte der Score (ups - downs + manualBoost). Klick auf Pfeil setzt
// Stimme; nochmal derselbe Pfeil = Stimme zurueck; anderer Pfeil =
// Wechsel.
function VoteButtons({
  produkt,
  votes,
  userVote,
  onVote,
  size = "sm",
}: {
  produkt: Produkt;
  votes: ProduktVotes;
  userVote: "up" | "down" | null;
  onVote: (direction: "up" | "down") => void;
  size?: "sm" | "md";
}) {
  // Score inkl. Seed — so ist's nie 0 und reflektiert die Produkt-
  // Qualitaet auch fuer Produkte ohne echte User-Stimmen.
  const s = displayedScore(produkt, votes);
  const isCompact = size === "sm";
  const iconCls = isCompact ? "w-3.5 h-3.5" : "w-4 h-4";
  const padCls = isCompact ? "p-1" : "p-1.5";
  const scoreCls = isCompact ? "text-[11px] min-w-[28px]" : "text-sm min-w-[32px]";
  const upActive = userVote === "up";
  const downActive = userVote === "down";
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-white/[0.04] border border-white/10">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onVote("up"); }}
        title="Hochpushen"
        className={`${padCls} rounded-l-md transition ${
          upActive
            ? "text-emerald-300 bg-emerald-500/15"
            : "text-zinc-400 hover:text-emerald-300 hover:bg-white/5"
        }`}
      >
        <ArrowUpRight className={iconCls} />
      </button>
      <span
        className={`${scoreCls} text-center font-bold tabular-nums ${
          s > 0 ? "text-emerald-300" : s < 0 ? "text-red-300" : "text-zinc-400"
        }`}
      >
        {s > 0 ? `+${s}` : s}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onVote("down"); }}
        title="Runter pushen"
        className={`${padCls} rounded-r-md transition ${
          downActive
            ? "text-red-300 bg-red-500/15"
            : "text-zinc-400 hover:text-red-300 hover:bg-white/5"
        }`}
      >
        <ArrowDownRight className={iconCls} />
      </button>
    </div>
  );
}

// ─── Compliance / Rechts-Disclaimer pro Kategorie ───────────────
// User-Anforderung: bei jedem Produkt klar machen welche rechtlichen
// Vorgaben relevant sind (CE, Kosmetikverordnung, Spielzeugrichtlinie,
// LFGB, etc.). Plus ein generischer Block der IMMER greift.

interface ComplianceHint {
  severity: "low" | "medium" | "high";
  items: string[];
}

const GENERIC_COMPLIANCE: string[] = [
  "GPSR (EU-Produktsicherheitsverordnung 2023/988, gilt ab 13. Dezember 2024): Hersteller- und Lieferanten­angaben müssen auf Produkt/Verpackung stehen, Sicherheits­information in EU-Sprache, technische Dokumentation ist vorzuhalten.",
  "Als EU-Importeur (bei Dropshipping aus Nicht-EU-Ländern bist DU faktisch oft Importeur) haftest du für die Produktkonformität — auch wenn die Ware direkt vom Hersteller versendet wird.",
  "Verpackungsgesetz (VerpackG): Registrierung bei LUCID + Lizenzierung der Verpackung über ein duales System erforderlich, bevor du verkaufst.",
  "Rechtssichere Pflichtangaben im Shop: Impressum, Datenschutz, Widerrufsbelehrung, AGB, Versandkosten- und Lieferzeit-Angaben, Grundpreis bei messbaren Mengen.",
];

const COMPLIANCE_HINTS: Record<string, ComplianceHint> = {
  "Sport & Fitness": {
    severity: "medium",
    items: [
      "Bei elektrisch betriebenen Geräten (Massagepistole, Vibrationstrainer, beheizte Kleidung): CE-Kennzeichnung, EMV-Prüfung (EMVG), ggf. Funkanlagengesetz (FuAG), WEEE/ElektroG-Registrierung mit EAR-Nummer erforderlich.",
      "Sportgeräte mit Belastungs- oder Stützfunktion (Bandagen, Posture-Trainer): KEINE medizinischen Heilsaussagen ohne Medizinprodukte-Zulassung (MDR) machen.",
      "Bei Geräten mit Akku/Lithium-Batterien: zusätzlich Batteriegesetz (BattG) und CE-Bewertung der Batterie.",
      "Produkthaftpflicht-Versicherung empfohlen — Verletzungen am Sportgerät = Verkäuferhaftung.",
    ],
  },
  "Beauty & Pflege": {
    severity: "high",
    items: [
      "EG-Kosmetikverordnung 1223/2009: Vor Verkauf in der EU muss das Produkt im CPNP-Portal notifiziert sein, eine verantwortliche Person (Responsible Person) in der EU benannt sein, INCI-Liste auf Verpackung stehen.",
      "Mindesthaltbarkeitsdatum + PAO-Symbol (Period After Opening) Pflichtangabe.",
      "Die 26 deklarationspflichtigen Allergene müssen auf der Verpackung ausgewiesen sein.",
      "KEINE medizinischen oder krankheitsbezogenen Wirkversprechen (sonst wird das Produkt zum Arzneimittel/Medizinprodukt mit eigener Zulassungspflicht).",
      "Produkthaftung bei Hautreaktionen liegt beim Inverkehrbringer — Produkthaftpflicht-Versicherung dringend empfohlen.",
    ],
  },
  "Haushalt & Ordnung": {
    severity: "low",
    items: [
      "ProdSG (Produktsicherheitsgesetz): allgemeine Sicherheitsanforderungen gelten auch für Haushaltshelfer.",
      "Bei elektrischen Geräten (Akku-Sauger, Reinigungsroboter): CE-Kennzeichnung + EMV + EAR/WEEE-Registrierung.",
      "Bei Reinigungschemie oder Duftstoffen: Detergenzien-Verordnung, ggf. CLP-Kennzeichnung, Sicherheitsdatenblatt.",
    ],
  },
  "Küche & Kochen": {
    severity: "high",
    items: [
      "Lebensmittelkontakt-Materialien (Geschirr, Behälter, Backformen): müssen LFGB §31 / EU-Verordnung 1935/2004 entsprechen, Konformitätserklärung des Herstellers ist Pflicht.",
      "Bei Kunststoffen zusätzlich Verordnung 10/2011 (Plastik-Migration), Bisphenol-A-Verbot bei Babyflaschen.",
      "Elektrische Küchengeräte: CE, EMV, Niederspannungsrichtlinie, WEEE/ElektroG-Registrierung.",
      "Bei scharfen Gegenständen (Messer, Schäler): Kennzeichnung mit Warnhinweisen.",
    ],
  },
  "Gadgets & Tech": {
    severity: "high",
    items: [
      "CE-Kennzeichnung Pflicht — du als Inverkehrbringer brauchst die EU-Konformitätserklärung des Herstellers.",
      "Niederspannungsrichtlinie (LVD) + EMV-Richtlinie (EMVG) + ggf. Funkanlagengesetz (FuAG) bei Bluetooth/WLAN.",
      "ElektroG: vor Verkauf EAR-Registrierung mit WEEE-Nummer, sonst Vertriebsverbot + Bußgeld.",
      "Bei Akku-Geräten: Batteriegesetz (BattG) + Kennzeichnung + Rücknahme­pflicht.",
      "Verpackungsgesetz + ggf. RoHS-Konformität (Schadstoff-Beschränkung).",
      "GPSR: technische Dokumentation, Risikobewertung und 10 Jahre Aufbewahrung.",
    ],
  },
  Haustier: {
    severity: "medium",
    items: [
      "Bei Futter/Leckerli: Futtermittelrecht (Verordnung EG 767/2009), Einzelfuttermittel-Kennzeichnung, ggf. Registrierung beim zuständigen Veterinäramt.",
      "Bei Tierarzneimitteln, Floh-/Zeckenmitteln mit Wirkstoff: Zulassung als Tierarzneimittel oder Biozid erforderlich — KEINE Heilsaussagen ohne Zulassung.",
      "Spielzeug für Tiere unterliegt allgemeinen Sicherheitsanforderungen (ProdSG), bei Knabber-Artikeln Lebensmittelechtheit.",
      "Bei elektrischen Pet-Gadgets (Futterautomat, GPS-Halsband): CE + EMVG + WEEE.",
    ],
  },
  "Kinder & Baby": {
    severity: "high",
    items: [
      "Spielzeugrichtlinie 2009/48/EG + DIN EN 71: CE-Kennzeichnung, mechanische/chemische/elektrische Sicherheits­tests, Konformitätserklärung des Herstellers Pflicht.",
      "Altersfreigabe/Warnhinweise zwingend (z.B. 'Nicht für Kinder unter 3 Jahren').",
      "Bei Babyartikeln mit Mundkontakt (Beißring, Schnuller): zusätzlich Lebensmittelechtheit nach LFGB.",
      "Phthalate-Verbot bei Spielzeug für Kinder unter 3 Jahren (REACH Anhang XVII).",
      "Stiftung-Warentest-/Öko-Test-Kontrolle möglich — Produkthaftpflicht-Versicherung essenziell.",
    ],
  },
  "Auto & Outdoor": {
    severity: "high",
    items: [
      "KFZ-Anbauteile (Beleuchtung, Spiegel, Reifen, Sitze): müssen ECE-Prüfzeichen tragen, sonst Erlöschen der Betriebs­erlaubnis (StVZO §19).",
      "Bei elektrischen Komponenten zusätzlich EMV-Richtlinie 2014/30/EU + Automotive-EMC-Norm.",
      "Camping-/Outdoor-Geräte mit Gas (Kocher, Heizer): EN 484/521, Druckgeräterichtlinie (PED), CE-Pflicht.",
      "Fahrradzubehör (Lampen, Reflektoren): müssen StVZO §67 entsprechen + StVZO-Prüfzeichen tragen.",
    ],
  },
  "Garten & Pflanzen": {
    severity: "medium",
    items: [
      "Pflanzenschutzmittel: Zulassung durch BVL Pflicht — Vertrieb nur mit Zulassungsnummer, sonst Straftat.",
      "Biozid-Produkte (Insektensprays, Schneckenkorn): Biozid-Verordnung 528/2012, EU-Zulassung erforderlich.",
      "Bei elektrischen Garten­geräten (Akku-Rasenmäher, Heckenschere): CE + Maschinen­richtlinie 2006/42/EG + EMV + EAR/WEEE.",
      "Bei Saatgut/Setzlingen: Saatgutverkehrsgesetz, ggf. Pflanzengesund­heits-Zeugnis bei Import aus Nicht-EU.",
    ],
  },
  "Mode & Accessoires": {
    severity: "medium",
    items: [
      "Textilkennzeichnungsverordnung (EU 1007/2011): Faserzusammensetzung in EU-Amtssprache auf dauerhaft angebrachtem Etikett.",
      "Nickel-Verordnung (REACH Anhang XVII §27): Schmuck mit Hautkontakt darf max. 0,5 µg/cm²/Woche Nickel freisetzen.",
      "Schmuck/Accessoires mit Blei oder Cadmium: REACH-Grenzwerte einhalten (zwingend bei China-Ware!).",
      "Lederwaren: ggf. CITES-Bestimmungen bei exotischen Häuten, Chrom-VI-Grenzwert für Lederbekleidung (REACH).",
    ],
  },
  "Wellness & Schlaf": {
    severity: "high",
    items: [
      "ACHTUNG MEDIZINPRODUKTE: Geräte mit Wirkversprechen auf Gesundheit/Heilung (TENS, Massage mit medizinischer Aussage, EMS-Trainer) fallen unter die MDR (Verordnung 2017/745) — Konformitäts­bewertung + Notified Body, sonst Vertriebsverbot.",
      "Aromatherapie/Diffusoren: bei Heil­versprechen wird's ein Arzneimittel (AMG), sonst nur Wellness-Bewerbung erlaubt.",
      "Kosmetische Wellness-Produkte: gleiche Anforderungen wie Beauty (Kosmetikverordnung, CPNP).",
      "Bei elektrischen Geräten (Diffusor, Massage­matte): CE + EMV + WEEE-Registrierung.",
    ],
  },
  "Heim-Deko & Licht": {
    severity: "medium",
    items: [
      "Leuchten: CE-Kennzeichnung + Niederspannungs­richtlinie + EMV-Richtlinie + RoHS (Schadstoff­beschränkung) + Ökodesign-Verordnung für LED.",
      "Energielabel (EU 2019/2015): Pflicht für Beleuchtungs­mittel, muss vom Hersteller in der EPREL-Datenbank registriert sein.",
      "Bei Akku-Lampen: zusätzlich Batteriegesetz (BattG) + EAR/WEEE.",
      "Duftkerzen mit Bewegungs­melder/Elektronik: zusätzlich Brand­sicherheits-Norm (DIN EN 15493 für Kerzen).",
    ],
  },
};

function ComplianceBlock({ category }: { category: string }) {
  const cat = (category || "").trim();
  const hint = COMPLIANCE_HINTS[cat];
  const sevColor = hint?.severity === "high"
    ? "text-red-300 bg-red-500/10 border-red-500/25"
    : hint?.severity === "medium"
      ? "text-amber-300 bg-amber-500/10 border-amber-500/25"
      : "text-zinc-300 bg-white/5 border-white/10";
  const sevLabel = hint?.severity === "high"
    ? "Hohe Compliance-Anforderung"
    : hint?.severity === "medium"
      ? "Mittlere Compliance-Anforderung"
      : "Standard-Pflichten";
  return (
    <details className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 hover:bg-amber-500/[0.06] transition">
        <Scale className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="text-sm font-semibold text-amber-100">
          Rechtliche Hinweise &amp; Compliance
        </span>
        {hint && (
          <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${sevColor}`}>
            <ShieldCheck className="w-2.5 h-2.5" />
            {sevLabel}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-500/10">
        {hint && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80 font-semibold">
              Spezifisch für „{cat}"
            </div>
            <ul className="space-y-1.5">
              {hint.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-amber-100/90 leading-snug">
                  <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                  <span dangerouslySetInnerHTML={{ __html: item }} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
            Gilt für alle Produkte
          </div>
          <ul className="space-y-1.5">
            {GENERIC_COMPLIANCE.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300 leading-snug">
                <span className="text-zinc-500 shrink-0 mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: item }} />
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] text-zinc-500 italic leading-relaxed border-t border-amber-500/10 pt-3">
          Dies sind allgemeine Hinweise und ersetzen KEINE Rechtsberatung. Bei
          Unklarheiten unbedingt einen Anwalt für IT-/Vertriebsrecht oder die
          zuständige Marktüberwachungs­behörde kontaktieren. Beim Dropshipping
          aus Nicht-EU-Ländern bist du als Verkäufer faktisch Importeur und
          haftest für die Konformität.
        </p>
      </div>
    </details>
  );
}

// ─── Hero-Banner: einzelner stärkster Pick prominent oben ───────
function HeroBanner({
  produkt,
  onOpen,
}: {
  produkt: Produkt;
  onOpen: (p: Produkt) => void;
}) {
  const price =
    produkt.extra?.finances?.recommendedSellPrice ||
    (produkt.preis && !Number.isNaN(Number(produkt.preis))
      ? Number(produkt.preis)
      : 0);
  const margin = produkt.extra?.finances?.profitMargin ?? 0;
  const trend = produkt.extra?.stats?.trendScore ?? 0;
  const growth = produkt.extra?.deepStats?.growth90d;
  const hookExample = produkt.extra?.adStrategy?.adHooks?.[0];
  return (
    <button
      onClick={() => onOpen(produkt)}
      className="group w-full text-left rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-orange-500/10 hover:border-white/25 transition relative"
    >
      <div className="flex flex-col md:flex-row gap-3 p-3 md:p-4">
        <div className="w-full md:w-44 h-32 md:h-32 shrink-0 rounded-xl overflow-hidden bg-white/5">
          <Thumb src={produkt.bildUrl} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-orange-500/20 text-orange-200 border border-orange-500/30">
              <Flame className="w-2.5 h-2.5" />
              Top Pick
            </span>
            {trend > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-semibold">
                <Zap className="w-2.5 h-2.5" />
                {trend}% Trend
              </span>
            )}
            {typeof growth === "number" && growth !== 0 && (
              <span
                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${growth > 0 ? "text-emerald-300 bg-emerald-500/10" : "text-red-300 bg-red-500/10"}`}
              >
                {growth > 0 ? (
                  <ArrowUpRight className="w-2.5 h-2.5" />
                ) : (
                  <ArrowDownRight className="w-2.5 h-2.5" />
                )}
                {growth > 0 ? "+" : ""}
                {growth}% 90T
              </span>
            )}
          </div>
          <h2 className="text-base md:text-lg font-bold text-zinc-100 leading-tight line-clamp-2">
            {displayTitle(produkt)}
          </h2>
          {hookExample && (
            <p className="text-[11px] text-zinc-400 italic line-clamp-2">
              „{hookExample}"
            </p>
          )}
          <div className="flex items-center gap-3 mt-auto">
            {price > 0 && (
              <span
                className="text-lg font-bold text-[#95BF47] tabular-nums"
                title="Preis kann schwanken"
              >
                {price}€<span className="text-[9px] text-zinc-500 ml-0.5">~</span>
              </span>
            )}
            {margin > 0 && (
              <span
                className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold"
                title={`+${margin.toFixed(2)}€ Marge`}
              >
                <DollarSign className="w-3 h-3" />
                +{marginPercent(produkt)}% Marge
                <span className="opacity-60 text-[10px]">({margin.toFixed(2)}€)</span>
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-300 group-hover:text-white transition">
              Details <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Curated Row (Netflix-Style horizontal scroll) ──────────────
// Eine Zeile pro Signal (Trending / Marge / Wachstum / Wenig
// Konkurrenz / Viral). Horizontal scrollbar mit Snap.
function CuratedRow({
  title,
  subtitle,
  icon: Icon,
  tint,
  produkte: list,
  getVotes,
  userVotes,
  onVote,
  onInfo,
}: {
  title: string;
  subtitle: string;
  icon: typeof Flame;
  tint: string;
  produkte: Produkt[];
  getVotes: (p: Produkt) => ProduktVotes;
  userVotes: Record<string, "up" | "down">;
  onVote: (id: string, direction: "up" | "down") => void;
  onInfo: (p: Produkt) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${tint}15`, color: tint }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-zinc-100 leading-tight">{title}</h2>
          <p className="text-[10px] text-zinc-500 leading-tight">{subtitle}</p>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {list.map((produkt, idx) => (
          <CuratedCard
            key={produkt.id}
            produkt={produkt}
            rank={idx + 1}
            tint={tint}
            votes={getVotes(produkt)}
            userVote={userVotes[produkt.id] || null}
            onVote={onVote}
            onClick={() => onInfo(produkt)}
          />
        ))}
      </div>
    </div>
  );
}

function CuratedCard({
  produkt,
  rank,
  tint,
  votes,
  userVote,
  onVote,
  onClick,
}: {
  produkt: Produkt;
  rank: number;
  tint: string;
  votes: ProduktVotes;
  userVote: "up" | "down" | null;
  onVote: (id: string, direction: "up" | "down") => void;
  onClick: () => void;
}) {
  const price =
    produkt.extra?.finances?.recommendedSellPrice ||
    (produkt.preis && !Number.isNaN(Number(produkt.preis))
      ? Number(produkt.preis)
      : 0);
  const trend = produkt.extra?.stats?.trendScore ?? 0;
  // <div> als Container (kein <button> wegen geschachteltem Vote-
  // Button — sonst invalid HTML). Klick auf die Karte oeffnet das
  // Detail-Modal; die Vote-Buttons sind eine separate Klickzone.
  return (
    <div className="shrink-0 w-44 snap-start rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25 transition group flex flex-col">
      <button
        type="button"
        onClick={onClick}
        className="text-left"
      >
        <div className="relative aspect-video bg-white/5 overflow-hidden">
          <Thumb src={produkt.bildUrl} />
          <div
            className="absolute top-1.5 left-1.5 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold tabular-nums backdrop-blur-md border"
            style={{ background: `${tint}25`, color: tint, borderColor: `${tint}40` }}
          >
            {rank}
          </div>
        </div>
        <div className="p-2 space-y-1">
          <h3 className="text-[11px] font-semibold text-zinc-100 leading-tight line-clamp-2 min-h-[2.5em]">
            {displayTitle(produkt)}
          </h3>
          <div className="flex items-center gap-1.5">
            {price > 0 ? (
              <span
                className="text-xs font-bold text-[#95BF47] tabular-nums"
                title="Preis kann schwanken"
              >
                {price}€<span className="text-[8px] text-zinc-500 ml-0.5">~</span>
              </span>
            ) : (
              <span className="text-[10px] text-zinc-500 italic">Preis folgt</span>
            )}
            {trend > 0 && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-[9px] text-emerald-300 bg-emerald-500/10 px-1 py-0.5 rounded-full font-semibold">
                <Zap className="w-2.5 h-2.5" />
                {trend}%
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="px-2 pb-2 mt-auto">
        <VoteButtons
          produkt={produkt}
          votes={votes}
          userVote={userVote}
          onVote={(d) => onVote(produkt.id, d)}
          size="sm"
        />
      </div>
    </div>
  );
}

// ─── "Link evtl. nicht mehr verfügbar" Hinweis ───────────────────
// Wird NUR gerendert, wenn der Cron den jeweiligen Link als nicht
// erreichbar markiert hat — sonst bleibt der Bereich sauber.
function BrokenLinkHint() {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2 py-1.5">
      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
      <span>
        Hinweis: Dieser Link ist evtl. nicht mehr verfügbar.
      </span>
    </div>
  );
}

// ─── Main Charts Page ────────────────────────────────────────────

export default function ChartsPage() {
  const router = useRouter();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [error, setError] = useState("");
  // votedProducts: { [produktId]: "up" | "down" } — fuer Pfeil-Highlight
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down">>({});
  // Optimistic-Update-Tracker fuer Votes (Score-Delta pro Produkt)
  const [voteOverrides, setVoteOverrides] = useState<Record<string, ProduktVotes>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [highMarginOnly, setHighMarginOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("trend");

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.status === 401) { router.push("/"); return; }
      const data = await res.json();
      setProdukte(data.produkte || []);
    } catch { setError("Fehler beim Laden der Produkte."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(data => {
      if (!data.isLoggedIn) { router.push("/"); return; }
    });
    loadProducts();
    // Pre-load: welche Produkte hat dieser User bereits gevotet?
    fetch("/api/products/my-votes")
      .then((r) => r.json())
      .then((d) => setUserVotes(d.votes || {}))
      .catch(() => {});
  }, [loadProducts, router]);

  // Vote-Handler — optimistic update + Server-Roundtrip
  async function handleVote(produktId: string, direction: "up" | "down") {
    const prev = userVotes[produktId];
    const produkt = produkte.find((p) => p.id === produktId);
    if (!produkt) return;
    const currentVotes: ProduktVotes =
      voteOverrides[produktId] || produkt.extra?.votes || { ups: 0, downs: 0 };
    let ups = currentVotes.ups ?? 0;
    let downs = currentVotes.downs ?? 0;
    let newVote: "up" | "down" | null = direction;
    if (prev === direction) {
      // Toggle: gleiche Richtung -> Vote zuruecknehmen
      if (direction === "up") ups = Math.max(0, ups - 1);
      else downs = Math.max(0, downs - 1);
      newVote = null;
    } else {
      if (prev === "up") ups = Math.max(0, ups - 1);
      else if (prev === "down") downs = Math.max(0, downs - 1);
      if (direction === "up") ups += 1;
      else downs += 1;
    }
    // Optimistic
    setVoteOverrides((m) => ({
      ...m,
      [produktId]: { ups, downs, manualBoost: currentVotes.manualBoost },
    }));
    setUserVotes((m) => {
      const next = { ...m };
      if (newVote) next[produktId] = newVote;
      else delete next[produktId];
      return next;
    });
    // Server-Call
    try {
      const res = await fetch("/api/products/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produktId, direction }),
      });
      if (res.ok) {
        const d = await res.json();
        // Server-Wahrheit uebernehmen (kann minimal abweichen)
        setVoteOverrides((m) => ({
          ...m,
          [produktId]: {
            ups: d.ups,
            downs: d.downs,
            manualBoost: d.manualBoost,
          },
        }));
        setUserVotes((m) => {
          const next = { ...m };
          if (d.userVote) next[produktId] = d.userVote;
          else delete next[produktId];
          return next;
        });
      } else {
        // Rollback bei Fehler
        setUserVotes((m) => {
          const next = { ...m };
          if (prev) next[produktId] = prev;
          else delete next[produktId];
          return next;
        });
        setVoteOverrides((m) => {
          const next = { ...m };
          delete next[produktId];
          return next;
        });
      }
    } catch {
      // ignore — optimistic stays, will reconcile on reload
    }
  }

  /** Score fuer ein Produkt — aus Overrides falls vorhanden, sonst Sheet. */
  function getProduktVotes(p: Produkt): ProduktVotes {
    return voteOverrides[p.id] || p.extra?.votes || {};
  }

  // Apply search + filter + sort — must run BEFORE any early return
  // (Rules of Hooks: useMemo can't be called conditionally)
  const filteredProdukte = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = produkte.filter((pr) => {
      const t = (pr.titel || "").toLowerCase();
      if (q && !t.includes(q)) return false;
      // "Top-Marge"-Filter: jetzt PROZENT-basiert (>= 100% Aufschlag,
      // d.h. mindestens Verdoppelung des Einkaufspreises). Vorher war
      // das ein willkuerlicher 15€-Threshold.
      if (highMarginOnly && marginPercent(pr) < 100) return false;
      return true;
    });
    const sorters: Record<SortKey, (a: Produkt, b: Produkt) => number> = {
      trend: (a, b) =>
        (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0),
      viral: (a, b) =>
        (b.extra?.stats?.viralScore ?? 0) - (a.extra?.stats?.viralScore ?? 0),
      // Marge-Sort jetzt nach PROZENT — billige Produkte mit hohem
      // Aufschlag schlagen teure Produkte mit absoluten Euro-Margen.
      margin: (a, b) => marginPercent(b) - marginPercent(a),
      growth: (a, b) =>
        (b.extra?.deepStats?.growth90d ?? -200) -
        (a.extra?.deepStats?.growth90d ?? -200),
      // Niedrige Konkurrenz bevorzugen, dann Trend als Tiebreaker.
      lowCompetition: (a, b) => {
        const ca = a.extra?.deepStats?.competition ?? 100;
        const cb = b.extra?.deepStats?.competition ?? 100;
        if (ca !== cb) return ca - cb;
        return (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0);
      },
      popular: (a, b) =>
        displayedScore(b, getProduktVotes(b)) - displayedScore(a, getProduktVotes(a)),
    };
    return [...base].sort(sorters[sortKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produkte, searchTerm, highMarginOnly, sortKey, voteOverrides]);
  const totalProducts = produkte.length;

  // Stats-Overview-Strip oben auf der Seite. Aggregiert über die
  // CURRENTLY VISIBLE (gefilterte) Liste, damit die Zahlen mit dem
  // mitwachsen was der User selektiert.
  const overview = useMemo(() => {
    const list = filteredProdukte;
    if (list.length === 0) {
      return {
        count: 0,
        avgTrend: 0,
        avgMarginPct: 0,
        avgMarginEur: 0,
        topCategory: "",
        hotCount: 0,
        avgGrowth: 0,
      };
    }
    const sum = (fn: (p: Produkt) => number) => list.reduce((s, p) => s + fn(p), 0);
    const catCount = new Map<string, number>();
    for (const pr of list) {
      const k = (pr.sku || "—").toUpperCase();
      catCount.set(k, (catCount.get(k) || 0) + 1);
    }
    const topCat = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
    return {
      count: list.length,
      avgTrend: Math.round(sum((p) => p.extra?.stats?.trendScore ?? 0) / list.length),
      // Ø Marge ist jetzt in PROZENT — vergleichbar zwischen Produkten
      // unabhaengig vom Preis-Level.
      avgMarginPct: Math.round(sum((p) => marginPercent(p)) / list.length),
      // Euro-Average bleibt fuer Tooltip-Hinweise.
      avgMarginEur: Math.round((sum((p) => p.extra?.finances?.profitMargin ?? 0) / list.length) * 100) / 100,
      topCategory: topCat,
      hotCount: list.filter((p) => (p.extra?.stats?.trendScore ?? 0) >= 80).length,
      avgGrowth: Math.round(
        sum((p) => p.extra?.deepStats?.growth90d ?? 0) / list.length,
      ),
    };
  }, [filteredProdukte]);

  // Kuratierte Trend-Rows (Netflix-Style). Jede Row ist ein Signal.
  // KEINE Kategorien — wir wollen dem User Discovery nach RELEVANZ
  // zeigen, nicht nach willkuerlichem SKU-Bucket.
  const curatedRows = useMemo(() => {
    if (filteredProdukte.length === 0) return [];
    const byTrend = [...filteredProdukte].sort(
      (a, b) => (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0),
    );
    // Sortierung nach Marge-PROZENT (Aufschlag relativ zum Einkauf),
    // nicht nach absoluten Euro — so faellt ein 5€->50€ Schnaeppchen
    // (900%) ueber ein 100€->150€ Premium-Produkt (50%).
    const byMargin = [...filteredProdukte].sort(
      (a, b) => marginPercent(b) - marginPercent(a),
    );
    const byGrowth = [...filteredProdukte].sort(
      (a, b) => (b.extra?.deepStats?.growth90d ?? -999) - (a.extra?.deepStats?.growth90d ?? -999),
    );
    const byLowComp = [...filteredProdukte].sort(
      (a, b) =>
        (a.extra?.deepStats?.competition ?? 100) - (b.extra?.deepStats?.competition ?? 100),
    );
    const byViral = [...filteredProdukte].sort(
      (a, b) => (b.extra?.stats?.viralScore ?? 0) - (a.extra?.stats?.viralScore ?? 0),
    );
    const byPopular = [...filteredProdukte].sort(
      (a, b) => displayedScore(b, getProduktVotes(b)) - displayedScore(a, getProduktVotes(a)),
    );
    // Seeds sind immer >= 5, also haben wir IMMER eine Beliebteste-Row
    // sobald ueberhaupt Produkte vorhanden sind.
    const anyVotes = byPopular.length > 0;

    return [
      {
        key: "trend",
        title: "Heute trending",
        subtitle: "Die heißesten Produkte gerade",
        icon: Flame,
        tint: "#F97316",
        list: byTrend.slice(0, 12),
      },
      // Nur rendern wenn ueberhaupt schon jemand abgestimmt hat
      ...(anyVotes
        ? [{
            key: "popular",
            title: "Beliebteste bei Brospify",
            subtitle: "Vom Brospify-Community per Up-/Downvote bewertet",
            icon: ArrowUpRight,
            tint: "#FBBF24",
            list: byPopular.slice(0, 12),
          }]
        : []),
      {
        key: "viral",
        title: "Social-Media-Viralität",
        subtitle: "Stärkste Performance auf TikTok & Reels",
        icon: Megaphone,
        tint: "#A855F7",
        list: byViral.slice(0, 12),
      },
      {
        key: "margin",
        title: "Höchste Marge",
        subtitle: "Maximaler Profit pro Verkauf",
        icon: Wallet,
        tint: "#10B981",
        list: byMargin.slice(0, 12),
      },
      {
        key: "growth",
        title: "Wachstums-Champions",
        subtitle: "Größter Nachfrage-Anstieg in 90 Tagen",
        icon: ArrowUpRight,
        tint: "#22C55E",
        list: byGrowth.slice(0, 12),
      },
      {
        key: "lowComp",
        title: "Wenig Konkurrenz",
        subtitle: "Noch nicht überlaufen — jetzt einsteigen",
        icon: Crosshair,
        tint: "#3B82F6",
        list: byLowComp.slice(0, 12),
      },
    ].filter((row) => row.list.length > 0);
  }, [filteredProdukte]);

  // Vorgefertigte Themen-Kategorien. Pro Kategorie alle passenden
  // Produkte (Match: sku/titel/beschreibung-Substring gegen Keywords).
  // Innerhalb einer Kategorie wieder nach Trend sortiert. Kategorien
  // ohne Treffer werden nicht gerendert.
  const categoryRows = useMemo(() => {
    if (filteredProdukte.length === 0) return [];
    return PREDEFINED_CATEGORIES.map((cat) => {
      const list = filteredProdukte
        .filter((p) => produktMatchesCategory(p, cat.keywords))
        .sort(
          (a, b) =>
            (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0),
        )
        .slice(0, 12);
      return {
        key: cat.key,
        title: cat.label,
        subtitle: `Aktuelle Trends im US-Markt für ${cat.label}`,
        icon: cat.icon,
        tint: cat.tint,
        list,
      };
    }).filter((row) => row.list.length > 0);
  }, [filteredProdukte]);

  // Hero-Pick: der einzelne stärkste Produkt-Eintrag fürs Top-Banner.
  const heroPick = useMemo(() => {
    if (filteredProdukte.length === 0) return null;
    return [...filteredProdukte].sort((a, b) => {
      const ta = a.extra?.stats?.trendScore ?? 0;
      const tb = b.extra?.stats?.trendScore ?? 0;
      const va = a.extra?.stats?.viralScore ?? 0;
      const vb = b.extra?.stats?.viralScore ?? 0;
      return (tb * 0.6 + vb * 0.4) - (ta * 0.6 + va * 0.4);
    })[0];
  }, [filteredProdukte]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const p = infoModal.produkt;
  const allImages = p ? [...new Set([p.bildUrl, ...(p.extra?.images || [])].filter(Boolean))] : [];

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#95BF47] shrink-0" />
              <span className="truncate">Winning Charts</span>
            </h1>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Aktuelle Trends aus dem US-Markt · Audience · Ad-Strategie · AliExpress-Quellen
            </p>
          </div>
        </div>

        {/* ─── US-Markt + Beispiel-Disclaimer ───────────────── */}
        {produkte.length > 0 && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-blue-500/[0.06] border border-blue-500/15 text-blue-100">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-300" />
            <p className="text-[11px] leading-snug text-blue-100/85">
              <strong className="text-blue-200">Alle Produkte stammen aus dem aktuellen US-Markt-Trend</strong> und werden für den deutschen Markt aufbereitet.
              AliExpress-Links und Bilder sind <strong>Beispiele</strong> — das tatsächliche Produkt deines Lieferanten kann abweichen, auf den Bildern sind teils ähnliche Produkte zu sehen.
            </p>
          </div>
        )}

        {/* ─── Stats Overview Strip ───────────────────────────── */}
        {/* KEINE Stueckzahlen — wir zeigen nur qualitative Signale. */}
        {produkte.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            <StatTile
              label="Ø Trend"
              value={`${overview.avgTrend}%`}
              sub={overview.avgTrend >= 70 ? "stark" : overview.avgTrend >= 40 ? "ok" : "schwach"}
              icon={Activity}
              tint="#A855F7"
            />
            <StatTile
              label="Heiße Picks"
              value={overview.hotCount >= 10 ? "viele" : overview.hotCount >= 3 ? "einige" : overview.hotCount > 0 ? "wenige" : "—"}
              sub="Trend ≥ 80%"
              icon={Flame}
              tint="#F97316"
            />
            <StatTile
              label="Ø Marge"
              value={`+${overview.avgMarginPct}%`}
              sub={`≈ ${overview.avgMarginEur.toFixed(2)}€`}
              icon={Wallet}
              tint="#10B981"
            />
            <StatTile
              label="Ø Wachstum"
              value={`${overview.avgGrowth > 0 ? "+" : ""}${overview.avgGrowth}%`}
              sub="90 Tage"
              icon={overview.avgGrowth >= 0 ? ArrowUpRight : TrendingDown}
              tint={overview.avgGrowth >= 0 ? "#22C55E" : "#EF4444"}
            />
            <StatTile
              label="Top-Kategorie"
              value={overview.topCategory || "—"}
              sub="häufigste"
              icon={Award}
              tint="#3B82F6"
            />
          </div>
        )}

        {/* ─── Hero-Pick (das stärkste Produkt prominent) ─── */}
        {heroPick && (
          <HeroBanner
            produkt={heroPick}
            onOpen={(p) => setInfoModal({ open: true, produkt: p })}
          />
        )}

        {/* ─── Search + Sort + Filter (ohne Kategorien) ─── */}
        {produkte.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <BarChart3 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Produkt suchen…"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[12px] outline-none focus:border-white/25 transition placeholder:text-zinc-600"
              />
            </div>
            <div className="relative shrink-0">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="appearance-none bg-white/[0.04] border border-white/10 rounded-lg pl-7 pr-7 py-1.5 text-[11px] outline-none focus:border-white/25 transition text-zinc-300"
              >
                <option value="trend">Alle: Trend</option>
                <option value="viral">Alle: Viral</option>
                <option value="margin">Alle: Marge</option>
                <option value="growth">Alle: Wachstum</option>
                <option value="lowCompetition">Alle: Wenig Konkurrenz</option>
                <option value="popular">Alle: Beliebteste</option>
              </select>
            </div>
            <button
              onClick={() => setHighMarginOnly((v) => !v)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border transition shrink-0 ${
                highMarginOnly
                  ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                  : "bg-white/[0.03] border-white/10 text-zinc-400"
              }`}
            >
              <DollarSign className="w-3 h-3" />
              Top-Marge
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-500/20 px-3 py-2 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")}><X className="w-3 h-3" /></button>
          </div>
        )}

        {filteredProdukte.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-zinc-400">
              {produkte.length === 0 ? "Noch keine Produkte" : "Nichts gefunden"}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {produkte.length === 0
                ? "Deine Winning Product Charts erscheinen hier."
                : "Probier einen anderen Suchbegriff oder deaktiviere den Filter."}
            </p>
          </div>
        ) : searchTerm.trim() === "" && !highMarginOnly ? (
          // ─── Default: Trend-Rows + Themen-Kategorien ─────────
          // Erst die signalbasierten kuratierten Rows (Trending,
          // Marge, Wachstum, etc.), dann die vorgefertigten Themen-
          // Kategorien (Sport, Beauty, Haushalt, ...).
          <>
            {/* Block 1 — Trend-Signale */}
            {curatedRows.map((row) => (
              <CuratedRow
                key={row.key}
                title={row.title}
                subtitle={row.subtitle}
                icon={row.icon}
                tint={row.tint}
                produkte={row.list}
                getVotes={getProduktVotes}
                userVotes={userVotes}
                onVote={handleVote}
                onInfo={(p) => setInfoModal({ open: true, produkt: p })}
              />
            ))}

            {/* Block 2 — Themen-Kategorien (Sport, Beauty, ...) */}
            {categoryRows.length > 0 && (
              <div className="pt-3 pb-1 border-t border-white/5">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-300">
                    Nach Themen
                  </h2>
                </div>
              </div>
            )}
            {categoryRows.map((row) => (
              <CuratedRow
                key={`cat-${row.key}`}
                title={row.title}
                subtitle={row.subtitle}
                icon={row.icon}
                tint={row.tint}
                produkte={row.list}
                getVotes={getProduktVotes}
                userVotes={userVotes}
                onVote={handleVote}
                onInfo={(p) => setInfoModal({ open: true, produkt: p })}
              />
            ))}
          </>
        ) : (
          // ─── Such- / Filter-Ergebnisse als Liste ─────────────
          // Wenn Search oder Marge-Filter aktiv: nur die gefilterte
          // Liste anzeigen (mit der gewaehlten Sortierung).
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-300" />
              <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-200">
                Suchergebnisse
              </h2>
            </div>
            {filteredProdukte.map((produkt, idx) => (
              <ProduktRow
                key={produkt.id}
                produkt={produkt}
                rank={idx + 1}
                votes={getProduktVotes(produkt)}
                userVote={userVotes[produkt.id] || null}
                onVote={handleVote}
                onInfo={(p) => setInfoModal({ open: true, produkt: p })}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── INFO MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal.open && p && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4" onClick={() => setInfoModal({ open: false, produkt: null })}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setInfoModal({ open: false, produkt: null })} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-1.5 bg-zinc-800 rounded-full"><X className="w-4 h-4" /></button>

              <div className="p-3 sm:p-4 pb-0 space-y-2">
                {/* `key` mountet die Slideshow für jedes Produkt neu —
                    so wird das "broken"-Set / der idx sauber zurückgesetzt. */}
                <ImageSlideshow key={p.id} images={allImages} />
                <p className="text-[10px] text-zinc-500 italic leading-snug flex items-start gap-1 px-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    Bilder dienen als Beispiel / Inspiration. Das tatsächliche Produkt deines Lieferanten kann abweichen — manche Bilder zeigen ähnliche oder verwandte Produkte aus dem US-Markt.
                  </span>
                </p>
              </div>

              <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                  {/* Auf Mobile: Titel oben, Votes drunter (column) —
                      sonst quetschen sie sich auf engen Screens. */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
                    <h3 className="text-lg sm:text-xl font-bold leading-tight flex-1 min-w-0 break-words">
                      {displayTitle(p)}
                    </h3>
                    <div className="shrink-0 self-start">
                      <VoteButtons
                        produkt={p}
                        votes={getProduktVotes(p)}
                        userVote={userVotes[p.id] || null}
                        onVote={(d) => handleVote(p.id, d)}
                        size="md"
                      />
                    </div>
                  </div>
                  {p.beschreibung && <div className="text-sm text-zinc-400 mt-2 leading-relaxed break-words [&_p]:my-2 [&_p]:break-words [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:break-words [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-200 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-2 [&_strong]:font-semibold [&_strong]:text-zinc-200 [&_a]:underline [&_a]:break-all" dangerouslySetInnerHTML={{ __html: p.beschreibung }} />}
                  {(!p.beschreibung || looksLikeAutoId(p.titel)) && (
                    <p className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mt-2 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Dieses Produkt hat noch unvollständige Daten. Wir aktualisieren das in Kürze.</span>
                    </p>
                  )}
                </div>

                {p.extra?.stats && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#95BF47]" />Premium Analytics</h4>
                    <div className="space-y-3">
                      <StatBar label="Viralitäts-Score" value={p.extra.stats.viralScore} icon={Zap} color="text-purple-400" delay={100} />
                      <StatBar label="Impulskauf-Faktor" value={p.extra.stats.impulseBuyFactor} icon={ShoppingBag} color="text-amber-400" delay={250} />
                      <StatBar label="Problemlöser-Index" value={p.extra.stats.problemSolverIndex} icon={Target} color="text-emerald-400" delay={400} />
                      <StatBar label="Marktsättigung" value={p.extra.stats.marketSaturation} icon={PieChart} color="text-red-400" delay={550} />
                    </div>
                  </div>
                )}

                {p.extra?.finances && (
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Marge &amp; Finanzen</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Einkauf</div>
                        <div className="text-lg font-bold text-red-400">{p.extra.finances.buyPrice.toFixed(2)}&euro;</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Verkauf</div>
                        <div className="text-lg font-bold text-white">{p.extra.finances.recommendedSellPrice.toFixed(2)}&euro;</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-zinc-500 mb-1">Marge</div>
                        {/* Marge in PROZENT als Haupt-Anzeige, EUR-Betrag
                            als kleiner Hinweis darunter. So sieht der User
                            sofort wie stark der Aufschlag ist (Vergleichbar
                            zwischen Produkten). */}
                        <div className="text-lg font-bold text-emerald-400">
                          +{marginPercent(p)}%
                        </div>
                        <div className="text-[10px] text-emerald-300/70 tabular-nums">
                          ≈ +{p.extra.finances.profitMargin.toFixed(2)}€
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2 py-1.5 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Preise sind Richtwerte &mdash; der reale Preis kann schwanken. Marge-% = Aufschlag auf den Einkaufspreis.</span>
                    </div>
                  </div>
                )}

                {/* ─── Legacy-Produkt-Check ──────────────────────
                    Wenn KEINER der erweiterten Datenblöcke vorhanden
                    ist (Produkt wurde vor dem grossen Discovery-Update
                    erstellt), zeigen wir EINE freundliche Meldung
                    statt 5 leerer Sektionen. */}
                {(() => {
                  const ads = p.extra?.ads;
                  const hasAds = ads && (
                    (ads.tiktok?.length ?? 0) > 0 ||
                    (ads.instagram?.length ?? 0) > 0 ||
                    (ads.facebook?.length ?? 0) > 0 ||
                    (ads.youtube?.length ?? 0) > 0
                  );
                  const hasShops =
                    (p.extra?.links?.dropshippingExamples?.length ?? 0) > 0 ||
                    !!p.extra?.links?.dropshippingExample?.url;
                  const hasDeepStats = !!p.extra?.deepStats && (
                    (p.extra.deepStats.competition ?? 0) > 0 ||
                    (p.extra.deepStats.seasonality ?? 0) > 0 ||
                    (p.extra.deepStats.repeatPurchaseRate ?? 0) > 0 ||
                    (p.extra.deepStats.peakMonths?.length ?? 0) > 0
                  );
                  const hasAudience = !!p.extra?.audience?.primary;
                  const hasAdStrategy = !!p.extra?.adStrategy?.bestFormat ||
                    (p.extra?.adStrategy?.adHooks?.length ?? 0) > 0;
                  const isLegacy = !hasAds && !hasShops && !hasDeepStats && !hasAudience && !hasAdStrategy;
                  if (isLegacy) {
                    return (
                      <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-300">
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
                        <div className="text-xs leading-relaxed">
                          <strong className="text-zinc-200">Keine erweiterten Daten verfügbar.</strong>
                          <p className="mt-0.5 text-zinc-400">
                            Dieses Produkt wurde vor dem letzten großen Update angelegt — Beispiel-Ads (TikTok/Instagram/Facebook/YouTube), Dropshipping-Shop-Beispiele, Zielgruppen-Analyse, Ad-Strategie und Markt-Daten sind hier nicht verfügbar.
                            <br/><span className="text-zinc-500">Neu via KI-Discovery angelegte Produkte zeigen das alles automatisch.</span>
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <>
                      {/* ─── Markt / Saison / Wachstum ──────────── */}
                      <DeepStatsBlock ds={p.extra?.deepStats} />

                      {/* ─── Zielgruppe + Targeting ─────────────── */}
                      <AudienceBlock a={p.extra?.audience} />

                      {/* ─── Ad-Strategie (Budget + Format + Hooks) */}
                      <AdStrategyBlock s={p.extra?.adStrategy} />

                      {/* ─── Beispiel-Ads (Social Media) ────────── */}
                      <AdsBlock ads={p.extra?.ads} />

                      {/* ─── Beispiel-Dropshipping-Shops ──────── */}
                      <DropshippingBlock
                        examples={p.extra?.links?.dropshippingExamples}
                        legacy={p.extra?.links?.dropshippingExample}
                        status={p.extra?.linkStatus?.dropshippingExampleOk}
                      />
                    </>
                  );
                })()}

                {/* ─── AliExpress Links (Kategorie + Produkt) ───── */}
                {/* Kategorie wird synthetisiert wenn nicht gespeichert —
                    so funktioniert auch für alte Produkte ohne `links`. */}
                <div className="space-y-2">
                  <AliLinksBlock
                    produktLink={
                      p.extra?.links?.aliExpressProduct || p.aliExpressLink
                    }
                    kategorieLink={
                      p.extra?.links?.aliExpressCategory ||
                      synthesizeAliCategoryLink(p)
                    }
                    productOk={p.extra?.linkStatus?.aliExpressProductOk}
                    categoryOk={p.extra?.linkStatus?.aliExpressCategoryOk}
                  />
                  <p className="text-[10px] text-zinc-500 italic leading-snug flex items-start gap-1 px-1">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      Die AliExpress-Links sind <strong className="text-zinc-400">Beispiele</strong> für mögliche Lieferanten dieses Trends — das konkrete Produkt deines gewählten Sellers kann in Details abweichen.
                    </span>
                  </p>
                </div>

                {/* ─── Rechts-Hinweise / Compliance ───────────── */}
                <ComplianceBlock category={p.sku} />

                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, können reale Einkaufspreise, Verfügbarkeiten und die Marktsättigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie für spezifische Umsätze oder Profite dar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
