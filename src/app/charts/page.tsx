"use client";

// ─── /charts — Zufalls-Generator ("Produkt-Drop") ───────────────
// Pro Zug (50 Credits) kommt EIN zufälliges Produkt raus, das der
// Account noch nie gezogen hat (Server garantiert kein Doppel-Ziehen).
// Das gezogene Produkt zeigt im Detail-Modal WIEDER ALLE Inhalte der
// früheren Charts-Ansicht: Premium-Analytics, Marge/Finanzen, Markt &
// Saison, Zielgruppe, Ad-Strategie, Beispiel-Ads, Dropshipping-Shops,
// AliExpress-Quellen, Votes und Compliance-Hinweise — alles nutzbar.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Gift,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  Lock,
  AlertCircle,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  BarChart3,
  Target,
  PieChart,
  Link2,
  Store,
  Music2,
  Camera,
  Users,
  PlayCircle,
  Megaphone,
  Calendar,
  Crosshair,
  Eye,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";

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

const ACCENT = "#95BF47";
// Künstlich verlangsamte Zieh-Animation — der Drop soll sich wertig
// anfühlen statt sofort durchzurattern. Dauer in ms.
const SPIN_MS = 3600;
// Status-Texte, die während des Ziehens nacheinander durchlaufen.
const SPIN_STEPS = [
  "Mische alle Produkte…",
  "Analysiere Trends & Margen…",
  "Würfle deinen Drop aus…",
  "Fast fertig…",
];

const MONTH_LABEL_DE = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

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

// ─── Helpers ─────────────────────────────────────────────────────

function looksLikeAutoId(s: string): boolean {
  return /^prod_\d+(_[a-z0-9]+)?$/i.test((s || "").trim());
}
function displayTitle(p: Produkt): string {
  const t = (p.titel || "").trim();
  if (!t || looksLikeAutoId(t)) return "Produkt-Details werden ergänzt…";
  return t;
}
function synthesizeAliCategoryLink(p: Produkt): string {
  const q = (p.sku || p.titel || "").trim();
  if (!q || looksLikeAutoId(q)) return "";
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}`;
}
/** Marge in Prozent (Aufschlag auf den Einkaufspreis). */
function marginPercent(p: Produkt): number {
  const f = p.extra?.finances;
  if (!f) return 0;
  const buy = f.buyPrice ?? 0;
  const margin = f.profitMargin ?? 0;
  if (buy <= 0) return 0;
  return Math.round((margin / buy) * 100);
}
function rawVoteScore(v?: ProduktVotes): number {
  if (!v) return 0;
  return (v.ups ?? 0) - (v.downs ?? 0) + (v.manualBoost ?? 0);
}
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function seedScore(p: Produkt): number {
  const trend = Math.max(0, Math.min(100, p.extra?.stats?.trendScore ?? 50));
  const viral = Math.max(0, Math.min(100, p.extra?.stats?.viralScore ?? 50));
  const impulse = Math.max(0, Math.min(100, p.extra?.stats?.impulseBuyFactor ?? 50));
  const problem = Math.max(0, Math.min(100, p.extra?.stats?.problemSolverIndex ?? 50));
  const compInv = Math.max(0, Math.min(100, 100 - (p.extra?.deepStats?.competition ?? 50)));
  const growth = Math.max(0, Math.min(100, Math.max(0, p.extra?.deepStats?.growth90d ?? 0) / 2));
  const quality =
    (trend * 0.25 + viral * 0.2 + impulse * 0.15 + problem * 0.1 + compInv * 0.15 + growth * 0.15) / 100;
  const h = simpleHash(p.id);
  const hashSpread = h % 311;
  const qualityBoost = Math.round((quality - 0.5) * 100);
  const noise = ((h >> 8) % 31) - 15;
  return Math.max(20, Math.min(350, 20 + hashSpread + qualityBoost + noise));
}
function displayedScore(p: Produkt, v?: ProduktVotes): number {
  return rawVoteScore(v) + seedScore(p);
}

// ═══════════════════════════════════════════════════════════════
//  Main page
// ═══════════════════════════════════════════════════════════════

export default function ChartsPage() {
  const router = useRouter();
  const credits = useCredits();

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [notEnough, setNotEnough] = useState(false);

  const [drawn, setDrawn] = useState<Produkt[]>([]);
  const [drawnCount, setDrawnCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [cost, setCost] = useState(50);

  const [drawing, setDrawing] = useState(false);
  const [revealed, setRevealed] = useState<Produkt | null>(null);
  // True sobald ein Zug-Versuch zurückkommt, dass schon alles gezogen ist.
  const [unavailable, setUnavailable] = useState(false);
  const [infoModal, setInfoModal] = useState<{ open: boolean; produkt: Produkt | null }>({
    open: false,
    produkt: null,
  });

  // Votes (Pfeil-Highlight + optimistic Score).
  const [userVotes, setUserVotes] = useState<Record<string, "up" | "down">>({});
  const [voteOverrides, setVoteOverrides] = useState<Record<string, ProduktVotes>>({});

  // ── Initial state laden ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/charts/draw", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setLocked(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.error || "Konnte nicht laden.");
          return;
        }
        setDrawn(data.drawn ?? []);
        setDrawnCount(data.drawnCount ?? 0);
        setTotalCount(data.totalCount ?? 0);
        setRemainingCount(data.remainingCount ?? 0);
        if (typeof data.cost === "number") setCost(data.cost);
      } catch {
        if (!cancelled) setError("Verbindungsfehler.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // Vorab: welche Produkte hat dieser User schon gevotet?
    fetch("/api/products/my-votes")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUserVotes(d.votes || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  const cannotAfford = !credits.loading && credits.balance < cost;

  // ── Zug machen ──
  const handleDraw = useCallback(async () => {
    if (drawing) return;
    setError("");
    setNotEnough(false);
    setUnavailable(false);
    setRevealed(null);
    setDrawing(true);
    const startedAt = Date.now();

    try {
      const res = await fetch("/api/charts/draw", { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      const elapsed = Date.now() - startedAt;
      if (elapsed < SPIN_MS) {
        await new Promise((r) => setTimeout(r, SPIN_MS - elapsed));
      }

      if (res.status === 402) {
        setNotEnough(true);
        if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
        return;
      }
      if (res.status === 409) {
        // Alles gezogen — neutrale Meldung zeigen (Server hat den Admin
        // benachrichtigt). Es wurden keine Credits abgezogen.
        setUnavailable(true);
        setRemainingCount(0);
        if (typeof data.totalCount === "number") setTotalCount(data.totalCount);
        if (typeof data.drawnCount === "number") setDrawnCount(data.drawnCount);
        return;
      }
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      if (!res.ok || !data.produkt) {
        setError(data?.error || "Zug fehlgeschlagen.");
        return;
      }

      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
      const produkt: Produkt = data.produkt;
      setRevealed(produkt);
      setDrawn((prev) => [produkt, ...prev.filter((p) => p.id !== produkt.id)]);
      if (typeof data.drawnCount === "number") setDrawnCount(data.drawnCount);
      if (typeof data.totalCount === "number") setTotalCount(data.totalCount);
      if (typeof data.remainingCount === "number") setRemainingCount(data.remainingCount);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setDrawing(false);
    }
  }, [drawing, credits]);

  // ── Vote-Handler (optimistic + Server) ──
  const getProduktVotes = useCallback(
    (p: Produkt): ProduktVotes => voteOverrides[p.id] || p.extra?.votes || {},
    [voteOverrides],
  );

  const handleVote = useCallback(
    async (produktId: string, direction: "up" | "down") => {
      const prev = userVotes[produktId];
      const produkt = drawn.find((p) => p.id === produktId) || (revealed?.id === produktId ? revealed : null);
      if (!produkt) return;
      const currentVotes: ProduktVotes =
        voteOverrides[produktId] || produkt.extra?.votes || { ups: 0, downs: 0 };
      let ups = currentVotes.ups ?? 0;
      let downs = currentVotes.downs ?? 0;
      let newVote: "up" | "down" | null = direction;
      if (prev === direction) {
        if (direction === "up") ups = Math.max(0, ups - 1);
        else downs = Math.max(0, downs - 1);
        newVote = null;
      } else {
        if (prev === "up") ups = Math.max(0, ups - 1);
        else if (prev === "down") downs = Math.max(0, downs - 1);
        if (direction === "up") ups += 1;
        else downs += 1;
      }
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
      try {
        const res = await fetch("/api/products/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ produktId, direction }),
        });
        if (res.ok) {
          const d = await res.json();
          setVoteOverrides((m) => ({
            ...m,
            [produktId]: { ups: d.ups, downs: d.downs, manualBoost: d.manualBoost },
          }));
          setUserVotes((m) => {
            const next = { ...m };
            if (d.userVote) next[produktId] = d.userVote;
            else delete next[produktId];
            return next;
          });
        } else {
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
        /* optimistic bleibt, reconcile beim Reload */
      }
    },
    [userVotes, drawn, revealed, voteOverrides],
  );

  const progress = totalCount > 0 ? Math.round((drawnCount / totalCount) * 100) : 0;
  const openInfo = useCallback((p: Produkt) => setInfoModal({ open: true, produkt: p }), []);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-7">
          {/* Header */}
          <header className="mb-5 sm:mb-7 text-center">
            <div
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
              style={{ color: ACCENT }}
            >
              <Sparkles className="w-3 h-3" />
              Winning Drop
            </div>
            <h1 className="text-[24px] sm:text-[32px] font-bold tracking-tight text-white leading-tight font-sf-display">
              Zufalls-Generator
            </h1>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-400 leading-snug max-w-md mx-auto">
              Ein Klick, ein zufälliges Winning-Produkt — jeder Zug kostet{" "}
              <span className="font-semibold text-white">{cost} Credits</span>. Du kannst kein
              Produkt doppelt ziehen. Alle Produkt-Details siehst du nach dem Zug.
            </p>
          </header>

          {locked ? (
            <LockedCard />
          ) : (
            <>
              {/* Drop-Maschine */}
              <section
                data-tour="charts"
                className="glass-strong rounded-3xl border border-white/[0.08] p-5 sm:p-8 relative overflow-hidden accent-ring"
              >
                <div
                  className="absolute inset-0 opacity-60 pointer-events-none"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(149,191,71,0.12), transparent 60%)" }}
                />

                <div className="relative flex flex-col items-center">
                  <DropStage drawing={drawing} revealed={revealed} onOpen={openInfo} />

                  {/* Fortschritt */}
                  {!loading && totalCount > 0 && (
                    <div className="w-full max-w-sm mt-6">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                        <span>{drawnCount} von {totalCount} gezogen</span>
                        <span className="font-mono" style={{ color: ACCENT }}>{remainingCount} übrig</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: ACCENT }}
                          initial={false}
                          animate={{ width: `${progress}%` }}
                          transition={{ type: "spring", stiffness: 120, damping: 20 }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Aktion */}
                  <div className="mt-6 w-full max-w-sm">
                    <button
                      onClick={handleDraw}
                      disabled={drawing || loading || cannotAfford}
                      className="btn-deploy w-full flex items-center justify-center gap-2 py-3.5 text-[15px] disabled:cursor-not-allowed"
                    >
                      {drawing ? (
                        <>
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            className="inline-flex"
                          >
                            <Sparkles className="w-4 h-4" />
                          </motion.span>
                          Ziehe…
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          {revealed ? "Nochmal ziehen" : "Produkt ziehen"}
                          <span className="font-mono opacity-80">· {cost} 🪙</span>
                        </>
                      )}
                    </button>

                    {unavailable && (
                      <div className="mt-3 text-center rounded-2xl border border-white/[0.08] bg-white/[0.03] py-4 px-4">
                        <Info className="w-5 h-5 mx-auto mb-1.5 text-zinc-400" />
                        <p className="text-sm font-semibold text-white">
                          Das ist aktuell leider nicht möglich, schau später wieder vorbei.
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-1">Es wurden keine Credits abgezogen.</p>
                      </div>
                    )}

                    {cannotAfford && (
                      <p className="mt-2.5 text-center text-[11px] text-amber-300/90">
                        Nicht genug Credits ({credits.balance}/{cost}).{" "}
                        <Link href="/credits" className="underline font-semibold hover:text-amber-200">
                          Credits aufladen
                        </Link>
                      </p>
                    )}
                    {notEnough && !cannotAfford && (
                      <p className="mt-2.5 text-center text-[11px] text-amber-300/90">
                        Dein Saldo reicht nicht.{" "}
                        <Link href="/credits" className="underline font-semibold hover:text-amber-200">
                          Credits aufladen
                        </Link>
                      </p>
                    )}
                    {error && (
                      <p className="mt-2.5 text-center text-[11px] text-red-400 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {error}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Verlauf */}
              {drawn.length > 0 && (
                <section className="mt-7">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="w-4 h-4" style={{ color: ACCENT }} />
                    <h2 className="text-sm font-semibold text-white">Meine Drops</h2>
                    <span className="text-[11px] text-zinc-500">({drawn.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {drawn.map((p) => (
                      <HistoryCard key={p.id} produkt={p} onOpen={openInfo} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>

      {/* Detail-Modal mit ALLEN Produktinhalten */}
      <AnimatePresence>
        {infoModal.open && infoModal.produkt && (
          <DetailModal
            produkt={infoModal.produkt}
            votes={getProduktVotes(infoModal.produkt)}
            userVote={userVotes[infoModal.produkt.id] || null}
            onVote={(d) => infoModal.produkt && handleVote(infoModal.produkt.id, d)}
            onClose={() => setInfoModal({ open: false, produkt: null })}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Generator-Bühne + Karten
// ═══════════════════════════════════════════════════════════════

function DropStage({
  drawing,
  revealed,
  onOpen,
}: {
  drawing: boolean;
  revealed: Produkt | null;
  onOpen: (p: Produkt) => void;
}) {
  return (
    <div className="w-full flex items-center justify-center min-h-[220px]">
      <AnimatePresence mode="wait">
        {drawing ? (
          <motion.div
            key="spinner"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-28 h-28 flex items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(from 0deg, transparent, ${ACCENT}, transparent)`,
                  maskImage: "radial-gradient(transparent 56%, #000 58%)",
                  WebkitMaskImage: "radial-gradient(transparent 56%, #000 58%)",
                }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
              />
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut" }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--accent-light)" }}
              >
                <Gift className="w-7 h-7" style={{ color: ACCENT }} />
              </motion.div>
            </div>
            <SpinningStatus />
          </motion.div>
        ) : revealed ? (
          <motion.div
            key={`reveal-${revealed.id}`}
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-full"
          >
            <RevealCard produkt={revealed} onOpen={onOpen} />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              className="w-24 h-24 rounded-3xl flex items-center justify-center pulse-glow"
              style={{ background: "var(--accent-light)", border: `1px solid ${ACCENT}33` }}
            >
              <Gift className="w-10 h-10" style={{ color: ACCENT }} />
            </motion.div>
            <p className="mt-4 text-[12px] text-zinc-500 max-w-[15rem]">
              Drück auf „Produkt ziehen“ und lass den Zufall ein Winning-Produkt für dich aussuchen.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Zyklische Status-Texte während des Ziehens. Eigene Komponente, damit
// sie bei jedem Zug frisch mountet (stepIdx startet bei 0) — so müssen
// wir kein setState synchron im Effekt aufrufen.
function SpinningStatus() {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const per = Math.max(700, Math.floor(SPIN_MS / SPIN_STEPS.length));
    const t = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, SPIN_STEPS.length - 1)),
      per,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={stepIdx}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="mt-4 text-[12px] text-zinc-400"
      >
        {SPIN_STEPS[stepIdx]}
      </motion.p>
    </AnimatePresence>
  );
}

function RevealCard({ produkt, onOpen }: { produkt: Produkt; onOpen: (p: Produkt) => void }) {
  const [copied, setCopied] = useState(false);
  const trend = produkt.extra?.stats?.trendScore;
  const margin = marginPercent(produkt);

  const copySku = async () => {
    try {
      await navigator.clipboard.writeText(produkt.sku || produkt.titel);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <ProductImage src={produkt.bildUrl} alt={produkt.titel} className="sm:w-44 h-44 sm:h-auto shrink-0" />
        <div className="flex-1 p-4 min-w-0">
          <div
            className="inline-flex items-center gap-1 text-[9px] uppercase tracking-[0.16em] font-bold mb-1.5"
            style={{ color: ACCENT }}
          >
            <Sparkles className="w-3 h-3" /> Dein Drop
          </div>
          <h3 className="text-[15px] font-semibold text-white leading-snug line-clamp-2">
            {displayTitle(produkt)}
          </h3>
          {produkt.preis && <div className="mt-1.5 text-[13px] font-mono text-zinc-300">{produkt.preis}</div>}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {typeof trend === "number" && (
              <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full bg-[#95BF47]/10 border border-[#95BF47]/25 text-[#cfe9a3]">
                <TrendingUp className="w-2.5 h-2.5" /> Trend {Math.round(trend)}
              </span>
            )}
            {margin > 0 && (
              <span className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-200">
                <DollarSign className="w-2.5 h-2.5" /> +{margin}% Marge
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onOpen(produkt)}
              className="btn-deploy flex items-center gap-1.5 px-3.5 py-2 text-[12px]"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Alle Details ansehen
            </button>
            {produkt.aliExpressLink && (
              <a
                href={produkt.aliExpressLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] border border-white/[0.10] text-white hover:bg-white/[0.10] transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Quelle
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}
            <button
              onClick={copySku}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-medium bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} /> Kopiert
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> SKU
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ produkt, onOpen }: { produkt: Produkt; onOpen: (p: Produkt) => void }) {
  return (
    <button
      onClick={() => onOpen(produkt)}
      className="group text-left rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/[0.14] transition"
    >
      <ProductImage src={produkt.bildUrl} alt={produkt.titel} className="aspect-square w-full" />
      <div className="p-2.5">
        <p className="text-[12px] font-medium text-zinc-200 leading-tight line-clamp-2">
          {displayTitle(produkt)}
        </p>
        {produkt.preis && <p className="mt-1 text-[11px] font-mono text-zinc-500">{produkt.preis}</p>}
        <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-zinc-500 group-hover:text-[#95BF47] transition">
          <BarChart3 className="w-2.5 h-2.5" /> Details
        </span>
      </div>
    </button>
  );
}

function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.03] ${className ?? ""}`}
        style={{ background: "radial-gradient(circle at 50% 40%, rgba(149,191,71,0.12), rgba(255,255,255,0.02))" }}
      >
        <ShoppingBag className="w-7 h-7 text-zinc-600" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`object-cover bg-white/[0.02] ${className ?? ""}`}
    />
  );
}

function LockedCard() {
  return (
    <section className="glass-strong rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">Teil der Brospify Membership</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        Der Zufalls-Generator ist Teil deiner Membership. Aktiviere dein Abo, um Winning-Produkte zu
        ziehen.
      </p>
      <Link href="/account/subscription" className="btn-deploy inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-sm">
        <Sparkles className="w-4 h-4" />
        Membership ansehen
      </Link>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Detail-Modal (alle Produktinhalte) + Detail-Blöcke
//  (1:1 aus der früheren Charts-Ansicht übernommen)
// ═══════════════════════════════════════════════════════════════

function DetailModal({
  produkt: p,
  votes,
  userVote,
  onVote,
  onClose,
}: {
  produkt: Produkt;
  votes: ProduktVotes;
  userVote: "up" | "down" | null;
  onVote: (direction: "up" | "down") => void;
  onClose: () => void;
}) {
  const allImages = useMemo(
    () => [...new Set([p.bildUrl, ...(p.extra?.images || [])].filter(Boolean))],
    [p],
  );

  const ads = p.extra?.ads;
  const hasAds =
    !!ads &&
    ((ads.tiktok?.length ?? 0) > 0 ||
      (ads.instagram?.length ?? 0) > 0 ||
      (ads.facebook?.length ?? 0) > 0 ||
      (ads.youtube?.length ?? 0) > 0);
  const hasShops =
    (p.extra?.links?.dropshippingExamples?.length ?? 0) > 0 || !!p.extra?.links?.dropshippingExample?.url;
  const hasDeepStats =
    !!p.extra?.deepStats &&
    ((p.extra.deepStats.competition ?? 0) > 0 ||
      (p.extra.deepStats.seasonality ?? 0) > 0 ||
      (p.extra.deepStats.repeatPurchaseRate ?? 0) > 0 ||
      (p.extra.deepStats.peakMonths?.length ?? 0) > 0);
  const hasAudience = !!p.extra?.audience?.primary;
  const hasAdStrategy = !!p.extra?.adStrategy?.bestFormat || (p.extra?.adStrategy?.adHooks?.length ?? 0) > 0;
  const isLegacy = !hasAds && !hasShops && !hasDeepStats && !hasAudience && !hasAdStrategy;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-xl relative max-h-[92vh] sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-1.5 bg-zinc-800 rounded-full"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-3 sm:p-4 pb-0 space-y-2">
          <ImageSlideshow key={p.id} images={allImages} />
          <p className="text-[10px] text-zinc-500 italic leading-snug flex items-start gap-1 px-1">
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              Bilder dienen als Beispiel / Inspiration. Das tatsächliche Produkt deines Lieferanten kann
              abweichen — manche Bilder zeigen ähnliche oder verwandte Produkte aus dem US-Markt.
            </span>
          </p>
        </div>

        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
              <h3 className="text-lg sm:text-xl font-bold leading-tight flex-1 min-w-0 break-words">
                {displayTitle(p)}
              </h3>
              <div className="shrink-0 self-start">
                <VoteButtons produkt={p} votes={votes} userVote={userVote} onVote={onVote} size="md" />
              </div>
            </div>
            {p.beschreibung && (
              <div
                className="text-sm text-zinc-400 mt-2 leading-relaxed break-words [&_p]:my-2 [&_p]:break-words [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_li]:break-words [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-zinc-200 [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-zinc-200 [&_h3]:mt-2 [&_strong]:font-semibold [&_strong]:text-zinc-200 [&_a]:underline [&_a]:break-all"
                dangerouslySetInnerHTML={{ __html: p.beschreibung }}
              />
            )}
            {(!p.beschreibung || looksLikeAutoId(p.titel)) && (
              <p className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mt-2 flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Dieses Produkt hat noch unvollständige Daten. Wir aktualisieren das in Kürze.</span>
              </p>
            )}
          </div>

          {p.extra?.stats && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#95BF47]" />
                Premium Analytics
              </h4>
              <div className="space-y-3">
                <StatBar label="Trend-Score" value={p.extra.stats.trendScore} icon={TrendingUp} color="text-[#95BF47]" delay={50} />
                <StatBar label="Viralitäts-Score" value={p.extra.stats.viralScore} icon={Zap} color="text-purple-400" delay={150} />
                <StatBar label="Impulskauf-Faktor" value={p.extra.stats.impulseBuyFactor} icon={ShoppingBag} color="text-amber-400" delay={300} />
                <StatBar label="Problemlöser-Index" value={p.extra.stats.problemSolverIndex} icon={Target} color="text-emerald-400" delay={450} />
                <StatBar label="Marktsättigung" value={p.extra.stats.marketSaturation} icon={PieChart} color="text-red-400" delay={600} />
              </div>
            </div>
          )}

          {p.extra?.finances && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Marge &amp; Finanzen
              </h4>
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
                  <div className="text-lg font-bold text-emerald-400">+{marginPercent(p)}%</div>
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

          {isLegacy ? (
            <div className="flex items-start gap-2 px-3 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-zinc-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
              <div className="text-xs leading-relaxed">
                <strong className="text-zinc-200">Keine erweiterten Daten verfügbar.</strong>
                <p className="mt-0.5 text-zinc-400">
                  Dieses Produkt wurde vor dem letzten großen Update angelegt — Beispiel-Ads, Dropshipping-Shop-Beispiele,
                  Zielgruppen-Analyse, Ad-Strategie und Markt-Daten sind hier nicht verfügbar.
                </p>
              </div>
            </div>
          ) : (
            <>
              <DeepStatsBlock ds={p.extra?.deepStats} />
              <AudienceBlock a={p.extra?.audience} />
              <AdStrategyBlock s={p.extra?.adStrategy} />
              <AdsBlock ads={p.extra?.ads} />
              <DropshippingBlock
                examples={p.extra?.links?.dropshippingExamples}
                legacy={p.extra?.links?.dropshippingExample}
                status={p.extra?.linkStatus?.dropshippingExampleOk}
              />
            </>
          )}

          <div className="space-y-2">
            <AliLinksBlock
              produktLink={p.extra?.links?.aliExpressProduct || p.aliExpressLink}
              kategorieLink={p.extra?.links?.aliExpressCategory || synthesizeAliCategoryLink(p)}
              productOk={p.extra?.linkStatus?.aliExpressProductOk}
              categoryOk={p.extra?.linkStatus?.aliExpressCategoryOk}
            />
            <p className="text-[10px] text-zinc-500 italic leading-snug flex items-start gap-1 px-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Die AliExpress-Links sind <strong className="text-zinc-400">Beispiele</strong> für mögliche Lieferanten
                dieses Trends — das konkrete Produkt deines gewählten Sellers kann in Details abweichen.
              </span>
            </p>
          </div>

          <ComplianceBlock category={p.sku} />

          <p className="text-[11px] text-zinc-600 leading-relaxed">
            Hinweis: Alle dargestellten Metriken, Margen und Scores basieren auf unseren internen Marktanalysen und
            aktuellen E-Commerce-Trends. Da der Markt dynamisch ist, können reale Einkaufspreise, Verfügbarkeiten und die
            Marktsättigung variieren. Diese Daten dienen als strategische Empfehlung und stellen keine Garantie für
            spezifische Umsätze oder Profite dar.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Stat Bar ────────────────────────────────────────────────────
function StatBar({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number;
  icon: typeof Zap;
  color: string;
  delay: number;
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
            value >= 80
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : value >= 50
                ? "bg-gradient-to-r from-amber-500 to-amber-400"
                : "bg-gradient-to-r from-red-500 to-red-400"
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
function ImageSlideshow({ images: initial }: { images: string[] }) {
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const [idx, setIdx] = useState(0);
  const images = useMemo(() => initial.filter((u) => !broken.has(u)), [initial, broken]);

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
    setIdx((cur) => {
      const remaining = initial.filter((u) => u !== failedUrl && !broken.has(u)).length;
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
          <button
            onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % images.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((u, i) => (
              <button
                key={u}
                onClick={() => setIdx(i)}
                className={`w-2 h-2 rounded-full ${i === idx ? "bg-white" : "bg-white/30"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Vote Buttons ────────────────────────────────────────────────
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
        onClick={(e) => {
          e.stopPropagation();
          onVote("up");
        }}
        title="Hochpushen"
        className={`${padCls} rounded-l-md transition ${
          upActive ? "text-emerald-300 bg-emerald-500/15" : "text-zinc-400 hover:text-emerald-300 hover:bg-white/5"
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
        onClick={(e) => {
          e.stopPropagation();
          onVote("down");
        }}
        title="Runter pushen"
        className={`${padCls} rounded-r-md transition ${
          downActive ? "text-red-300 bg-red-500/15" : "text-zinc-400 hover:text-red-300 hover:bg-white/5"
        }`}
      >
        <ArrowDownRight className={iconCls} />
      </button>
    </div>
  );
}

// ─── Ads Block ───────────────────────────────────────────────────
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
            <div key={p.key} className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center ${p.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-zinc-200">{p.label}</span>
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

// ─── Dropshipping shops ──────────────────────────────────────────
function DropshippingBlock({
  examples,
  legacy,
  status,
}: {
  examples?: { url: string; title?: string }[];
  legacy?: { url: string; title?: string };
  status?: boolean;
}) {
  const list = examples && examples.length > 0 ? examples : legacy?.url ? [legacy] : [];
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
          try {
            host = new URL(ex.url).hostname.replace(/^www\./, "");
          } catch {}
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

// ─── AliExpress links ────────────────────────────────────────────
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

// ─── Deep stats (Markt / Saison / Wachstum) ─────────────────────
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
        Markt &amp; Saison
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {typeof ds.competition === "number" && (
          <MiniMeter label="Konkurrenz" value={ds.competition} invert icon={Crosshair} />
        )}
        {typeof ds.seasonality === "number" && (
          <MiniMeter label="Saison" value={ds.seasonality} icon={Calendar} />
        )}
        {typeof ds.repeatPurchaseRate === "number" && (
          <MiniMeter label="Rückkauf" value={ds.repeatPurchaseRate} icon={Award} />
        )}
        {typeof ds.growth90d === "number" && (
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Wachstum 90T</span>
              {ds.growth90d >= 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-400" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-400" />
              )}
            </div>
            <div className={`text-base font-bold tabular-nums ${ds.growth90d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {ds.growth90d > 0 ? "+" : ""}
              {ds.growth90d}%
            </div>
          </div>
        )}
      </div>
      {Array.isArray(ds.peakMonths) && ds.peakMonths.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5">Peak-Monate</div>
          <div className="grid grid-cols-12 gap-0.5">
            {MONTH_LABEL_DE.map((m, i) => {
              const isPeak = peakSet.has(i + 1);
              return (
                <div
                  key={m}
                  className={`text-center text-[9px] py-1 rounded ${
                    isPeak ? "bg-purple-500/25 text-purple-100 font-semibold" : "bg-white/[0.02] text-zinc-600"
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
  const v = Math.max(0, Math.min(100, value));
  const score = invert ? 100 - v : v;
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</span>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {v}%
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-1">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── Audience ────────────────────────────────────────────────────
function AudienceBlock({ a }: { a?: ProduktAudience }) {
  if (!a) return null;
  const has = a.primary || a.ageRange || a.painPoint || (a.interests && a.interests.length > 0);
  if (!has) return null;
  const genderLabel =
    a.genderSkew === "male" ? "Männlich" : a.genderSkew === "female" ? "Weiblich" : "Ausgeglichen";
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-300" />
        Zielgruppe &amp; Targeting
      </h4>
      {a.primary && <div className="text-sm text-zinc-200 font-medium">{a.primary}</div>}
      <div className="grid grid-cols-2 gap-2">
        {a.ageRange && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">Alter</div>
            <div className="text-sm font-bold text-zinc-100">{a.ageRange}</div>
          </div>
        )}
        {a.genderSkew && (
          <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">Geschlecht</div>
            <div className="text-sm font-bold text-zinc-100">{genderLabel}</div>
          </div>
        )}
      </div>
      {a.painPoint && (
        <div className="rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2 text-xs text-zinc-300 leading-relaxed">
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-0.5">Pain-Point</div>
          {a.painPoint}
        </div>
      )}
      {Array.isArray(a.interests) && a.interests.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">Targeting-Interessen</div>
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

// ─── Ad strategy ─────────────────────────────────────────────────
function AdStrategyBlock({ s }: { s?: ProduktAdStrategy }) {
  if (!s) return null;
  const has =
    s.dailyMinEur || s.dailyRecommendedEur || s.estimatedCpmEur || s.bestFormat || (s.adHooks && s.adHooks.length > 0);
  if (!has) return null;
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-amber-300" />
        Ad-Strategie
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <BudgetTile label="Min/Tag" value={`${s.dailyMinEur || 0}€`} sub="Validierung" color="#94A3B8" />
        <BudgetTile label="Empfohlen/Tag" value={`${s.dailyRecommendedEur || 0}€`} sub="Skalierung" color="#F59E0B" />
        <BudgetTile label="CPM" value={`${(s.estimatedCpmEur ?? 0).toFixed(2)}€`} sub="geschätzt" color="#A855F7" />
      </div>
      {s.bestFormat && (
        <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2 text-xs text-amber-100">
          <div className="text-[9px] uppercase tracking-widest text-amber-300/70 font-semibold mb-0.5">Bestes Format</div>
          {s.bestFormat}
        </div>
      )}
      {Array.isArray(s.adHooks) && s.adHooks.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Hook-Beispiele</div>
          {s.adHooks.map((h, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-2.5 py-2">
              <span className="shrink-0 text-[9px] font-bold text-amber-300 mt-0.5">#{i + 1}</span>
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

function BudgetTile({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-lg border p-2 text-center" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
      <div className="text-base font-bold tabular-nums mt-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] text-zinc-600">{sub}</div>
    </div>
  );
}

// ─── Broken link hint ────────────────────────────────────────────
function BrokenLinkHint() {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-lg px-2 py-1.5">
      <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
      <span>Hinweis: Dieser Link ist evtl. nicht mehr verfügbar.</span>
    </div>
  );
}

// ─── Compliance ──────────────────────────────────────────────────
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
  const sevColor =
    hint?.severity === "high"
      ? "text-red-300 bg-red-500/10 border-red-500/25"
      : hint?.severity === "medium"
        ? "text-amber-300 bg-amber-500/10 border-amber-500/25"
        : "text-zinc-300 bg-white/5 border-white/10";
  const sevLabel =
    hint?.severity === "high"
      ? "Hohe Compliance-Anforderung"
      : hint?.severity === "medium"
        ? "Mittlere Compliance-Anforderung"
        : "Standard-Pflichten";
  return (
    <details className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 hover:bg-amber-500/[0.06] transition">
        <Scale className="w-4 h-4 text-amber-300 shrink-0" />
        <span className="text-sm font-semibold text-amber-100">Rechtliche Hinweise &amp; Compliance</span>
        {hint && (
          <span
            className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${sevColor}`}
          >
            <ShieldCheck className="w-2.5 h-2.5" />
            {sevLabel}
          </span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-4 border-t border-amber-500/10">
        {hint && (
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-amber-300/80 font-semibold">
              Spezifisch für „{cat}“
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
          <div className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Gilt für alle Produkte</div>
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
          Dies sind allgemeine Hinweise und ersetzen KEINE Rechtsberatung. Bei Unklarheiten unbedingt einen Anwalt für
          IT-/Vertriebsrecht oder die zuständige Marktüberwachungs­behörde kontaktieren. Beim Dropshipping aus
          Nicht-EU-Ländern bist du als Verkäufer faktisch Importeur und haftest für die Konformität.
        </p>
      </div>
    </details>
  );
}
