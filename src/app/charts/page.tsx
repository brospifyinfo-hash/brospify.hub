"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Check,
  Copy,
  X,
  TrendingUp,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Info,
  BarChart3,
  Zap,
  ShoppingBag,
  Target,
  PieChart,
  DollarSign,
  Link2,
  Sparkles,
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
  };
}

// Sortier-Keys für die UI-Toolbar.
type SortKey = "trend" | "viral" | "margin" | "growth" | "lowCompetition";

const MONTH_LABEL_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

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
                <span className="text-[10px] text-zinc-500 ml-auto tabular-nums">
                  {urls.length} {urls.length === 1 ? "Beispiel" : "Beispiele"}
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

// ─── Dropshipping shop example ──────────────────────────────────
function DropshippingBlock({
  example,
  status,
}: {
  example?: { url: string; title?: string };
  status?: boolean;
}) {
  if (!example?.url) return null;
  const broken = status === false;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Store className="w-4 h-4 text-indigo-300" />
        Beispiel Dropshipping-Shop
      </h4>
      <a
        href={example.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 hover:bg-indigo-500/15 transition text-sm"
      >
        <Store className="w-4 h-4 shrink-0" />
        <span className="flex-1 truncate">{example.title || example.url}</span>
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      </a>
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
  hasShopifyToken,
  onInfo,
  onImport,
}: {
  produkt: Produkt;
  rank: number;
  hasShopifyToken: boolean;
  onInfo: (p: Produkt) => void;
  onImport: (p: Produkt) => void;
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
            <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              <DollarSign className="w-3 h-3" />
              +{produkt.extra.finances.profitMargin.toFixed(2)}€
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onInfo(produkt)}
          className="p-1.5 text-zinc-400 bg-white/5 border border-white/10 rounded-md"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
        {hasShopifyToken ? (
          <button
            onClick={() => onImport(produkt)}
            className="btn-accent px-2 py-1.5 text-xs font-medium rounded-md flex items-center gap-1"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import</span>
          </button>
        ) : (
          <div className="p-1.5 text-zinc-500 bg-white/5 border border-white/10 rounded-md">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
        )}
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
  const [importingId, setImportingId] = useState<string | null>(null);
  const [successModal, setSuccessModal] = useState<{ open: boolean; aliExpressLink: string }>({ open: false, aliExpressLink: "" });
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highMarginOnly, setHighMarginOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("trend");
  /** "" = alle Kategorien zeigen, sonst Filter auf eine. */
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [viewMode, setViewMode] = useState<"sections" | "list">("sections");

  // AI Import Modal
  const [aiModal, setAiModal] = useState<{ open: boolean; produkt: Produkt | null }>({ open: false, produkt: null });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ title: string; body_html: string; tags?: string } | null>(null);
  const [aiImporting, setAiImporting] = useState(false);
  const [aiError, setAiError] = useState("");

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
      setHasShopifyToken(data.hasShopifyToken || false);
    });
    loadProducts();
  }, [loadProducts, router]);

  async function handleImport(produkt: Produkt) {
    if (!hasShopifyToken) return;
    setImportingId(produkt.id);
    setError("");
    try {
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produktId: produkt.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || produkt.aliExpressLink || "" });
    } catch { setError("Import fehlgeschlagen."); }
    finally { setImportingId(null); }
  }

  // Apply search + filter + sort — must run BEFORE any early return
  // (Rules of Hooks: useMemo can't be called conditionally)
  const filteredProdukte = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = produkte.filter((pr) => {
      const t = (pr.titel || "").toLowerCase();
      if (q && !t.includes(q)) return false;
      if (highMarginOnly && (pr.extra?.finances?.profitMargin ?? 0) < 15) return false;
      if (activeCategory && (pr.sku || "—") !== activeCategory) return false;
      return true;
    });
    const sorters: Record<SortKey, (a: Produkt, b: Produkt) => number> = {
      trend: (a, b) =>
        (b.extra?.stats?.trendScore ?? 0) - (a.extra?.stats?.trendScore ?? 0),
      viral: (a, b) =>
        (b.extra?.stats?.viralScore ?? 0) - (a.extra?.stats?.viralScore ?? 0),
      margin: (a, b) =>
        (b.extra?.finances?.profitMargin ?? 0) -
        (a.extra?.finances?.profitMargin ?? 0),
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
    };
    return [...base].sort(sorters[sortKey]);
  }, [produkte, searchTerm, highMarginOnly, sortKey, activeCategory]);
  const totalProducts = produkte.length;

  // Kategorien (SKU-basiert) für Filter-Chips + Sektions-Gruppierung.
  // Leere SKU wird als "—" gerendert.
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const pr of produkte) {
      const key = (pr.sku || "—").toUpperCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }, [produkte]);

  // Stats-Overview-Strip oben auf der Seite. Aggregiert über die
  // CURRENTLY VISIBLE (gefilterte) Liste, damit die Zahlen mit dem
  // mitwachsen was der User selektiert.
  const overview = useMemo(() => {
    const list = filteredProdukte;
    if (list.length === 0) {
      return {
        count: 0,
        avgTrend: 0,
        avgMargin: 0,
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
      avgMargin:
        Math.round(
          (sum((p) => p.extra?.finances?.profitMargin ?? 0) / list.length) * 100,
        ) / 100,
      topCategory: topCat,
      hotCount: list.filter((p) => (p.extra?.stats?.trendScore ?? 0) >= 80).length,
      avgGrowth: Math.round(
        sum((p) => p.extra?.deepStats?.growth90d ?? 0) / list.length,
      ),
    };
  }, [filteredProdukte]);

  // Gruppierte Sektionen für die Sections-View (gruppiert nach SKU).
  const sections = useMemo(() => {
    const map = new Map<string, Produkt[]>();
    for (const pr of filteredProdukte) {
      const k = (pr.sku || "—").toUpperCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(pr);
    }
    return Array.from(map.entries())
      .map(([key, list]) => ({ key, list }))
      .sort((a, b) => b.list.length - a.list.length);
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
              Top-Dropshipping-Produkte · Rankings · Audience · Ad-Strategie · 1-Klick-Import
            </p>
          </div>
          {totalProducts > 0 && (
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Produkte</div>
              <div className="text-sm font-bold text-[#95BF47] tabular-nums">{totalProducts}</div>
            </div>
          )}
        </div>

        {/* ─── Stats Overview Strip ───────────────────────────── */}
        {produkte.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatTile
              label="Produkte"
              value={String(overview.count)}
              sub={`von ${totalProducts} gesamt`}
              icon={Layers}
              tint="#95BF47"
            />
            <StatTile
              label="Ø Trend"
              value={`${overview.avgTrend}%`}
              sub={overview.avgTrend >= 70 ? "stark" : overview.avgTrend >= 40 ? "ok" : "schwach"}
              icon={Activity}
              tint="#A855F7"
            />
            <StatTile
              label="Heiße Picks"
              value={String(overview.hotCount)}
              sub="Trend ≥ 80%"
              icon={Flame}
              tint="#F97316"
            />
            <StatTile
              label="Ø Marge"
              value={`${overview.avgMargin.toFixed(2)}€`}
              sub="Verkauf - Einkauf"
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

        {/* ─── Search + Sort + Filter ───────────────────────── */}
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
                <option value="trend">Sort: Trend</option>
                <option value="viral">Sort: Viral</option>
                <option value="margin">Sort: Marge</option>
                <option value="growth">Sort: Wachstum</option>
                <option value="lowCompetition">Sort: Wenig Konkurrenz</option>
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
            <div className="flex shrink-0 bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("sections")}
                className={`px-2.5 py-1.5 text-[10px] font-semibold transition ${
                  viewMode === "sections" ? "bg-white/10 text-zinc-100" : "text-zinc-500"
                }`}
                title="Nach Kategorien gruppiert"
              >
                <Layers className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`px-2.5 py-1.5 text-[10px] font-semibold transition ${
                  viewMode === "list" ? "bg-white/10 text-zinc-100" : "text-zinc-500"
                }`}
                title="Flache Rangliste"
              >
                <Hash className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* ─── Kategorie-Chips ────────────────────────────────── */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setActiveCategory("")}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
                activeCategory === ""
                  ? "bg-[#95BF47]/15 border-[#95BF47]/35 text-[#95BF47]"
                  : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Alle <span className="opacity-60">·</span> {totalProducts}
            </button>
            {categories.map((c) => (
              <button
                key={c.key}
                onClick={() =>
                  setActiveCategory((prev) => (prev === c.key ? "" : c.key))
                }
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition ${
                  activeCategory === c.key
                    ? "bg-purple-500/15 border-purple-500/35 text-purple-200"
                    : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {c.key} <span className="opacity-60">·</span> {c.count}
              </button>
            ))}
          </div>
        )}

        {/* Token banner — slim on mobile */}
        {!hasShopifyToken && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-2.5 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <p className="flex-1 text-[11px] leading-snug">
              <span className="font-semibold">Shop nicht verbunden.</span>{" "}
              <span className="hidden sm:inline">1-Klick-Import deaktiviert.</span>
            </p>
            <button onClick={() => router.push("/setup")} className="shrink-0 btn-accent px-2.5 py-1.5 rounded-lg text-[11px] font-medium">
              Verbinden
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
        ) : viewMode === "sections" ? (
          // Gruppierte Sektion-Ansicht: pro Kategorie ein eigener Block.
          <div className="space-y-5">
            {sections.map((sec) => {
              // Mini-Aggregate pro Sektion für die Header-Pille.
              const avgTrend = Math.round(
                sec.list.reduce((s, p) => s + (p.extra?.stats?.trendScore ?? 0), 0) /
                  sec.list.length,
              );
              return (
                <div key={sec.key} className="space-y-1.5">
                  <div className="flex items-center gap-2 pb-1.5 border-b border-white/10">
                    <Layers className="w-3.5 h-3.5 text-purple-300" />
                    <h2 className="text-[12px] font-bold uppercase tracking-widest text-zinc-200">
                      {sec.key}
                    </h2>
                    <span className="text-[10px] text-zinc-500">
                      {sec.list.length} {sec.list.length === 1 ? "Produkt" : "Produkte"}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-200 border border-purple-500/20">
                      <Activity className="w-2.5 h-2.5" />
                      Ø {avgTrend}% Trend
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {sec.list.map((produkt, idx) => (
                      <ProduktRow
                        key={produkt.id}
                        produkt={produkt}
                        rank={idx + 1}
                        hasShopifyToken={hasShopifyToken}
                        onInfo={(p) => setInfoModal({ open: true, produkt: p })}
                        onImport={(p) => {
                          setAiModal({ open: true, produkt: p });
                          setAiResult(null);
                          setAiError("");
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flache, sortierte Rangliste über alle gefilterten Produkte.
          <div className="space-y-1.5">
            {filteredProdukte.map((produkt, idx) => (
              <ProduktRow
                key={produkt.id}
                produkt={produkt}
                rank={idx + 1}
                hasShopifyToken={hasShopifyToken}
                onInfo={(p) => setInfoModal({ open: true, produkt: p })}
                onImport={(p) => {
                  setAiModal({ open: true, produkt: p });
                  setAiResult(null);
                  setAiError("");
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ─── INFO MODAL ───────────────────────────────────────── */}
      <AnimatePresence>
        {infoModal.open && p && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setInfoModal({ open: false, produkt: null })}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setInfoModal({ open: false, produkt: null })} className="absolute top-4 right-4 z-10 p-1.5 bg-zinc-800 rounded-full"><X className="w-4 h-4" /></button>

              <div className="p-4 pb-0">
                {/* `key` mountet die Slideshow für jedes Produkt neu —
                    so wird das "broken"-Set / der idx sauber zurückgesetzt. */}
                <ImageSlideshow key={p.id} images={allImages} />
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-bold leading-tight">{displayTitle(p)}</h3>
                  {p.beschreibung && <div className="text-sm text-zinc-400 mt-2 leading-relaxed [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-200 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-2 [&_strong]:font-semibold [&_strong]:text-zinc-200" dangerouslySetInnerHTML={{ __html: p.beschreibung }} />}
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
                        <div className="text-lg font-bold text-emerald-400">+{p.extra.finances.profitMargin.toFixed(2)}&euro;</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2 py-1.5 mt-1">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      <span>Preise sind Richtwerte &mdash; der reale Preis kann schwanken.</span>
                    </div>
                  </div>
                )}

                {/* ─── Markt / Saison / Wachstum ────────────────── */}
                <DeepStatsBlock ds={p.extra?.deepStats} />

                {/* ─── Zielgruppe + Targeting ───────────────────── */}
                <AudienceBlock a={p.extra?.audience} />

                {/* ─── Ad-Strategie (Budget + Format + Hooks) ──── */}
                <AdStrategyBlock s={p.extra?.adStrategy} />

                {/* ─── Beispiel-Ads (Social Media) ──────────────── */}
                <AdsBlock ads={p.extra?.ads} />

                {/* ─── Beispiel-Dropshipping-Shop ───────────────── */}
                <DropshippingBlock
                  example={p.extra?.links?.dropshippingExample}
                  status={p.extra?.linkStatus?.dropshippingExampleOk}
                />

                {/* ─── AliExpress Links (Kategorie + Produkt) ───── */}
                {/* Kategorie wird synthetisiert wenn nicht gespeichert —
                    so funktioniert auch für alte Produkte ohne `links`. */}
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

                <p className="text-[11px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-4">
                  Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, können reale Einkaufspreise, Verfügbarkeiten und die Marktsättigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie für spezifische Umsätze oder Profite dar.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── AI IMPORT MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {aiModal.open && aiModal.produkt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => { if (!aiLoading && !aiImporting) setAiModal({ open: false, produkt: null }); }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg relative max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => { if (!aiLoading && !aiImporting) setAiModal({ open: false, produkt: null }); }} className="absolute top-4 right-4 z-10 p-1.5 bg-zinc-800 rounded-full"><X className="w-4 h-4" /></button>

              <div className="p-6 space-y-5">
                {/* Product Preview */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden shrink-0">
                    <Thumb src={aiModal.produkt.bildUrl} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{aiResult?.title || displayTitle(aiModal.produkt)}</h3>
                    <p className="text-sm text-[#95BF47] font-semibold" title="Preis kann schwanken">
                      {aiModal.produkt.extra?.finances?.recommendedSellPrice || aiModal.produkt.preis || "—"}&euro;
                      <span className="text-[10px] text-zinc-500 ml-1">~ kann schwanken</span>
                    </p>
                  </div>
                </div>

                {aiError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{aiError}
                  </div>
                )}

                {/* AI Result Preview */}
                {aiResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-purple-400">
                      <Sparkles className="w-4 h-4" />KI-optimierter Text
                    </div>
                    <div className="bg-zinc-800/80 border border-zinc-700 rounded-xl p-4 max-h-60 overflow-y-auto">
                      <h4 className="font-bold text-sm mb-2">{aiResult.title}</h4>
                      <div className="text-xs text-zinc-400 leading-relaxed prose-invert" dangerouslySetInnerHTML={{ __html: aiResult.body_html }} />
                    </div>
                    {aiResult.tags && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiResult.tags.split(",").map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-300 text-[10px] rounded-full">{tag.trim()}</span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        setAiImporting(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id, optimizedTitle: aiResult.title, optimizedBodyHtml: aiResult.body_html }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "Import fehlgeschlagen"); return; }
                          setAiModal({ open: false, produkt: null });
                          setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || aiModal.produkt!.aliExpressLink || "" });
                        } catch { setAiError("Import fehlgeschlagen."); }
                        finally { setAiImporting(false); }
                      }}
                      disabled={aiImporting}
                      className="w-full btn-accent py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {aiImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Rocket className="w-4 h-4" />KI-Text importieren</>}
                    </button>
                  </div>
                )}

                {/* Action Buttons (before AI result) */}
                {!aiResult && (
                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        setAiLoading(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/ai-optimize", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "KI-Optimierung fehlgeschlagen"); return; }
                          setAiResult(data.optimized);
                        } catch { setAiError("Verbindung fehlgeschlagen."); }
                        finally { setAiLoading(false); }
                      }}
                      disabled={aiLoading || aiImporting}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2.5 bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 transition disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />KI analysiert Produkt...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" />KI-Optimierung<ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800" /></div>
                      <div className="relative flex justify-center text-xs"><span className="px-3 bg-zinc-900 text-zinc-600">oder</span></div>
                    </div>

                    <button
                      onClick={async () => {
                        setAiImporting(true); setAiError("");
                        try {
                          const res = await fetch("/api/products/import", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ produktId: aiModal.produkt!.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAiError(data.error || "Import fehlgeschlagen"); return; }
                          setAiModal({ open: false, produkt: null });
                          setSuccessModal({ open: true, aliExpressLink: data.aliExpressLink || aiModal.produkt!.aliExpressLink || "" });
                        } catch { setAiError("Import fehlgeschlagen."); }
                        finally { setAiImporting(false); }
                      }}
                      disabled={aiLoading || aiImporting}
                      className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2.5 glass border border-white/10 text-zinc-300 hover:bg-white/5 transition disabled:opacity-50"
                    >
                      {aiImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Rocket className="w-5 h-5" />Direkt-Import (Skip AI)</>}
                    </button>

                    <p className="text-[10px] text-zinc-600 text-center">KI-Optimierung nutzt DeepSeek AI, um Titel &amp; Beschreibung verkaufsstark zu formulieren. (3x pro Monat verfügbar)</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SUCCESS MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {successModal.open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md relative">
              <button onClick={() => setSuccessModal({ open: false, aliExpressLink: "" })} className="absolute top-4 right-4 text-zinc-500"><X className="w-5 h-5" /></button>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 mb-4"><Check className="w-7 h-7 text-emerald-400" /></div>
                <h3 className="text-lg font-bold">Produkt erfolgreich importiert!</h3>
                <p className="text-zinc-400 text-sm mt-2">Kopiere den Link und füge ihn in DSers ein:</p>
              </div>
              {successModal.aliExpressLink && (
                <>
                  <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-xl p-3">
                    <input type="text" value={successModal.aliExpressLink} readOnly className="flex-1 bg-transparent text-sm text-zinc-300 outline-none truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(successModal.aliExpressLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 p-2 rounded-lg">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
                    </button>
                  </div>
                  <a href={successModal.aliExpressLink} target="_blank" rel="noopener noreferrer" className="mt-3 w-full py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-zinc-300">
                    <ExternalLink className="w-4 h-4" />Link öffnen
                  </a>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
