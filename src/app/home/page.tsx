"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Package,
  Scale,
  Palette,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Crown,
  Rocket,
  Search,
  PenTool,
  ExternalLink,
  Plus,
  Loader2,
  X,
  Upload,
  Trash2,
  Megaphone,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  hasShopifyToken: boolean;
  shopDomain?: string;
}

interface Checklist {
  setup_complete?: boolean;
  product_imported?: boolean;
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

interface NewsSlide {
  rowIndex: number;
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
}

const STEPS = [
  {
    key: "setup_complete" as const,
    title: "Shopify verbinden",
    description: "Verknüpfe deinen Shopify-Store, um alle Funktionen freizuschalten.",
    icon: Store,
    color: "#95BF47",
    href: "/setup",
    ctaText: "Shop verbinden",
  },
  {
    key: "product_imported" as const,
    title: "Produkt importieren",
    description: "Importiere dein erstes Winning Product mit einem Klick in deinen Shop.",
    icon: Package,
    color: "#8B5CF6",
    href: "/charts",
    ctaText: "Zu den Charts",
  },
  {
    key: "legal_texts_generated" as const,
    title: "Rechtstexte generieren",
    description: "Erstelle DACH-konforme Rechtstexte und pushe sie direkt in deinen Shop.",
    icon: Scale,
    color: "#3B82F6",
    href: "/legal",
    ctaText: "Rechtstexte erstellen",
  },
  {
    key: "theme_pushed" as const,
    title: "Theme installieren",
    description: "Installiere das Premium-Theme für maximale Conversion in deinem Shop.",
    icon: Palette,
    color: "#EC4899",
    href: "/themes",
    ctaText: "Theme installieren",
  },
];

const EXTRA_TASKS = [
  {
    title: "Dropshipping-App installieren",
    description: "Installiere DSers oder eine alternative Dropshipping-App.",
    icon: ExternalLink,
    color: "#F59E0B",
    href: "https://apps.shopify.com/dsers",
    external: true,
  },
  {
    title: "Erste SEO-Analyse durchführen",
    description: "Prüfe deinen Shop-SEO-Score und optimiere ihn mit einem Klick.",
    icon: Search,
    color: "#06B6D4",
    href: "/seo",
    external: false,
  },
  {
    title: "Ersten Blogbeitrag generieren",
    description: "Erstelle deinen ersten KI-generierten Blog-Artikel für mehr Traffic.",
    icon: PenTool,
    color: "#A855F7",
    href: "/blog",
    external: false,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [loading, setLoading] = useState(true);
  const [slides, setSlides] = useState<NewsSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showSliderAdmin, setShowSliderAdmin] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const loadSlides = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news-slider");
      if (res.ok) {
        const data = await res.json();
        setSlides(data.slides || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sess, profileData]) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(sess);

        const profile = profileData?.profile || {};
        const cl = profile.onboarding_checklist || {};

        if (sess.hasShopifyToken || sess.hasShopifyConnection) {
          cl.setup_complete = true;
        }

        setChecklist(cl);
        setLoading(false);
      })
      .catch(() => router.push("/"));

    loadSlides();
  }, [router, loadSlides]);

  // Auto-advance carousel
  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  function goToSlide(idx: number) {
    setCurrentSlide(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completedCount = STEPS.filter((s) => checklist[s.key]).length;
  const progress = (completedCount / STEPS.length) * 100;
  const allDone = completedCount === STEPS.length;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Ambient glows */}
      <div className="fixed top-20 right-10 w-72 h-72 bg-[#95BF47]/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 left-10 w-60 h-60 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 md:py-10">

        {/* News Slider */}
        {slides.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 relative overflow-hidden rounded-2xl border border-white/10"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.35 }}
                className="relative"
              >
                {slides[currentSlide]?.imageUrl ? (
                  <div className="relative h-40 md:h-52">
                    <img
                      src={slides[currentSlide].imageUrl}
                      alt={slides[currentSlide].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h3 className="text-lg md:text-xl font-bold text-white leading-tight">{slides[currentSlide].title}</h3>
                      {slides[currentSlide].subtitle && (
                        <p className="text-xs text-zinc-300 mt-1">{slides[currentSlide].subtitle}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-5 md:p-6">
                    <div className="flex items-center gap-2.5 mb-2">
                      <Megaphone className="w-5 h-5 text-[#95BF47]" />
                      <h3 className="text-base md:text-lg font-bold">{slides[currentSlide].title}</h3>
                    </div>
                    {slides[currentSlide].subtitle && (
                      <p className="text-xs text-zinc-400">{slides[currentSlide].subtitle}</p>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Dots + Nav */}
            {slides.length > 1 && (
              <div className="flex items-center justify-center gap-2 pb-3 pt-1">
                <button onClick={() => goToSlide((currentSlide - 1 + slides.length) % slides.length)}
                  className="p-1 text-zinc-500 hover:text-white transition">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      i === currentSlide ? "bg-[#95BF47] w-4" : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
                <button onClick={() => goToSlide((currentSlide + 1) % slides.length)}
                  className="p-1 text-zinc-500 hover:text-white transition">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Admin edit button */}
            {session.isAdmin && (
              <button
                onClick={() => setShowSliderAdmin(true)}
                className="absolute top-3 right-3 p-2 rounded-lg bg-black/50 border border-white/10 text-zinc-400 hover:text-white transition backdrop-blur-sm"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* Admin: Show add button when no slides */}
        {slides.length === 0 && session.isAdmin && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setShowSliderAdmin(true)}
            className="mb-6 w-full p-4 rounded-2xl border border-dashed border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> News-Slider erstellen
          </motion.button>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
              <Crown className="w-6 h-6 text-[#95BF47]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {allDone ? "Alles erledigt!" : "Willkommen"}{" "}
                <span className="text-[#95BF47]">{allDone ? "\u{1F389}" : "\u{1F44B}"}</span>
              </h1>
              <p className="text-zinc-400 text-sm">
                {allDone
                  ? "Dein Shop ist vollständig eingerichtet."
                  : "Richte deinen Shop in 4 einfachen Schritten ein."}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-strong rounded-2xl border border-white/10 p-5 mb-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#95BF47]" />
              <span className="text-sm font-semibold">Setup-Fortschritt</span>
            </div>
            <span className="text-sm font-bold text-[#95BF47]">
              {completedCount}/{STEPS.length}
            </span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-[#B8D96E]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {allDone
              ? "Perfekt! Du kannst jetzt loslegen."
              : `Noch ${STEPS.length - completedCount} ${STEPS.length - completedCount === 1 ? "Schritt" : "Schritte"} bis zum Start.`}
          </p>
        </motion.div>

        {/* Checklist Steps */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {STEPS.map((step, idx) => {
            const done = !!checklist[step.key];
            const isNext = !done && STEPS.slice(0, idx).every((s) => checklist[s.key]);

            return (
              <motion.div
                key={step.key}
                variants={item}
                className={`group relative rounded-2xl border backdrop-blur-md transition-all duration-300 overflow-hidden ${
                  done
                    ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                    : isNext
                    ? "border-white/15 bg-white/[0.06] hover:border-white/25"
                    : "border-white/8 bg-white/[0.02] opacity-60"
                }`}
              >
                {isNext && (
                  <div
                    className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(135deg, ${step.color}15, transparent 60%)` }}
                  />
                )}

                <div className="relative p-4 md:p-5 flex items-start gap-4">
                  <div className="shrink-0 mt-0.5">
                    <motion.div
                      className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        done ? "bg-emerald-500/20 border border-emerald-500/30" : "border"
                      }`}
                      style={done ? undefined : { backgroundColor: `${step.color}15`, borderColor: `${step.color}30` }}
                      animate={done ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.4 }}
                    >
                      {done ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -45 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        >
                          <Check className="w-5 h-5 text-emerald-400" />
                        </motion.div>
                      ) : (
                        <step.icon className="w-5 h-5" style={{ color: step.color }} />
                      )}
                    </motion.div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                        Schritt {idx + 1}
                      </span>
                      {done && (
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-[10px] font-bold uppercase tracking-widest text-emerald-400"
                        >
                          Erledigt
                        </motion.span>
                      )}
                    </div>
                    <h3 className={`font-semibold text-sm md:text-base transition-all ${
                      done ? "text-zinc-400 line-through decoration-emerald-500/40" : "text-white"
                    }`}>
                      {step.title}
                    </h3>
                    <p className="text-xs md:text-sm text-zinc-500 mt-0.5 leading-relaxed">{step.description}</p>

                    {!done && (
                      <motion.button
                        onClick={() => router.push(step.href)}
                        className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                          isNext
                            ? "text-black hover:brightness-110"
                            : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10"
                        }`}
                        style={isNext ? { backgroundColor: step.color } : undefined}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {step.ctaText}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Extra Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Rocket className="w-4 h-4 text-[#95BF47]" />
            <h2 className="text-sm font-bold text-zinc-300">Weitere Empfehlungen</h2>
          </div>
          <div className="grid gap-2.5">
            {EXTRA_TASKS.map((task) => (
              <motion.button
                key={task.title}
                onClick={() => {
                  if (task.external) window.open(task.href, "_blank");
                  else router.push(task.href);
                }}
                className="group w-full text-left flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04] transition-all duration-200"
                whileHover={{ x: 4 }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{ backgroundColor: `${task.color}15`, borderColor: `${task.color}25` }}
                >
                  <task.icon className="w-5 h-5" style={{ color: task.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white">{task.title}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{task.description}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition shrink-0" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* All Done CTA */}
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-8"
          >
            <div className="glass-strong rounded-2xl border border-[#95BF47]/20 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center mx-auto mb-4">
                <Rocket className="w-7 h-7 text-[#95BF47]" />
              </div>
              <h3 className="text-lg font-bold mb-2">Dein Shop ist startklar!</h3>
              <p className="text-zinc-400 text-sm mb-5">
                Alle Schritte abgeschlossen. Entdecke jetzt neue Produkte oder besuche die Community.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push("/charts")}
                  className="btn-accent px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Winning Charts
                </button>
                <button
                  onClick={() => router.push("/chats")}
                  className="glass px-6 py-3 rounded-xl font-semibold text-sm text-zinc-300 hover:bg-white/10 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Community
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Admin Slider Modal */}
      <AnimatePresence>
        {showSliderAdmin && (
          <SliderAdminModal
            slides={slides}
            onClose={() => setShowSliderAdmin(false)}
            onRefresh={loadSlides}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SliderAdminModal({ slides, onClose, onRefresh }: {
  slides: NewsSlide[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
      }
    } catch { /* ignore */ }
    finally { setUploading(false); }
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/admin/news-slider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, imageUrl, linkUrl }),
      });
      setTitle(""); setSubtitle(""); setImageUrl(""); setLinkUrl("");
      onRefresh();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function handleDelete(rowIndex: number) {
    try {
      await fetch("/api/admin/news-slider", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-[#111] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-bold flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#95BF47]" />
            News-Slider verwalten
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Existing slides */}
          {slides.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Aktuelle Slides</div>
              {slides.map((slide) => (
                <div key={slide.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  {slide.imageUrl && (
                    <img src={slide.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{slide.title}</div>
                    {slide.subtitle && <div className="text-[10px] text-zinc-500 truncate">{slide.subtitle}</div>}
                  </div>
                  <button
                    onClick={() => handleDelete(slide.rowIndex)}
                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New slide form */}
          <div className="space-y-3 pt-2 border-t border-white/[0.06]">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Neuer Slide</div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel *"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-600"
            />
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Untertitel (optional)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-600"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Bild-URL (oder hochladen)"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-600"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition shrink-0"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); e.target.value = ""; }} />
            </div>
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Link-URL (optional)"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-600"
            />
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleCreate}
              disabled={saving || !title.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-40 transition"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Erstelle..." : "Slide hinzufügen"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
