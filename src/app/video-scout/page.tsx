"use client";

// ─── /video-scout — Video Scout ("Premium Search") ─────────
// Produkt wählen (klappt nach Wahl ein) → Anzahl → echte virale TikTok-
// Videos. Echte View-Counts (Apify), Relevanz per KI, Sortierung nach
// Views. Funde werden beim Kunden gespeichert (Historie, kein Doppel-
// Ziehen). Videos < Viral-Schwelle werden gutgeschrieben.

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
  Clapperboard,
  MonitorPlay,
  Play,
  Gift,
  Check,
  ShoppingBag,
  Coins,
  Info,
  SearchX,
  Pencil,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [count, setCount] = useState<VideoCount>(1);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [noResults, setNoResults] = useState(false);
  const [retryMsg, setRetryMsg] = useState("");
  const [lastHalfPrice, setLastHalfPrice] = useState<{ saved: number; weak: number } | null>(null);

  const cost = VIDEO_SCOUT_TIERS.find((t) => t.count === count)!.cost;
  const cannotAfford = !credits.loading && credits.balance < cost;
  const canRun = !!selectedId && !running && !cannotAfford;

  const selectedProduct = useMemo(
    () => products?.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );
  const selectedVideos = selectedId ? savedByProduct[selectedId] ?? [] : [];
  const showPicker = pickerOpen || !selectedId;

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
    setPickerOpen(false);
    setError("");
    setNoResults(false);
    setRetryMsg("");
    setLastHalfPrice(null);
  }

  const run = useCallback(async () => {
    if (!selectedId || running || cannotAfford) return;
    setError("");
    setNoResults(false);
    setRetryMsg("");
    setLastHalfPrice(null);
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
      if (data?.retryLater) {
        setRetryMsg(data?.error || "Bitte versuche es später erneut.");
        return;
      }
      if (data?.noResults) {
        setNoResults(true);
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Suche fehlgeschlagen.");
        return;
      }

      const now = new Date().toISOString();
      const fresh: SavedScoutVideo[] = (Array.isArray(data.videos_found) ? data.videos_found : []).map(
        (v: ScoutVideo) => ({ ...v, productId: pid, savedAt: now }),
      );
      setSavedByProduct((m) => {
        const existing = m[pid] ?? [];
        const seen = new Set(existing.map((v) => v.url));
        return { ...m, [pid]: [...fresh.filter((v) => !seen.has(v.url)), ...existing] };
      });
      if (data.half_price && typeof data.credits_saved === "number" && data.credits_saved > 0) {
        setLastHalfPrice({ saved: data.credits_saved, weak: data.weak_count ?? 0 });
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
        <div className="max-w-4xl mx-auto px-3 sm:px-5 py-4 sm:py-7 lg:py-9">
          {/* Header */}
          <header className="mb-4 sm:mb-6 text-center">
            <div
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-1.5"
              style={{ color: ACCENT }}
            >
              <Flame className="w-3 h-3" />
              Premium Search
            </div>
            <h1 className="text-[22px] sm:text-[32px] font-bold tracking-tight text-white leading-tight font-sf-display">
              Video Scout
            </h1>
            <p className="mt-1.5 sm:mt-2.5 text-[12px] sm:text-[14px] text-zinc-400 leading-relaxed max-w-md mx-auto">
              Wähle ein gezogenes Produkt — der Scout durchsucht TikTok, Instagram Reels & YouTube
              Shorts und liefert die view-stärksten Videos (10k+) zuerst.
            </p>
          </header>

          {locked ? (
            <LockedCard />
          ) : products === null ? (
            <LoadingCard />
          ) : products.length === 0 ? (
            <EmptyProductsCard error={productsError} />
          ) : (
            <div className="space-y-4">
              {/* ── Steuerung ── */}
              <section className="glass-strong rounded-2xl sm:rounded-3xl border border-white/[0.08] p-4 sm:p-6 relative overflow-hidden accent-ring">
                <div
                  className="absolute inset-0 opacity-50 pointer-events-none"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(149,191,71,0.10), transparent 60%)" }}
                />
                <div className="relative">
                  {/* Produkt: Auswahl-Grid ODER kompakte „ausgewählt"-Leiste */}
                  {showPicker ? (
                    <div>
                      <div className="flex items-center justify-between mb-2.5">
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          Produkt wählen
                        </label>
                        <span className="text-[10.5px] text-zinc-600">{products.length} gezogen</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-[268px] overflow-y-auto custom-scrollbar pr-0.5">
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
                    </div>
                  ) : (
                    selectedProduct && (
                      <button
                        onClick={() => setPickerOpen(true)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2.5 text-left hover:bg-white/[0.04] transition"
                      >
                        <ProductThumb src={selectedProduct.bildUrl} alt={selectedProduct.titel} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
                            Gewähltes Produkt
                          </div>
                          <div className="text-[13.5px] font-semibold text-white leading-tight line-clamp-1">
                            {selectedProduct.titel || "Produkt"}
                          </div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 px-2 py-1 rounded-lg border border-white/[0.08]">
                          <Pencil className="w-3 h-3" /> Ändern
                        </span>
                      </button>
                    )
                  )}

                  {/* Anzahl + Start — sobald ein Produkt gewählt ist */}
                  {selectedProduct && (
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
                              className={`rounded-xl border px-2 py-2.5 text-center transition ${
                                active
                                  ? "border-[#95BF47]/40 bg-[#95BF47]/10"
                                  : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                              }`}
                            >
                              <div className={`text-[17px] font-bold ${active ? "text-white" : "text-zinc-300"}`}>
                                {t.count}
                              </div>
                              <div
                                className="text-[10px] font-mono mt-0.5"
                                style={{ color: active ? ACCENT : "#71717a" }}
                              >
                                {t.cost} {credits.creditIcon}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={run}
                        disabled={!canRun}
                        className="btn-deploy w-full flex items-center justify-center gap-2 py-3.5 text-[15px] mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
                            Scoute… (~30–60 s)
                          </>
                        ) : (
                          <>
                            <Flame className="w-4 h-4" />
                            {selectedVideos.length > 0 ? "Weitere finden" : "Videos finden"}
                            <span className="font-mono opacity-80">· {cost} {credits.creditIcon}</span>
                          </>
                        )}
                      </button>
                      <p className="mt-2 text-center text-[10px] text-zinc-600 leading-snug">
                        Ist ein Video unter {VIRAL_LABEL} Views dabei, zahlst du nur die Hälfte · kein Video doppelt
                      </p>

                      {cannotAfford && (
                        <p className="mt-2 text-center text-[11px] text-amber-300/90">
                          Nicht genug Credits ({credits.balance}/{cost}).{" "}
                          <Link href="/credits" className="underline font-semibold hover:text-amber-200">
                            Aufladen
                          </Link>
                        </p>
                      )}
                      {error && (
                        <p className="mt-2 text-center text-[11px] text-red-400 flex items-center justify-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Ergebnisse / Historie ── */}
              {selectedProduct && (
                <section>
                  <AnimatePresence>
                    {lastHalfPrice && lastHalfPrice.saved > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-3 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-3"
                      >
                        <Coins className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-100/90 leading-snug">
                          <span className="font-semibold">Nur halber Preis — {lastHalfPrice.saved} Credits gespart.</span>{" "}
                          {lastHalfPrice.weak === 1 ? "Ein Video lag" : `${lastHalfPrice.weak} Videos lagen`} unter{" "}
                          {VIRAL_LABEL} Views, darum ziehen wir nur die Hälfte ab.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {retryMsg && !running && (
                    <div className="mb-3 rounded-2xl sm:rounded-3xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-7 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 flex items-center justify-center mx-auto mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-300" />
                      </div>
                      <p className="text-[14px] font-semibold text-white">Bitte später erneut versuchen</p>
                      <p className="mt-1.5 text-[12px] text-zinc-400 max-w-xs mx-auto leading-snug">
                        {retryMsg} Es wurden{" "}
                        <span className="text-zinc-200 font-medium">keine Credits abgezogen</span>.
                      </p>
                    </div>
                  )}

                  {noResults && !running && (
                    <div className="rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-white/[0.02] px-5 py-7 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                        <SearchX className="w-5 h-5 text-zinc-400" />
                      </div>
                      <p className="text-[14px] font-semibold text-white">Keine weiteren Videos gefunden</p>
                      <p className="mt-1.5 text-[12px] text-zinc-500 max-w-xs mx-auto leading-snug">
                        Zu diesem Produkt konnten wir gerade keine weiteren Videos finden. Es wurden{" "}
                        <span className="text-zinc-300 font-medium">keine Credits abgezogen</span>. Versuch
                        es später noch einmal.
                      </p>
                    </div>
                  )}

                  {running && <ScoutSkeleton count={count} />}

                  {selectedVideos.length > 0 && (
                    <>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Flame className="w-4 h-4" style={{ color: ACCENT }} />
                        <h2 className="text-[13px] font-semibold text-white">
                          Gefundene Videos
                          <span className="text-zinc-500 font-normal"> · {selectedVideos.length}</span>
                        </h2>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
                        {selectedVideos.map((v, i) => (
                          <VideoCard key={v.url} video={v} rank={i + 1} />
                        ))}
                      </div>

                      <p className="mt-3.5 text-[10px] text-zinc-600 leading-snug flex items-start gap-1.5">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>
                          Das in den Videos gezeigte Produkt kann leicht abweichen — manche Clips zeigen
                          ähnliche oder verwandte Varianten. View-Counts sind echte Werte zum Abrufzeitpunkt
                          und können sich ändern.
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
      className={`group relative text-left rounded-xl border overflow-hidden transition ${
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
            <ShoppingBag className="w-5 h-5 text-zinc-700" />
          </div>
        )}
      </div>
      {selected && (
        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#95BF47] flex items-center justify-center shadow">
          <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
        </div>
      )}
      {savedCount > 0 && (
        <div className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-black/70 backdrop-blur text-[8.5px] font-semibold text-white">
          <Flame className="w-2 h-2 text-pink-300" />
          {savedCount}
        </div>
      )}
      <div className="px-1.5 py-1.5">
        <p
          className={`text-[10.5px] font-medium leading-tight line-clamp-1 ${
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
    <div className="w-11 h-11 rounded-xl overflow-hidden bg-white/[0.04] shrink-0">
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

const PLATFORM_META: Record<
  ScoutVideo["platform"],
  { label: string; Icon: typeof Music2; color: string }
> = {
  TikTok: { label: "TikTok", Icon: Music2, color: "text-pink-300" },
  Instagram: { label: "Reels", Icon: Clapperboard, color: "text-fuchsia-300" },
  YouTube: { label: "Shorts", Icon: MonitorPlay, color: "text-red-400" },
};

function VideoCard({ video, rank }: { video: ScoutVideo; rank: number }) {
  const [broken, setBroken] = useState(false);
  const plat = PLATFORM_META[video.platform] ?? PLATFORM_META.TikTok;
  const PlatIcon = plat.Icon;
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
            <PlatIcon className="w-7 h-7 text-zinc-700" />
          </div>
        )}

        <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-[10px] font-bold text-white">
          {rank}
        </div>
        <div className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur text-[9px] font-semibold text-white">
          <PlatIcon className={`w-2 h-2 ${plat.color}`} /> {plat.label}
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
        <div className="absolute bottom-0 inset-x-0 px-2 py-1.5 bg-gradient-to-t from-black/85 to-transparent flex items-center gap-2.5 text-[10.5px] text-white font-semibold">
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

      <div className="p-2 sm:p-2.5 flex-1 flex flex-col">
        <p className="text-[11.5px] text-zinc-300 leading-snug truncate flex-1">
          {video.title_snippet || "—"}
        </p>
        {video.refunded ? (
          <span className="mt-1.5 inline-flex items-center gap-1 self-start px-1.5 py-0.5 rounded-md bg-amber-500/12 border border-amber-500/25 text-[9px] font-semibold text-amber-200">
            <Coins className="w-2.5 h-2.5" />
            unter {VIRAL_LABEL} · halber Preis
          </span>
        ) : (
          <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 group-hover:text-[#95BF47] transition">
            Ansehen <ExternalLink className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </a>
  );
}

// ─── Lade-Skelett (Ergebnisse) ───────────────────────────────────

function ScoutSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse"
        >
          <div className="aspect-[9/13] bg-white/[0.04]" />
          <div className="p-2.5 space-y-2">
            <div className="h-2.5 bg-white/[0.05] rounded w-2/3" />
            <div className="h-2.5 bg-white/[0.05] rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lade-Karte (Produkte werden geholt) ─────────────────────────

function LoadingCard() {
  return (
    <section className="glass-strong rounded-2xl sm:rounded-3xl border border-white/[0.08] p-8 text-center">
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
    <section className="glass-strong rounded-2xl sm:rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#95BF47]/10 border border-[#95BF47]/20 flex items-center justify-center mx-auto mb-4">
        <Gift className="w-6 h-6" style={{ color: ACCENT }} />
      </div>
      <h2 className="text-lg font-semibold text-white">Noch keine Produkte gezogen</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        {error
          ? error
          : "Der Video Scout sucht Videos zu deinen gezogenen Produkten. Zieh zuerst ein Winning-Produkt im Produkt-Drop, dann findest du hier passende Videos dazu."}
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
    <section className="glass-strong rounded-2xl sm:rounded-3xl border border-white/[0.08] p-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-amber-400" />
      </div>
      <h2 className="text-lg font-semibold text-white">Teil der Brospify Membership</h2>
      <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
        Der Video Scout ist Teil deiner Membership. Aktiviere dein Abo, um Videos zu deinen
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
