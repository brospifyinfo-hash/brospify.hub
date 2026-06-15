"use client";

// ─── /charts — Zufalls-Generator ("Produkt-Drop") ───────────────
// Ersetzt die alte Produkt-Charts. Pro Zug (50 Credits) kommt EIN
// zufälliges Produkt raus, das der Account noch nie gezogen hat.
// Server (/api/charts/draw) garantiert, dass kein Produkt doppelt
// gezogen werden kann. Design bleibt im Hub-Stil: dunkles Glas,
// Brospify-Grün (#95BF47), Framer-Motion-Reveal.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Gift,
  ExternalLink,
  Copy,
  Check,
  Flame,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Award,
  Lock,
  AlertCircle,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";

// ─── Types (Spiegel der API-Projektion) ─────────────────────────
interface DrawnProdukt {
  id: string;
  sku: string;
  titel: string;
  preis: string;
  bildUrl: string;
  beschreibung: string;
  aliExpressLink: string;
  extraImages: string[];
  stats: {
    trendScore: number;
    viralScore: number;
    impulseBuyFactor: number;
    problemSolverIndex: number;
    marketSaturation: number;
  } | null;
  finances: {
    buyPrice: number;
    recommendedSellPrice: number;
    profitMargin: number;
  } | null;
}

const ACCENT = "#95BF47";
const SPIN_MS = 1300; // Mindest-Spin-Dauer, damit der Zug sich lohnt.

export default function ChartsPage() {
  const credits = useCredits();

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [notEnough, setNotEnough] = useState(false);

  const [drawn, setDrawn] = useState<DrawnProdukt[]>([]);
  const [drawnCount, setDrawnCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [cost, setCost] = useState(50);

  const [drawing, setDrawing] = useState(false);
  const [revealed, setRevealed] = useState<DrawnProdukt | null>(null);

  // ── Initial state laden ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/charts/draw", { cache: "no-store" });
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
    return () => {
      cancelled = true;
    };
  }, []);

  const allDrawn = totalCount > 0 && remainingCount <= 0;
  const cannotAfford = !credits.loading && credits.balance < cost;

  // ── Zug machen ──
  const handleDraw = useCallback(async () => {
    if (drawing || allDrawn) return;
    setError("");
    setNotEnough(false);
    setRevealed(null);
    setDrawing(true);
    const startedAt = Date.now();

    try {
      const res = await fetch("/api/charts/draw", { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      // Mindest-Spin abwarten, damit die Animation nicht zu hektisch wirkt.
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

      // Erfolg.
      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
      const produkt: DrawnProdukt = data.produkt;
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
  }, [drawing, allDrawn, credits]);

  const progress = totalCount > 0 ? Math.round((drawnCount / totalCount) * 100) : 0;

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
              <span className="font-semibold text-white">{cost} Credits</span>. Du kannst
              kein Produkt doppelt ziehen.
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
                {/* Hintergrund-Glow */}
                <div
                  className="absolute inset-0 opacity-60 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 0%, rgba(149,191,71,0.12), transparent 60%)",
                  }}
                />

                <div className="relative flex flex-col items-center">
                  <DropStage drawing={drawing} revealed={revealed} />

                  {/* Fortschritt */}
                  {!loading && totalCount > 0 && (
                    <div className="w-full max-w-sm mt-6">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                        <span>
                          {drawnCount} von {totalCount} gezogen
                        </span>
                        <span className="font-mono" style={{ color: ACCENT }}>
                          {remainingCount} übrig
                        </span>
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
                    {allDrawn ? (
                      <div className="text-center rounded-2xl border border-[#95BF47]/25 bg-[#95BF47]/10 py-4 px-4">
                        <div className="text-2xl mb-1">🎉</div>
                        <p className="text-sm font-semibold text-white">
                          Du hast jedes Produkt gezogen!
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Sobald neue Produkte erscheinen, kannst du wieder ziehen.
                        </p>
                      </div>
                    ) : (
                      <>
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

                        {/* Saldo-Hinweis */}
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
                      </>
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
                      <HistoryCard key={p.id} produkt={p} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

// ─── Bühne: Mystery-Box beim Ziehen / Reveal-Karte danach ───────
function DropStage({ drawing, revealed }: { drawing: boolean; revealed: DrawnProdukt | null }) {
  return (
    <div className="w-full flex items-center justify-center min-h-[200px]">
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
              {/* rotierender Ring */}
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
            <p className="mt-4 text-[12px] text-zinc-400">Dein Produkt wird gezogen…</p>
          </motion.div>
        ) : revealed ? (
          <motion.div
            key={`reveal-${revealed.id}`}
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-full"
          >
            <RevealCard produkt={revealed} />
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

// ─── Reveal-Karte (frisch gezogenes Produkt, prominent) ─────────
function RevealCard({ produkt }: { produkt: DrawnProdukt }) {
  const [copied, setCopied] = useState(false);

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
            {produkt.titel || "Unbenanntes Produkt"}
          </h3>
          {produkt.preis && (
            <div className="mt-1.5 text-[13px] font-mono text-zinc-300">{produkt.preis}</div>
          )}

          {produkt.stats && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              <StatBar icon={TrendingUp} label="Trend" value={produkt.stats.trendScore} />
              <StatBar icon={Flame} label="Viral" value={produkt.stats.viralScore} />
              <StatBar icon={Zap} label="Impuls" value={produkt.stats.impulseBuyFactor} />
              <StatBar icon={Award} label="Problemlöser" value={produkt.stats.problemSolverIndex} />
            </div>
          )}

          {produkt.finances && produkt.finances.profitMargin > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-400">
              <DollarSign className="w-3 h-3" style={{ color: ACCENT }} />
              Marge:{" "}
              <span className="font-semibold text-white">
                {Math.round(produkt.finances.profitMargin)} €
              </span>
              {produkt.finances.recommendedSellPrice > 0 && (
                <span className="text-zinc-500">
                  · VK {produkt.finances.recommendedSellPrice} €
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {produkt.aliExpressLink && (
              <a
                href={produkt.aliExpressLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] border border-white/[0.10] text-white hover:bg-white/[0.10] transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Quelle
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

// ─── Verlaufs-Karte (kompakt) ───────────────────────────────────
function HistoryCard({ produkt }: { produkt: DrawnProdukt }) {
  const inner = (
    <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/[0.14] transition">
      <ProductImage src={produkt.bildUrl} alt={produkt.titel} className="aspect-square w-full" />
      <div className="p-2.5">
        <p className="text-[12px] font-medium text-zinc-200 leading-tight line-clamp-2">
          {produkt.titel || "Produkt"}
        </p>
        {produkt.preis && (
          <p className="mt-1 text-[11px] font-mono text-zinc-500">{produkt.preis}</p>
        )}
      </div>
    </div>
  );
  if (produkt.aliExpressLink) {
    return (
      <a href={produkt.aliExpressLink} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return inner;
}

// ─── Stat-Balken ────────────────────────────────────────────────
function StatBar({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
        <span className="flex items-center gap-1">
          <Icon className="w-2.5 h-2.5" style={{ color: ACCENT }} />
          {label}
        </span>
        <span className="font-mono text-zinc-500">{v}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v}%`, background: ACCENT }} />
      </div>
    </div>
  );
}

// ─── Produktbild mit Fallback ───────────────────────────────────
function ProductImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className={`flex items-center justify-center bg-white/[0.03] ${className ?? ""}`}
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(149,191,71,0.12), rgba(255,255,255,0.02))",
        }}
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
      onError={() => setBroken(true)}
      className={`object-cover bg-white/[0.02] ${className ?? ""}`}
    />
  );
}

// ─── Gesperrt (keine aktive Membership) ─────────────────────────
function LockedCard() {
  return (
    <section className="glass-strong rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">Teil der Brospify Membership</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        Der Zufalls-Generator ist Teil deiner Membership. Aktiviere dein Abo, um Winning-Produkte
        zu ziehen.
      </p>
      <Link
        href="/account/subscription"
        className="btn-deploy inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-sm"
      >
        <Sparkles className="w-4 h-4" />
        Membership ansehen
      </Link>
    </section>
  );
}
