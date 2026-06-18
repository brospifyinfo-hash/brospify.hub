"use client";

// ─── /video-scout — Viral Video Scout ("Premium Search") ─────────
// Ablauf: gezogenes Produkt wählen → Anzahl (3/6/9) → echte virale
// TikTok-Videos. Echte View-Counts (Apify), Relevanz per KI, Sortierung
// nach Views. Gefundene Videos werden beim Kunden GESPEICHERT (Historie
// + kein Video doppelt). Videos unter der Viral-Schwelle werden dem
// Kunden gutgeschrieben. Erkennt das System, dass das Produkt aktuell
// nicht viral geht, sucht es erst gar nicht weiter.

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Lock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Eye,
  Heart,
  Music2,
  Play,
  Gift,
  Check,
  ShoppingBag,
  Coins,
  Info,
  SearchX,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";
import {
  VIDEO_SCOUT_TIERS,
  VIDEO_VIRAL_MIN,
  formatViews,
  type VideoCount,
  type ScoutVideo,
  type ScoutProduct,
  type SavedScoutVideo,
} from "@/lib/video-scout";

const ACCENT = "#95BF47";
const VIRAL_LABEL = formatViews(VIDEO_VIRAL_MIN); // "10K"

export default function VideoScoutPage() {
  const router = useRouter();
  const credits = useCredits();

  const [products, setProducts] = useState<ScoutProduct[] | null>(null);
  const [savedByProduct, setSavedByProduct] = useState<Record<string, SavedScoutVideo[]>>({});
  const [productsError, setProductsError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [count, setCount] = useState<VideoCount>(3);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [notViral, setNotViral] = useState(false);
  const [lastRefund, setLastRefund] = useState<{ count: number; total: number } | null>(null);

  const cost = VIDEO_SCOUT_TIERS.find((t) => t.count === count)!.cost;
  const cannotAfford = !credits.loading && credits.balance < cost;
  const canRun = !!selectedId && !running && !cannotAfford;

  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );
  const selectedVideos = selectedId ? savedByProduct[selectedId] ?? [] : [];

  // ── Gezogene Produkte + gespeicherte Videos laden ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/video-scout", { cache: "no-store" });
        if (res.status === 401) {
          router.push("/");
          return;
        }
        if (res.status === 403) {
          if (!cancelled) setLocked(true);
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setProductsError(data?.error || "Produkte konnten nicht geladen werden.");
          setProducts([]);
          return;
        }
        setProducts(Array.isArray(data.products) ? data.products : []);
        // Videos nach productId gruppieren (Historie pro Produkt).
        const grouped: Record<string, SavedScoutVideo[]> = {};
        for (const v of (Array.isArray(data.savedVideos) ? data.savedVideos : []) as SavedScoutVideo[]) {
          (grouped[v.productId] ??= []).push(v);
        }
        setSavedByProduct(grouped);
      } catch {
        if (!cancelled) {
          setProductsError("Verbindungsfehler.");
          setProducts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function selectProduct(id: string) {
    setSelectedId(id);
    setError("");
    setNotViral(false);
    setLastRefund(null);
  }

  const run = useCallback(async () => {
    if (!selectedId || running || cannotAfford) return;
    setError("");
    setNotViral(false);
    setLastRefund(null);
    setRunning(true);
    const pid = selectedId;
    try {
      const res = await fetch("/api/video-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: pid, count }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.push("/");
        return;
      }
      if (res.status === 403) {
        setLocked(true);
        return;
      }
      if (res.status === 402) {
        setError(data?.error || "Nicht genug Credits.");
        if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
        return;
      }
      if (data?.notViral) {
        setNotViral(true);
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Suche fehlgeschlagen.");
        return;
      }

      // Neue Videos in die (persistierte) Historie des Produkts mergen.
      const now = new Date().toISOString();
      const fresh: SavedScoutVideo[] = (Array.isArray(data.videos_found) ? data.videos_found : []).map(
        (v: ScoutVideo) => ({ ...v, productId: pid, savedAt: now }),
      );
      setSavedByProduct((m) => {
        const existing = m[pid] ?? [];
        const seen = new Set(existing.map((v) => v.url));
        return { ...m, [pid]: [...fresh.filter((v) => !seen.has(v.url)), ...existing] };
      });
      if (typeof data.credits_refunded === "number" && data.credits_refunded > 0) {
        setLastRefund({ count: data.refunded_count ?? 0, total: data.credits_refunded });
      }
      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setRunning(false);
    }
  }, [selectedId, count, running, cannotAfford, credits, router]);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-4 sm:py-7 lg:py-9">
          {/* Header */}
          <header className="mb-6 sm:mb-8 text-center">
            <div
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
              style={{ color: ACCENT }}
            >
              <Flame className="w-3 h-3" />
              Premium Search
            </div>
            <h1 className="text-[26px] sm:text-[34px] font-bold tracking-tight text-white leading-tight font-sf-display">
              Viral Video Scout
            </h1>
            <p className="mt-2.5 text-[12.5px] sm:text-[15px] text-zinc-400 leading-relaxed max-w-xl mx-auto">
              Wähle eines deiner gezogenen Produkte — der Scout findet dir die viralsten echten
              TikTok-Videos dazu, sortiert nach echten View-Counts. Deine Funde werden gespeichert.
            </p>
          </header>

          {locked ? (
            <LockedCard />
          ) : products === null ? (
            <LoadingCard />
          ) : products.length === 0 ? (
            <EmptyProductsCard error={productsError} />
          ) : (
            <div className="space-y-5 sm:space-y-6">
              {/* ── Schritt 1: Produkt wählen ── */}
              <section className="glass-strong rounded-3xl border border-white/[0.08] p-5 sm:p-6">
                <StepHeader n={1} label="Produkt wählen" hint={`${products.length} gezogen`} />
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                  {products.map((p) => (
                    <ProductTile
                      key={p.id}
                      product={p}
                      selected={selectedId === p.id}
                      savedCount={(savedByProduct[p.id] ?? []).length}
                      onSelect={() => selectProduct(p.id)}
                    />
                  ))}
                </div>
              </section>

              {/* ── Schritt 2: Suche starten ── */}
              <AnimatePresence mode="wait">
                {selectedProduct && (
                  <motion.section
                    key={selectedProduct.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="glass-strong rounded-3xl border border-white/[0.08] p-5 sm:p-6 relative overflow-hidden accent-ring"
                  >
                    <div
                      className="absolute inset-0 opacity-50 pointer-events-none"
                      style={{ background: "radial-gradient(circle at 50% 0%, rgba(149,191,71,0.10), transparent 60%)" }}
                    />
                    <div className="relative">
                      <StepHeader n={2} label="Videos finden" />

                      {/* Gewähltes Produkt */}
                      <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                        <ProductThumb src={selectedProduct.bildUrl} alt={selectedProduct.titel} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-white leading-tight line-clamp-2">
                            {selectedProduct.titel || "Produkt"}
                          </div>
                          {selectedVideos.length > 0 && (
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {selectedVideos.length} gespeicherte{selectedVideos.length === 1 ? "s Video" : " Videos"}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Anzahl */}
                      <div className="mt-4">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Anzahl Videos
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {VIDEO_SCOUT_TIERS.map((t) => {
                            const active = count === t.count;
                            return (
                              <button
                                key={t.count}
                                onClick={() => setCount(t.count)}
                                className={`rounded-xl border px-3 py-3 text-center transition ${
                                  active
                                    ? "border-[#95BF47]/40 bg-[#95BF47]/10"
                                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                                }`}
                              >
                                <div className={`text-[18px] font-bold ${active ? "text-white" : "text-zinc-300"}`}>
                                  {t.count}
                                </div>
                                <div
                                  className="text-[10.5px] font-mono mt-0.5"
                                  style={{ color: active ? ACCENT : "#71717a" }}
                                >
                                  {t.cost} 🪙
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        onClick={run}
                        disabled={!canRun}
                        className="btn-deploy w-full flex items-center justify-center gap-2 py-3.5 text-[15px] mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {running ? (
                          <>
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                              className="inline-flex"
                            >
                              <Sparkles className="w-4 h-4" />
                            </motion.span>
                            Scoute virale Videos… (~30–60 s)
                          </>
                        ) : (
                          <>
                            <Flame className="w-4 h-4" />
                            {selectedVideos.length > 0 ? "Weitere Videos finden" : "Videos finden"}
                            <span className="font-mono opacity-80">· {cost} 🪙</span>
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-center text-[10.5px] text-zinc-600 leading-snug">
                        Videos unter {VIRAL_LABEL} Views gelten als nicht viral genug und werden dir
                        automatisch gutgeschrieben. Kein Video wird doppelt gezogen.
                      </p>

                      {cannotAfford && (
                        <p className="mt-2 text-center text-[11px] text-amber-300/90">
                          Nicht genug Credits ({credits.balance}/{cost}).{" "}
                          <Link href="/credits" className="underline font-semibold hover:text-amber-200">
                            Credits aufladen
                          </Link>
                        </p>
                      )}
                      {error && (
                        <p className="mt-2 text-center text-[11px] text-red-400 flex items-center justify-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {error}
                        </p>
                      )}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* ── Ergebnisse / Historie ── */}
              {selectedProduct && (
                <section>
                  {/* Refund-Banner */}
                  <AnimatePresence>
                    {lastRefund && lastRefund.total > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-4 py-3"
                      >
                        <Coins className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        <p className="text-[12.5px] text-amber-100/90 leading-snug">
                          <span className="font-semibold">{lastRefund.total} Credits gutgeschrieben.</span>{" "}
                          {lastRefund.count} {lastRefund.count === 1 ? "Video war" : "Videos waren"} nicht
                          viral genug (unter {VIRAL_LABEL} Views) — du zahlst nur für die wirklich viralen.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* notViral-Zustand */}
                  {notViral && !running && (
                    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] px-6 py-8 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                        <SearchX className="w-5 h-5 text-zinc-400" />
                      </div>
                      <p className="text-[14px] font-semibold text-white">
                        Aktuell keine viralen Videos gefunden
                      </p>
                      <p className="mt-1.5 text-[12px] text-zinc-500 max-w-sm mx-auto leading-snug">
                        Dieses Produkt scheint gerade nicht viral zu gehen. Es wurden{" "}
                        <span className="text-zinc-300 font-medium">keine Credits abgezogen</span>. Versuch
                        es später noch einmal oder wähle ein anderes Produkt.
                      </p>
                    </div>
                  )}

                  {running && <ScoutSkeleton count={count} />}

                  {selectedVideos.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
                        <Flame className="w-4 h-4" style={{ color: ACCENT }} />
                        <h2 className="text-sm font-semibold text-white">
                          Gefundene Videos
                          <span className="text-zinc-500 font-normal"> · {selectedVideos.length}</span>
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {selectedVideos.map((v, i) => (
                          <VideoCard key={v.url} video={v} rank={i + 1} />
                        ))}
                      </div>

                      {/* Disclaimer */}
                      <p className="mt-4 text-[10.5px] text-zinc-600 leading-snug flex items-start gap-1.5">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>
                          Hinweis: Das in den Videos gezeigte Produkt kann leicht abweichen — manche Clips
                          zeigen ähnliche oder verwandte Varianten. View-Counts sind die echten, vom Scraper
                          gemeldeten Werte zum Abrufzeitpunkt und können sich ändern.
                        </span>
                      </p>
                    </>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// ─── Schritt-Header ──────────────────────────────────────────────

function StepHeader({ n, label, hint }: { n: number; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
        style={{ background: "var(--accent-light)", color: ACCENT }}
      >
        {n}
      </span>
      <h2 className="text-[14px] font-semibold text-white">{label}</h2>
      {hint && <span className="text-[11px] text-zinc-600">· {hint}</span>}
    </div>
  );
}

// ─── Produkt-Kachel (auswählbar) ─────────────────────────────────

function ProductTile({
  product,
  selected,
  savedCount,
  onSelect,
}: {
  product: ScoutProduct;
  selected: boolean;
  savedCount: number;
  onSelect: () => void;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <button
      onClick={onSelect}
      className={`group relative text-left rounded-2xl border overflow-hidden transition ${
        selected
          ? "border-[#95BF47]/50 bg-[#95BF47]/8 ring-1 ring-[#95BF47]/30"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16]"
      }`}
    >
      <div className="aspect-square w-full bg-white/[0.03] overflow-hidden">
        {product.bildUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.bildUrl}
            alt={product.titel}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-zinc-700" />
          </div>
        )}
      </div>
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#95BF47] flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-black" strokeWidth={3} />
        </div>
      )}
      {savedCount > 0 && (
        <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur text-[9px] font-semibold text-white">
          <Flame className="w-2 h-2 text-pink-300" />
          {savedCount}
        </div>
      )}
      <div className="p-2">
        <p
          className={`text-[11px] font-medium leading-tight line-clamp-2 ${
            selected ? "text-white" : "text-zinc-300"
          }`}
        >
          {product.titel || "Produkt"}
        </p>
      </div>
    </button>
  );
}

function ProductThumb({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.04] shrink-0">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-zinc-700" />
        </div>
      )}
    </div>
  );
}

// ─── Video-Karte ─────────────────────────────────────────────────

function VideoCard({ video, rank }: { video: ScoutVideo; rank: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/[0.16] transition flex flex-col"
    >
      <div className="relative aspect-[9/13] bg-white/[0.03] overflow-hidden">
        {video.thumbnail && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt={video.title_snippet}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setBroken(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music2 className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-[11px] font-bold text-white">
          {rank}
        </div>
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-semibold text-white">
          <Music2 className="w-2.5 h-2.5 text-pink-300" /> TikTok
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/85 to-transparent flex items-center gap-3 text-[11px] text-white font-semibold">
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3" /> {video.formatted_views}
          </span>
          {typeof video.likes === "number" && video.likes > 0 && (
            <span className="inline-flex items-center gap-1 text-zinc-300">
              <Heart className="w-3 h-3" /> {formatViews(video.likes)}
            </span>
          )}
        </div>
      </div>

      <div className="p-2.5 flex-1 flex flex-col">
        {video.author && <div className="text-[10.5px] text-zinc-500 mb-0.5 truncate">@{video.author}</div>}
        <p className="text-[12px] text-zinc-200 leading-snug line-clamp-2 flex-1">
          {video.title_snippet || "—"}
        </p>
        {video.refunded ? (
          <span className="mt-2 inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/25 text-[9.5px] font-semibold text-amber-200">
            <Coins className="w-2.5 h-2.5" />
            {video.refundAmount ? `${video.refundAmount} 🪙 gutgeschrieben` : "gutgeschrieben"} · nicht viral genug
          </span>
        ) : (
          <span className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-zinc-400 group-hover:text-[#95BF47] transition">
            Video ansehen <ExternalLink className="w-3 h-3" />
          </span>
        )}
      </div>
    </a>
  );
}

// ─── Lade-Skelett (Ergebnisse) ───────────────────────────────────

function ScoutSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse"
        >
          <div className="aspect-[9/13] bg-white/[0.04]" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 bg-white/[0.05] rounded w-2/3" />
            <div className="h-3 bg-white/[0.05] rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lade-Karte (Produkte werden geholt) ─────────────────────────

function LoadingCard() {
  return (
    <section className="glass-strong rounded-3xl border border-white/[0.08] p-8 text-center">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        className="inline-flex mb-3"
      >
        <Sparkles className="w-6 h-6" style={{ color: ACCENT }} />
      </motion.span>
      <p className="text-sm text-zinc-400">Lade deine gezogenen Produkte…</p>
    </section>
  );
}

// ─── Keine gezogenen Produkte ────────────────────────────────────

function EmptyProductsCard({ error }: { error?: string }) {
  return (
    <section className="glass-strong rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center mx-auto mb-4">
        <Gift className="w-6 h-6" style={{ color: ACCENT }} />
      </div>
      <h2 className="text-lg font-semibold text-white">Noch keine Produkte gezogen</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        {error
          ? error
          : "Der Video Scout sucht Videos zu deinen gezogenen Produkten. Zieh zuerst ein Winning-Produkt im Produkt-Drop, dann findest du hier virale Videos dazu."}
      </p>
      <Link href="/charts" className="btn-deploy inline-flex items-center gap-2 mt-5 px-5 py-2.5 text-sm">
        <Gift className="w-4 h-4" />
        Zum Produkt-Drop
      </Link>
    </section>
  );
}

// ─── Locked (kein aktives Abo) ───────────────────────────────────

function LockedCard() {
  return (
    <section className="glass-strong rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">Teil der Brospify Membership</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        Der Viral Video Scout ist Teil deiner Membership. Aktiviere dein Abo, um virale Videos zu deinen
        Produkten zu finden.
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
