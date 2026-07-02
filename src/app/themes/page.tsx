"use client";

// ─── /themes — Shopify-Theme-Download für Kunden ─────────────────
// Listet die vom Admin hochgeladenen Theme-ZIPs (neueste zuerst). Ein
// Klick lädt die Blob-Datei. Ein ausklappbares "Hilfe"-Panel erklärt
// Schritt für Schritt den Import in Shopify.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutTemplate,
  Download,
  Sparkles,
  HelpCircle,
  ChevronDown,
  Package,
  CheckCircle2,
  ArrowRight,
  Wand2,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useI18n, type Locale } from "@/lib/i18n";

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

          {/* Theme-Editor v2 — Produkt wählen, gestalten, herunterladen */}
          <div className="mt-5">
            <EditorLinkCard />
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

// ─── Editor-Einstieg ─────────────────────────────────────────────
// Der eigentliche Theme-Bau lebt jetzt im vollwertigen Editor unter
// /themes/editor (Produkt-zuerst-Flow, Split-Pane, Section-Bibliothek).

function EditorLinkCard() {
  const { t } = useI18n();
  return (
    <Link
      href="/themes/editor"
      className="group block glass-strong rounded-2xl border border-[#95BF47]/25 p-4 sm:p-5 hover:border-[#95BF47]/50 transition"
      style={{ background: "var(--accent-light)" }}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${ACCENT}1f`, border: `1px solid ${ACCENT}44` }}
        >
          <Wand2 className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-white">{t.themes.editorOpen}</h3>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#95BF47]/15 text-[#cfe9a3] border border-[#95BF47]/25">
              Neu
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-zinc-400 leading-snug">{t.themes.editorOpenSub}</p>
        </div>
        <span className="btn-deploy flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 text-[12.5px] sm:text-[13px] shrink-0">
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">{t.themes.editorTitle}</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </Link>
  );
}