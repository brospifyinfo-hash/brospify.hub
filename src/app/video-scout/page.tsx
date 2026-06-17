"use client";

// ─── /video-scout — Viral Video Scout ("Premium Search") ─────────
// Produkt + Anzahl (3/6/9) eingeben → die viralsten echten TikTok-
// Videos dazu. Echte View-Counts vom Apify-Scraper, Relevanz per KI
// gefiltert, Sortierung nach echten Views. Preis: 40/70/90 Credits.

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Flame,
  Search,
  Lock,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Eye,
  Heart,
  Music2,
  Play,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";
import {
  VIDEO_SCOUT_TIERS,
  formatViews,
  type VideoCount,
  type ScoutVideo,
} from "@/lib/video-scout";

const ACCENT = "#95BF47";

export default function VideoScoutPage() {
  const router = useRouter();
  const credits = useCredits();

  const [product, setProduct] = useState("");
  const [count, setCount] = useState<VideoCount>(3);
  const [running, setRunning] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [videos, setVideos] = useState<ScoutVideo[] | null>(null);
  const [lastProduct, setLastProduct] = useState("");

  const cost = VIDEO_SCOUT_TIERS.find((t) => t.count === count)!.cost;
  const cannotAfford = !credits.loading && credits.balance < cost;
  const canRun = product.trim().length >= 2 && !running && !cannotAfford;

  const run = useCallback(async () => {
    if (product.trim().length < 2 || running || cannotAfford) return;
    setError("");
    setVideos(null);
    setRunning(true);
    const q = product.trim();
    try {
      const res = await fetch("/api/video-scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: q, count }),
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
      if (!res.ok) {
        setError(data?.error || "Suche fehlgeschlagen.");
        setVideos(Array.isArray(data?.videos_found) ? data.videos_found : null);
        return;
      }

      setVideos(Array.isArray(data.videos_found) ? data.videos_found : []);
      setLastProduct(q);
      if (typeof data.creditsRemaining === "number") credits.setBalance(data.creditsRemaining);
    } catch {
      setError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setRunning(false);
    }
  }, [product, count, running, cannotAfford, credits, router]);

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-mesh font-sf">
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-5 py-4 sm:py-7 lg:py-9">
          {/* Header */}
          <header className="mb-5 sm:mb-7 text-center">
            <div
              className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] font-semibold mb-2"
              style={{ color: ACCENT }}
            >
              <Flame className="w-3 h-3" />
              Premium Search
            </div>
            <h1 className="text-[24px] sm:text-[32px] font-bold tracking-tight text-white leading-tight font-sf-display">
              Viral Video Scout
            </h1>
            <p className="mt-2 text-[12px] sm:text-sm text-zinc-400 leading-snug max-w-md mx-auto">
              Finde die viralsten <span className="font-semibold text-white">echten TikTok-Videos</span> zu
              einem Produkt — sortiert nach echten View-Counts. Perfekt für Ad-Inspiration &amp;
              Creative-Research.
            </p>
          </header>

          {locked ? (
            <LockedCard />
          ) : (
            <>
              <section className="glass-strong rounded-3xl border border-white/[0.08] p-5 sm:p-7 relative overflow-hidden accent-ring">
                <div
                  className="absolute inset-0 opacity-60 pointer-events-none"
                  style={{ background: "radial-gradient(circle at 50% 0%, rgba(149,191,71,0.12), transparent 60%)" }}
                />
                <div className="relative space-y-4">
                  {/* Produkt */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Produkt
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                      <input
                        value={product}
                        onChange={(e) => setProduct(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") run();
                        }}
                        placeholder="z. B. LED Hundehalsband, Mini-Drucker…"
                        maxLength={120}
                        className="w-full pl-9 pr-3 py-3 rounded-xl bg-white/[0.04] border border-white/[0.10] text-[14px] text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#95BF47]/40 transition"
                      />
                    </div>
                  </div>

                  {/* Anzahl */}
                  <div>
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
                    className="btn-deploy w-full flex items-center justify-center gap-2 py-3.5 text-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                        Videos finden
                        <span className="font-mono opacity-80">· {cost} 🪙</span>
                      </>
                    )}
                  </button>

                  {cannotAfford && (
                    <p className="text-center text-[11px] text-amber-300/90">
                      Nicht genug Credits ({credits.balance}/{cost}).{" "}
                      <Link href="/credits" className="underline font-semibold hover:text-amber-200">
                        Credits aufladen
                      </Link>
                    </p>
                  )}
                  {error && (
                    <p className="text-center text-[11px] text-red-400 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {error}
                    </p>
                  )}
                </div>
              </section>

              {/* Ergebnisse */}
              {running && <ScoutSkeleton count={count} />}

              {!running && videos && videos.length > 0 && (
                <section className="mt-7">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4" style={{ color: ACCENT }} />
                    <h2 className="text-sm font-semibold text-white">
                      {videos.length} virale{videos.length === 1 ? "s Video" : " Videos"}
                      {lastProduct && (
                        <span className="text-zinc-500 font-normal"> · {lastProduct}</span>
                      )}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {videos.map((v, i) => (
                      <VideoCard key={v.url} video={v} rank={i + 1} />
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-zinc-600 leading-snug flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>
                      View-Counts sind die echten, vom Scraper gemeldeten Werte zum Abrufzeitpunkt und
                      können sich laufend ändern. Es werden nur Videos gezeigt, die das Produkt klar
                      betreffen — fehlen welche, gab es nicht mehr eindeutige Treffer.
                    </span>
                  </p>
                </section>
              )}

              {!running && videos && videos.length === 0 && !error && (
                <p className="mt-7 text-center text-sm text-zinc-500">Keine passenden Videos gefunden.</p>
              )}
            </>
          )}
        </div>
      </main>
    </>
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
      <div className="relative aspect-[9/12] bg-white/[0.03] overflow-hidden">
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

        {/* Rang */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 backdrop-blur flex items-center justify-center text-[11px] font-bold text-white">
          {rank}
        </div>
        {/* Plattform */}
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur text-[10px] font-semibold text-white">
          <Music2 className="w-2.5 h-2.5 text-pink-300" /> TikTok
        </div>
        {/* Play-Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
        {/* Metriken */}
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

      <div className="p-3 flex-1 flex flex-col">
        {video.author && <div className="text-[11px] text-zinc-500 mb-0.5 truncate">@{video.author}</div>}
        <p className="text-[12.5px] text-zinc-200 leading-snug line-clamp-2 flex-1">
          {video.title_snippet || "—"}
        </p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 group-hover:text-[#95BF47] transition">
          Video ansehen <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </a>
  );
}

// ─── Lade-Skelett ────────────────────────────────────────────────

function ScoutSkeleton({ count }: { count: number }) {
  return (
    <section className="mt-7">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden animate-pulse"
          >
            <div className="aspect-[9/12] bg-white/[0.04]" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-white/[0.05] rounded w-2/3" />
              <div className="h-3 bg-white/[0.05] rounded w-full" />
            </div>
          </div>
        ))}
      </div>
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
