"use client";

// ─── /code-blocks ────────────────────────────────────────────────
// Customer tool (Silber + Gold): a library of Shopify custom-liquid
// snippets. Each block ships with a preview image and a set of
// admin-confirmed "options" (texts/colors) the user can tweak. The
// customiser does literal string replacement and offers one-click
// copy, plus a step-by-step "in Shopify einfügen" tutorial.

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Copy,
  Check,
  Loader2,
  X,
  Lock,
  Crown,
  Sliders,
  Image as ImageIcon,
  ArrowRight,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { CodeBlockPreview } from "@/components/CodeBlockPreview";

interface CodeBlockOption {
  id: string;
  label: string;
  type: "text" | "color";
  original: string;
}

interface CodeBlock {
  id: string;
  title: string;
  description: string;
  code: string;
  previewImageUrl: string;
  options: CodeBlockOption[];
  createdAt: string;
}

// Apply user values via literal string replacement. Longest originals
// first so a short token (#fff) never corrupts a longer one (#ffffff).
function applyOptions(
  code: string,
  options: CodeBlockOption[],
  values: Record<string, string>,
): string {
  let result = code;
  const sorted = [...options].sort((a, b) => b.original.length - a.original.length);
  for (const opt of sorted) {
    const val = values[opt.id];
    if (val === undefined || val === opt.original) continue;
    result = result.split(opt.original).join(val);
  }
  return result;
}

const SHOPIFY_STEPS = [
  {
    title: "Code kopieren",
    body: "Passe oben Texte und Farben an und klick auf den Button „Code kopieren“. Der fertige Code liegt jetzt in deiner Zwischenablage.",
  },
  {
    title: "Shopify Admin öffnen",
    body: "Gehe in deinem Shopify-Adminbereich auf Online Store → Themes. Klick beim aktiven Theme auf „Customize“.",
  },
  {
    title: "Abschnitt hinzufügen",
    body: "Wähle links die Seite oder den Bereich, wo der Block hin soll. Klick auf „Add section“ und dann auf „Custom Liquid“.",
  },
  {
    title: "Code einfügen",
    body: "Klick den neuen „Custom Liquid“-Block an. Lösch den Platzhalter-Inhalt und füge deinen kopierten Code mit Strg+V (⌘+V) ein.",
  },
  {
    title: "Speichern und prüfen",
    body: "Klick oben rechts auf „Save“. Schau dir die Vorschau an — fertig. Du kannst den Block jederzeit verschieben oder erneut anpassen.",
  },
];

export default function CodeBlocksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockTier, setLockTier] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<CodeBlock[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((sess) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        return fetch("/api/code-blocks");
      })
      .then(async (res) => {
        if (!res) return;
        if (res.status === 403) {
          const d = await res.json().catch(() => ({}));
          setLocked(true);
          setLockTier(d.tier ?? null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [router]);

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeId) || null,
    [blocks, activeId],
  );

  function openCustomizer(block: CodeBlock) {
    const init: Record<string, string> = {};
    for (const o of block.options) init[o.id] = o.original;
    setValues(init);
    setActiveId(block.id);
    setCopied(false);
    setTutorialOpen(false);
  }

  const finalCode = useMemo(() => {
    if (!activeBlock) return "";
    return applyOptions(activeBlock.code, activeBlock.options, values);
  }, [activeBlock, values]);

  async function copyCode() {
    if (!finalCode) return;
    try {
      await navigator.clipboard.writeText(finalCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard blocked — select fallback isn't critical, just ignore.
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Locked state — users ohne aktive Membership ──
  if (locked) {
    return (
      <div className="min-h-screen bg-mesh">
        <Navigation />
        <div className="max-w-xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl border border-white/10 p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-amber-300" />
            </div>
            <h1 className="text-lg font-bold">Code-Blöcke setzen eine aktive Membership voraus</h1>
            <p className="text-[12px] text-zinc-400 mt-2 leading-relaxed">
              Eine wachsende Bibliothek fertiger Shopify-Bausteine — Texte & Farben
              anpassen, kopieren, einfügen. Schalte sie mit der Brospify Membership frei.
            </p>
            <button
              onClick={() => router.push("/tiers")}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold"
              style={{
                background: "linear-gradient(135deg, #fde047 0%, #ca8a04 100%)",
                color: "#422006",
              }}
            >
              <Crown className="w-4 h-4" />
              Membership buchen
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-56 h-56 bg-cyan-500/[0.06] rounded-full blur-[110px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-base font-bold flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400 shrink-0" />
            Code-Blöcke
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Fertige Shopify-Bausteine — Texte & Farben anpassen, kopieren, in deinen Shop einfügen.
          </p>
        </motion.div>

        {/* Empty state */}
        {blocks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-xl p-6 border border-white/10 text-center"
          >
            <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <h2 className="text-sm font-bold mb-1">Noch keine Code-Blöcke verfügbar</h2>
            <p className="text-xs text-zinc-500">Sobald Bausteine hinterlegt sind, erscheinen sie hier.</p>
          </motion.div>
        )}

        {/* Grid */}
        {blocks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blocks.map((block, idx) => (
              <motion.button
                key={block.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * idx }}
                onClick={() => openCustomizer(block)}
                className="glass-strong rounded-xl border border-white/10 overflow-hidden flex flex-col text-left hover:border-cyan-500/30 transition group"
              >
                <div className="relative aspect-video bg-white border-b border-white/5 overflow-hidden">
                  {/* LIVE-Render aus dem Code ist jetzt der Default —
                      so sieht der User die echte Section statt einem
                      zufaellig hochgeladenen Bild. previewImageUrl nur
                      noch Fallback wenn der Code leer ist. */}
                  {block.code ? (
                    <CodeBlockPreview code={block.code} className="w-full h-full" />
                  ) : block.previewImageUrl ? (
                    <img
                      src={block.previewImageUrl}
                      alt={block.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-[11px] gap-1 bg-zinc-900">
                      <Code2 className="w-8 h-8" />
                      <span>Keine Vorschau</span>
                    </div>
                  )}
                  {/* Click-catcher: keeps the whole card clickable even
                      over the (non-interactive) preview iframe. */}
                  <div className="absolute inset-0" />
                  {block.options.length > 0 && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur border border-white/10 text-[10px] font-bold text-cyan-300 inline-flex items-center gap-1 z-10">
                      <Sliders className="w-2.5 h-2.5" />
                      {block.options.length} anpassbar
                    </span>
                  )}
                </div>
                <div className="p-3 flex flex-col flex-1 gap-1">
                  <h2 className="text-sm font-bold leading-tight truncate">{block.title}</h2>
                  {block.description && (
                    <p className="text-[11px] text-zinc-500 leading-snug line-clamp-2">{block.description}</p>
                  )}
                  <span className="mt-auto pt-2 text-[11px] font-semibold text-cyan-300 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Anpassen &amp; kopieren
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Customizer modal */}
      <AnimatePresence>
        {activeBlock && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={() => setActiveId(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl border border-white/10 w-full max-w-4xl my-2 overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold truncate">{activeBlock.title}</h2>
                  {activeBlock.description && (
                    <p className="text-[10px] text-zinc-500 truncate">{activeBlock.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setActiveId(null)}
                  className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/10 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 max-h-[78vh] overflow-y-auto">
                {/* Left: live preview + options */}
                <div className="p-4 space-y-3 border-b lg:border-b-0 lg:border-r border-white/[0.06]">
                  {/* Live preview — reflects the user's customisations in
                      real time. This IS the "Vorschaubild". */}
                  <div>
                    <h3 className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                      <ImageIcon className="w-3 h-3" />
                      Live-Vorschau
                    </h3>
                    <div className="rounded-lg overflow-hidden bg-white border border-white/10 h-[220px]">
                      <CodeBlockPreview code={finalCode} interactive className="w-full h-full" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400 mb-2 flex items-center gap-1.5">
                      <Sliders className="w-3 h-3" />
                      Anpassen
                    </h3>
                    {activeBlock.options.length === 0 ? (
                      <p className="text-[11px] text-zinc-500">
                        Dieser Block hat keine vordefinierten Optionen — kopier ihn direkt und passe ihn in Shopify an.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {activeBlock.options.map((opt) => (
                          <div key={opt.id}>
                            <label className="block text-[10px] text-zinc-400 font-medium mb-1">{opt.label}</label>
                            {opt.type === "color" ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={/^#[0-9a-fA-F]{6}$/.test(values[opt.id] || "") ? values[opt.id] : "#000000"}
                                  onChange={(e) => setValues((v) => ({ ...v, [opt.id]: e.target.value }))}
                                  className="w-9 h-9 rounded-lg border border-white/10 cursor-pointer bg-transparent shrink-0"
                                />
                                <input
                                  type="text"
                                  value={values[opt.id] ?? ""}
                                  onChange={(e) => setValues((v) => ({ ...v, [opt.id]: e.target.value }))}
                                  className="input-glass flex-1 text-xs font-mono"
                                />
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={values[opt.id] ?? ""}
                                onChange={(e) => setValues((v) => ({ ...v, [opt.id]: e.target.value }))}
                                className="input-glass w-full text-xs"
                              />
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const reset: Record<string, string> = {};
                            for (const o of activeBlock.options) reset[o.id] = o.original;
                            setValues(reset);
                          }}
                          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition"
                        >
                          Auf Original zurücksetzen
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: code + copy + tutorial */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400 flex items-center gap-1.5">
                      <Code2 className="w-3 h-3" />
                      Dein Code
                    </h3>
                    <button
                      onClick={copyCode}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                        copied
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/25"
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Kopiert!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Code kopieren
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="text-[10px] leading-relaxed bg-black/50 border border-white/10 rounded-lg p-3 overflow-x-auto max-h-[260px] overflow-y-auto font-mono text-zinc-300 whitespace-pre-wrap break-all">
                    {finalCode}
                  </pre>

                  {/* Tutorial */}
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setTutorialOpen((o) => !o)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] transition text-left"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="text-[11px] font-semibold flex-1">So fügst du den Code in Shopify ein</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-zinc-500 transition ${tutorialOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <AnimatePresence>
                      {tutorialOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <ol className="p-3 space-y-2.5">
                            {SHOPIFY_STEPS.map((step, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold flex items-center justify-center">
                                  {i + 1}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-[11px] font-semibold text-zinc-200">{step.title}</div>
                                  <div className="text-[10px] text-zinc-500 leading-snug">{step.body}</div>
                                </div>
                              </li>
                            ))}
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
