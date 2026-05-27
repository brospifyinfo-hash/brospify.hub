"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Package,
  Check,
  ChevronRight,
  Sparkles,
  PenTool,
  Plus,
  Loader2,
  X,
  Upload,
  Trash2,
  Newspaper,
  FileText,
  ImageUp,
  Scissors,
  Camera,
  BarChart3,
  Mail,
  Play,
  Pencil,
  Eye,
  EyeOff,
  Megaphone,
  Zap,
  ListChecks,
  Link2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  GripVertical,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { useTier } from "@/lib/use-tier";
import Link from "next/link";
import { Crown, Lock } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyConnection: boolean;
  hasShopifyToken: boolean;
  shopDomain?: string;
  googleName?: string;
}

interface Checklist {
  setup_complete?: boolean;
  product_imported?: boolean;
  dropshipping_app?: boolean;
  aliexpress_link?: boolean;
  legal_texts_generated?: boolean;
  theme_pushed?: boolean;
}

interface NewsPost {
  rowIndex: number;
  id: string;
  type: "text" | "video";
  title: string;
  body: string;
  imageUrl: string;
  youtubeUrl: string;
  previewImageUrl: string;
  active: boolean;
  createdAt: string;
}

interface StartTask {
  rowIndex: number;
  id: string;
  title: string;
  bodyHtml: string;
  sort: number;
  active: boolean;
  createdAt: string;
}

const SETUP_STEPS: { key: keyof Checklist; label: string }[] = [
  { key: "setup_complete", label: "Shop verbunden" },
  { key: "product_imported", label: "Produkt importiert" },
  { key: "dropshipping_app", label: "Dropshipping-App" },
  { key: "aliexpress_link", label: "AliExpress-Link" },
  { key: "legal_texts_generated", label: "Rechtstexte" },
  { key: "theme_pushed", label: "Theme aktiv" },
];

const QUICK_TILES = [
  { title: "Setup", desc: "Shop verbinden", href: "/setup", icon: Store, color: "#10B981" },
  { title: "Produkte", desc: "Charts", href: "/charts", icon: Package, color: "#8B5CF6" },
  { title: "Blog", desc: "KI-Writer", href: "/blog", icon: PenTool, color: "#A855F7" },
  { title: "SEO", desc: "Audit", href: "/seo", icon: BarChart3, color: "#06B6D4" },
  { title: "Studio", desc: "Fotos", href: "/ai-tools/ai-studio", icon: Camera, color: "#F59E0B" },
  { title: "Freistellen", desc: "BG weg", href: "/ai-tools/background-remover", icon: Scissors, color: "#F43F5E" },
  { title: "Upscale", desc: "4× HD", href: "/ai-tools/hybrid-upscaler", icon: ImageUp, color: "#95BF47" },
  { title: "Mails", desc: "Templates", href: "/email-templates", icon: Mail, color: "#F43F5E" },
];

// ─── Page ─────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const tierState = useTier();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checklist, setChecklist] = useState<Checklist>({});
  const [tasksDone, setTasksDone] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [newsAdminOpen, setNewsAdminOpen] = useState(false);
  const [activePost, setActivePost] = useState<NewsPost | null>(null);

  const [tasks, setTasks] = useState<StartTask[]>([]);
  const [tasksAdminOpen, setTasksAdminOpen] = useState(false);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/news");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/start-tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
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
        setTasksDone(profile.onboarding_tasks_done || {});
        setLoading(false);
      })
      .catch(() => router.push("/"));

    loadPosts();
    loadTasks();
  }, [router, loadPosts, loadTasks]);

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completed = SETUP_STEPS.filter((s) => checklist[s.key]).length;
  const progress = (completed / SETUP_STEPS.length) * 100;
  const allDone = completed === SETUP_STEPS.length;
  const firstName = (session.googleName || "").split(" ")[0] || "";

  async function toggleTaskDone(id: string, nextDone: boolean) {
    setTasksDone((prev) => {
      const next = { ...prev };
      if (nextDone) next[id] = true;
      else delete next[id];
      return next;
    });
    try {
      await fetch("/api/start-tasks/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done: nextDone }),
      });
    } catch { /* keep optimistic value */ }
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-20 right-6 w-56 h-56 bg-[#95BF47]/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-20 left-6 w-48 h-48 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">

        {/* ─── Greeting ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold leading-tight truncate">
              {firstName ? `Hi ${firstName} ` : "Willkommen "}
              <span className="text-[#95BF47]">{allDone ? "\u{1F389}" : "\u{1F44B}"}</span>
            </h1>
            {session.shopDomain && (
              <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5 flex items-center gap-1 truncate">
                <Store className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{session.shopDomain}</span>
              </p>
            )}
          </div>
        </motion.div>

        {/* ─── Abo-Status Banner ─────────────────────── */}
        <AboStatusBanner tierState={tierState} isAdmin={!!session.isAdmin} />

        {/* ─── Compact setup progress ─────────────────── */}
        <CompactProgress
          completed={completed}
          total={SETUP_STEPS.length}
          progress={progress}
          allDone={allDone}
          steps={SETUP_STEPS.map((s) => ({ label: s.label, done: !!checklist[s.key] }))}
          onClick={() => router.push("/setup")}
        />

        {/* ─── Start-Tasks (Bis du verkaufst) ──────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <SectionHeader
              icon={ListChecks}
              title="Bis du verkaufst"
              sub="Hak die Schritte ab, sobald du sie erledigt hast."
              inline
            />
            {session.isAdmin && (
              <button
                onClick={() => setTasksAdminOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 hover:bg-white/[0.08] transition shrink-0"
              >
                <Plus className="w-3 h-3" /> Verwalten
              </button>
            )}
          </div>
          <StartTasksList
            tasks={tasks.filter((t) => t.active || session.isAdmin)}
            doneMap={tasksDone}
            onToggle={toggleTaskDone}
            adminEmpty={tasks.length === 0 && session.isAdmin}
            onOpenAdmin={() => setTasksAdminOpen(true)}
          />
        </section>

        {/* ─── Quick Tiles ───────────────────────────── */}
        <section>
          <SectionHeader icon={Zap} title="Schnellzugriff" />
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
            {QUICK_TILES.map((tile, i) => (
              <motion.button
                key={tile.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.02 * i }}
                whileTap={{ scale: 0.93 }}
                onClick={() => router.push(tile.href)}
                className="group relative flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 transition-all overflow-hidden"
              >
                <div
                  className="absolute -top-6 -right-6 w-12 h-12 rounded-full opacity-20 blur-xl group-hover:opacity-35 transition"
                  style={{ background: tile.color }}
                />
                <div
                  className="relative w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
                  style={{ backgroundColor: `${tile.color}15`, borderColor: `${tile.color}30` }}
                >
                  <tile.icon className="w-4 h-4" style={{ color: tile.color, width: 16, height: 16 }} />
                </div>
                <div className="relative text-center">
                  <div className="text-[10px] font-semibold text-white leading-tight">{tile.title}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* ─── News Section ──────────────────────── */}
        {(posts.length > 0 || session.isAdmin) && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <SectionHeader icon={Newspaper} title="News & Updates" inline />
              {session.isAdmin && (
                <button
                  onClick={() => setNewsAdminOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 hover:bg-white/[0.08] transition"
                >
                  <Plus className="w-3 h-3" /> Verwalten
                </button>
              )}
            </div>

            {posts.length === 0 && session.isAdmin ? (
              <button
                onClick={() => setNewsAdminOpen(true)}
                className="w-full p-4 rounded-xl border border-dashed border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition flex items-center justify-center gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Erste News-Card erstellen
              </button>
            ) : (
              <NewsRow posts={posts.filter((p) => p.active)} onOpenText={(p) => setActivePost(p)} />
            )}
          </section>
        )}

      </div>

      <AnimatePresence>
        {newsAdminOpen && (
          <NewsAdminModal posts={posts} onClose={() => setNewsAdminOpen(false)} onRefresh={loadPosts} />
        )}
        {activePost && activePost.type === "text" && (
          <NewsTextDetail post={activePost} onClose={() => setActivePost(null)} />
        )}
        {tasksAdminOpen && (
          <StartTasksAdminModal
            tasks={tasks}
            onClose={() => setTasksAdminOpen(false)}
            onRefresh={loadTasks}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section header ──────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub, inline }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "mb-2"}>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-md bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
          <Icon className="w-3 h-3 text-[#95BF47]" />
        </div>
        <h2 className="text-[12px] font-bold text-zinc-200">{title}</h2>
      </div>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5 ml-6">{sub}</p>}
    </div>
  );
}

// ─── Compact progress ─────────────────────────────────────────

function CompactProgress({ completed, total, progress, allDone, steps, onClick }: {
  completed: number;
  total: number;
  progress: number;
  allDone: boolean;
  steps: { label: string; done: boolean }[];
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.99 }}
      className="w-full glass-strong rounded-xl border border-white/10 p-2.5 sm:p-3 text-left group"
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#95BF47] shrink-0" />
          <span className="text-[12px] font-semibold truncate">
            {allDone ? "Setup abgeschlossen" : "Setup-Fortschritt"}
          </span>
          <span className="text-[10px] text-zinc-500">·</span>
          <span className="text-[11px] font-bold text-[#95BF47] tabular-nums shrink-0">{completed}/{total}</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition shrink-0" />
      </div>

      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#95BF47] to-[#B8D96E]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
        />
      </div>

      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
        {steps.map((s) => (
          <span
            key={s.label}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border whitespace-nowrap shrink-0 ${
              s.done
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-500"
            }`}
          >
            {s.done && <Check className="w-2 h-2" />}
            {s.label}
          </span>
        ))}
      </div>
    </motion.button>
  );
}

// ─── Start-tasks list (user view) ────────────────────────────

function StartTasksList({ tasks, doneMap, onToggle, adminEmpty, onOpenAdmin }: {
  tasks: StartTask[];
  doneMap: Record<string, boolean>;
  onToggle: (id: string, next: boolean) => void;
  adminEmpty: boolean;
  onOpenAdmin: () => void;
}) {
  if (adminEmpty && tasks.length === 0) {
    return (
      <button
        onClick={onOpenAdmin}
        className="w-full p-4 rounded-xl border border-dashed border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20 transition flex items-center justify-center gap-1.5 text-xs"
      >
        <Plus className="w-3.5 h-3.5" /> Erste Start-Aufgabe anlegen
      </button>
    );
  }
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-[12px] text-zinc-500">
        Bisher keine Aufgaben hinterlegt. Schau bald wieder rein.
      </div>
    );
  }
  const totalActive = tasks.filter((t) => t.active).length;
  const doneCount = tasks.filter((t) => t.active && doneMap[t.id]).length;
  const allDone = totalActive > 0 && doneCount === totalActive;
  return (
    <div className="space-y-1.5">
      {totalActive > 0 && (
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold mb-1.5">
          <span className="text-zinc-500">Fortschritt</span>
          <span className={allDone ? "text-emerald-300" : "text-zinc-400"}>
            {doneCount}/{totalActive}
            {allDone && " · Du bist startklar! \u{1F680}"}
          </span>
        </div>
      )}
      {tasks.map((t, i) => (
        <StartTaskItem
          key={t.id}
          task={t}
          done={!!doneMap[t.id]}
          onToggle={(next) => onToggle(t.id, next)}
          index={i}
        />
      ))}
    </div>
  );
}

function StartTaskItem({ task, done, onToggle, index }: {
  task: StartTask;
  done: boolean;
  onToggle: (next: boolean) => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition ${
        done
          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
          : task.active
            ? "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
            : "border-white/[0.04] bg-white/[0.01] opacity-60"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(!done)}
        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
          done
            ? "bg-emerald-500 border-emerald-400 text-black"
            : "bg-white/[0.02] border-white/15 text-transparent hover:border-white/35"
        }`}
        aria-label={done ? "Aufgabe entmarkieren" : "Aufgabe als erledigt markieren"}
      >
        <Check className="w-3.5 h-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-[13px] font-semibold leading-snug ${done ? "text-emerald-200 line-through decoration-emerald-400/50" : "text-zinc-100"}`}>
          {task.title}
          {!task.active && (
            <span className="ml-2 text-[9px] uppercase tracking-widest text-zinc-500 font-bold">
              inaktiv
            </span>
          )}
        </div>
        {task.bodyHtml && (
          <div
            className="text-[12px] text-zinc-400 leading-relaxed mt-1 task-html"
            dangerouslySetInnerHTML={{ __html: task.bodyHtml }}
          />
        )}
      </div>
    </motion.div>
  );
}

// ─── Start-tasks admin modal ────────────────────────────────

function StartTasksAdminModal({ tasks, onClose, onRefresh }: {
  tasks: StartTask[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<StartTask | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c0c] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
            <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-[#95BF47]" />
            Start-Aufgaben verwalten
          </h3>
          <div className="flex items-center gap-2">
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#95BF47] text-black font-semibold text-xs hover:brightness-110 transition"
              >
                <Plus className="w-3 h-3" /> Neu
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg transition">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {creating ? (
            <StartTaskForm onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); onRefresh(); }} />
          ) : editing ? (
            <StartTaskForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />
          ) : (
            <StartTaskAdminList tasks={tasks} onEdit={setEditing} onRefresh={onRefresh} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function StartTaskAdminList({ tasks, onEdit, onRefresh }: {
  tasks: StartTask[];
  onEdit: (t: StartTask) => void;
  onRefresh: () => void;
}) {
  async function handleDelete(rowIndex: number) {
    if (!confirm("Aufgabe löschen?")) return;
    await fetch("/api/admin/start-tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex }),
    });
    onRefresh();
  }
  async function toggleActive(t: StartTask) {
    await fetch("/api/admin/start-tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: t.rowIndex, active: !t.active }),
    });
    onRefresh();
  }
  async function move(t: StartTask, delta: number) {
    // Sort uses gaps of 10 so we can re-shuffle without re-numbering
    // every neighbour. We swap sort values with the adjacent task.
    const sorted = [...tasks].sort((a, b) => a.sort - b.sort);
    const idx = sorted.findIndex((x) => x.id === t.id);
    const target = sorted[idx + delta];
    if (!target) return;
    await Promise.all([
      fetch("/api/admin/start-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: t.rowIndex, sort: target.sort }),
      }),
      fetch("/api/admin/start-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: target.rowIndex, sort: t.sort }),
      }),
    ]);
    onRefresh();
  }
  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        Noch keine Aufgaben. Tippe oben auf „Neu&ldquo;.
      </div>
    );
  }
  const sorted = [...tasks].sort((a, b) => a.sort - b.sort);
  return (
    <div className="space-y-1.5">
      {sorted.map((t, i) => (
        <div key={t.id} className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex flex-col items-center gap-0.5 pt-1 shrink-0 text-zinc-500">
            <GripVertical className="w-3.5 h-3.5" />
            <button onClick={() => move(t, -1)} disabled={i === 0} className="p-0.5 hover:text-white disabled:opacity-30">
              <ArrowUp className="w-3 h-3" />
            </button>
            <button onClick={() => move(t, 1)} disabled={i === sorted.length - 1} className="p-0.5 hover:text-white disabled:opacity-30">
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              {!t.active && <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">inaktiv</span>}
            </div>
            <div className="text-xs sm:text-sm font-semibold leading-snug">{t.title}</div>
            {t.bodyHtml && (
              <div
                className="text-[11px] text-zinc-400 leading-snug mt-1 line-clamp-2 task-html"
                dangerouslySetInnerHTML={{ __html: t.bodyHtml }}
              />
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => toggleActive(t)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition">
              {t.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onEdit(t)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(t.rowIndex)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StartTaskForm({ initial, onCancel, onSaved }: {
  initial?: StartTask;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [bodyHtml, setBodyHtml] = useState(initial?.bodyHtml || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await fetch("/api/admin/start-tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIndex: initial.rowIndex, title, bodyHtml }),
        });
      } else {
        await fetch("/api/admin/start-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, bodyHtml }),
        });
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
          Titel
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="z. B. Lege deinen ersten Artikel an"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-600"
        />
      </div>

      <div>
        <label className="block text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1">
          Beschreibung
        </label>
        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
        <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
          Markiere ein Wort und tippe auf <Link2 className="w-2.5 h-2.5 inline -mt-0.5" /> um einen Link einzufügen. Du kannst auch
          <strong className="text-zinc-300"> fett</strong> und <em className="text-zinc-300">kursiv</em> setzen.
        </p>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-zinc-300 hover:bg-white/[0.08] transition"
        >
          Abbrechen
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#95BF47] text-black font-bold text-xs sm:text-sm disabled:opacity-40 transition"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial ? "Speichern" : "Erstellen"}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Rich-text editor (selection → link) ─────────────────────
// contentEditable surface with three actions: fett, kursiv, link.
// The link action takes the current selection and wraps it with
// a sanitised <a href=…>. We keep the HTML simple so the server-
// side sanitiser can handle it deterministically. Empty content
// reports back as "" so we don't store <br/> placeholders.

function RichTextEditor({ value, onChange }: {
  value: string;
  onChange: (next: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkHref, setLinkHref] = useState("");
  const savedRange = useRef<Range | null>(null);

  // Hydrate the editor once. We can't keep mirroring `value` into
  // innerHTML on every change because that would wipe the caret on
  // every keystroke. Re-sync only if the prop diverges significantly
  // (parent rewrites it, e.g. after save+reopen).
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function emit() {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML.trim();
    onChange(html === "<br>" || html === "<div><br></div>" ? "" : html);
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    const sel = window.getSelection();
    if (!sel || !savedRange.current) return;
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
  }

  function execFormat(cmd: "bold" | "italic") {
    editorRef.current?.focus();
    // execCommand is officially deprecated but still the simplest
    // path for a minimal selection-aware editor. Modern Selection
    // API alternatives would balloon this file 5×.
    document.execCommand(cmd);
    emit();
  }

  function openLinkPrompt() {
    saveSelection();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      alert("Markiere zuerst das Wort, das verlinkt werden soll.");
      return;
    }
    setLinkHref("https://");
    setShowLink(true);
  }

  function applyLink() {
    if (!linkHref.trim()) { setShowLink(false); return; }
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand("createLink", false, linkHref.trim());
    // Force target=_blank on the just-created anchor.
    const sel = window.getSelection();
    let node: Node | null = sel?.anchorNode || null;
    while (node && node !== editorRef.current) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === "A") {
        (node as HTMLAnchorElement).setAttribute("target", "_blank");
        (node as HTMLAnchorElement).setAttribute("rel", "noopener noreferrer");
        break;
      }
      node = node.parentNode;
    }
    setShowLink(false);
    setLinkHref("");
    emit();
  }

  function removeLink() {
    editorRef.current?.focus();
    document.execCommand("unlink");
    emit();
  }

  return (
    <div className="border border-white/[0.08] rounded-xl bg-white/[0.04] overflow-hidden focus-within:border-[#95BF47]/40 transition">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-white/[0.06] bg-white/[0.02]">
        <ToolbarButton onClick={() => execFormat("bold")} title="Fett (Strg+B)">
          <span className="font-bold text-[12px]">B</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => execFormat("italic")} title="Kursiv (Strg+I)">
          <span className="italic text-[12px]">I</span>
        </ToolbarButton>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <ToolbarButton onClick={openLinkPrompt} title="Link an Markierung setzen">
          <Link2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={removeLink} title="Link entfernen">
          <span className="text-[10px] font-bold">x↗</span>
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        className="task-html min-h-[110px] px-3 py-2.5 text-sm text-zinc-100 outline-none leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600"
        data-placeholder="Optionale Beschreibung — markiere Wörter und mach sie zu Links."
      />
      {showLink && (
        <div className="flex items-center gap-2 px-2 py-2 border-t border-white/[0.06] bg-white/[0.02]">
          <Link2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <input
            type="url"
            autoFocus
            value={linkHref}
            onChange={(e) => setLinkHref(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }}
            placeholder="https://…"
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#95BF47]/40 placeholder:text-zinc-600"
          />
          <button onClick={applyLink} className="px-2.5 py-1.5 rounded-md bg-[#95BF47] text-black font-semibold text-xs">
            Setzen
          </button>
          <button onClick={() => { setShowLink(false); setLinkHref(""); }} className="px-2 py-1.5 rounded-md text-zinc-500 hover:text-white text-xs">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ children, onClick, title }: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-md text-zinc-300 hover:bg-white/[0.08] hover:text-white inline-flex items-center justify-center transition"
    >
      {children}
    </button>
  );
}

// ─── News row ────────────────────────────────────────────────

function NewsRow({ posts, onOpenText }: {
  posts: NewsPost[];
  onOpenText: (p: NewsPost) => void;
}) {
  if (posts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
      {posts.map((p) => (
        <NewsCard key={p.id} post={p} onOpenText={onOpenText} />
      ))}
    </div>
  );
}

function NewsCard({ post, onOpenText }: {
  post: NewsPost;
  onOpenText: (p: NewsPost) => void;
}) {
  const isVideo = post.type === "video" && post.youtubeUrl;
  const cover = isVideo ? (post.previewImageUrl || post.imageUrl) : post.imageUrl;
  const [open, setOpen] = useState(false);

  function handleClick() {
    if (isVideo) setOpen(true);
    else onOpenText(post);
  }

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className="group relative rounded-xl sm:rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:border-white/15 transition overflow-hidden text-left"
      >
        {cover ? (
          <div className="relative h-28 sm:h-40 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt={post.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition">
                  <Play className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-white ml-0.5" fill="currentColor" />
                </div>
              </div>
            )}
            <div className="absolute top-2 left-2">
              <span className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-widest border ${
                isVideo
                  ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                  : "bg-[#95BF47]/20 border-[#95BF47]/30 text-[#95BF47]"
              }`}>
                {isVideo ? <Play className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> : <FileText className="w-2 h-2 sm:w-2.5 sm:h-2.5" />}
                {isVideo ? "Video" : "News"}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3.5">
              <h3 className="text-[12px] sm:text-sm font-bold text-white leading-tight line-clamp-2">{post.title}</h3>
            </div>
          </div>
        ) : (
          <div className="p-3 sm:p-5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Megaphone className="w-3 h-3 sm:w-4 sm:h-4 text-[#95BF47]" />
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-[#95BF47]">News</span>
            </div>
            <h3 className="text-[12px] sm:text-sm font-bold leading-snug">{post.title}</h3>
            {post.body && (
              <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-1 line-clamp-2">{post.body.slice(0, 140)}</p>
            )}
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {open && isVideo && (
          <VideoModal url={post.youtubeUrl} title={post.title} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── News text detail modal ─────────────────────────────────

function NewsTextDetail({ post, onClose }: { post: NewsPost; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c0c] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {post.imageUrl && (
          <div className="relative h-44 sm:h-56 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 border border-white/10 text-white hover:bg-black/80 transition backdrop-blur-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="p-4 sm:p-6 overflow-y-auto">
          {!post.imageUrl && (
            <div className="flex items-center justify-end mb-2">
              <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>
          )}
          <h2 className="text-lg sm:text-2xl font-bold leading-tight mb-2 sm:mb-3">{post.title}</h2>
          <div className="text-[13px] sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{post.body}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function youtubeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      if (u.pathname.startsWith("/embed/")) return `${url}${url.includes("?") ? "&" : "?"}autoplay=1`;
    }
  } catch { /* fallthrough */ }
  return url;
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-2 sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-black rounded-xl sm:rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
      >
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/10">
          <h3 className="text-xs sm:text-sm font-semibold truncate">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg transition shrink-0 ml-2">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="aspect-video bg-black">
          <iframe
            src={youtubeEmbedUrl(url)}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── News admin modal ───────────────────────────────────────

function NewsAdminModal({ posts, onClose, onRefresh }: {
  posts: NewsPost[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0c0c0c] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[88vh] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
            <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 text-[#95BF47]" />
            News verwalten
          </h3>
          <div className="flex items-center gap-2">
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#95BF47] text-black font-semibold text-xs hover:brightness-110 transition"
              >
                <Plus className="w-3 h-3" /> Neu
              </button>
            )}
            <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg transition">
              <X className="w-4 h-4 text-zinc-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {creating ? (
            <NewsForm onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); onRefresh(); }} />
          ) : editing ? (
            <NewsForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />
          ) : (
            <NewsList posts={posts} onEdit={setEditing} onRefresh={onRefresh} />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function NewsList({ posts, onEdit, onRefresh }: {
  posts: NewsPost[];
  onEdit: (p: NewsPost) => void;
  onRefresh: () => void;
}) {
  async function handleDelete(rowIndex: number) {
    if (!confirm("News-Card löschen?")) return;
    try {
      await fetch("/api/admin/news", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  async function toggleActive(p: NewsPost) {
    try {
      await fetch("/api/admin/news", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: p.rowIndex, active: !p.active }),
      });
      onRefresh();
    } catch { /* ignore */ }
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-10 text-zinc-500 text-sm">
        Noch keine News-Cards. Tippe oben auf „Neu&ldquo;.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {posts.map((p) => (
        <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {(p.imageUrl || p.previewImageUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl || p.previewImageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-zinc-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                p.type === "video" ? "bg-rose-500/15 text-rose-300" : "bg-[#95BF47]/15 text-[#95BF47]"
              }`}>
                {p.type === "video" ? "Video" : "Text"}
              </span>
              {!p.active && <span className="text-[8px] text-zinc-500 uppercase">inaktiv</span>}
            </div>
            <div className="text-xs sm:text-sm font-semibold truncate">{p.title}</div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => toggleActive(p)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition">
              {p.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onEdit(p)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-lg transition">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDelete(p.rowIndex)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsForm({ initial, onCancel, onSaved }: {
  initial?: NewsPost;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"text" | "video">(initial?.type || "text");
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl || "");
  const [previewImageUrl, setPreviewImageUrl] = useState(initial?.previewImageUrl || "");
  const [saving, setSaving] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  async function uploadFile(file: File, setUrl: (u: string) => void, setBusy: (b: boolean) => void) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setUrl(data.url);
      }
    } catch { /* ignore */ }
    finally { setBusy(false); }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (initial) {
        await fetch("/api/admin/news", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rowIndex: initial.rowIndex, type, title, body, imageUrl, youtubeUrl, previewImageUrl,
          }),
        });
      } else {
        await fetch("/api/admin/news", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, title, body, imageUrl, youtubeUrl, previewImageUrl }),
        });
      }
      onSaved();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setType("text")}
          className={`p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            type === "text"
              ? "bg-[#95BF47]/15 border-[#95BF47]/40 text-[#95BF47]"
              : "bg-white/[0.03] border-white/10 text-zinc-400"
          }`}
        >
          <FileText className="w-3.5 h-3.5" /> Text
        </button>
        <button
          onClick={() => setType("video")}
          className={`p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            type === "video"
              ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
              : "bg-white/[0.03] border-white/10 text-zinc-400"
          }`}
        >
          <Play className="w-3.5 h-3.5" /> Video
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel *"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-600"
      />

      {type === "text" ? (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Text-Inhalt"
            rows={5}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-600 resize-y"
          />
          <FileUploadField label="Cover-Bild" url={imageUrl} setUrl={setImageUrl} inputRef={imageInputRef} uploading={uploadingImage} onPick={(f) => uploadFile(f, setImageUrl, setUploadingImage)} />
        </>
      ) : (
        <>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="YouTube-URL"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500/40 transition placeholder:text-zinc-600"
          />
          <FileUploadField label="Vorschaubild" url={previewImageUrl} setUrl={setPreviewImageUrl} inputRef={previewInputRef} uploading={uploadingPreview} onPick={(f) => uploadFile(f, setPreviewImageUrl, setUploadingPreview)} />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Beschreibung (optional)"
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-rose-500/40 transition placeholder:text-zinc-600 resize-y"
          />
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-zinc-300 hover:bg-white/[0.08] transition"
        >
          Abbrechen
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#95BF47] text-black font-bold text-xs sm:text-sm disabled:opacity-40 transition"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial ? "Speichern" : "Erstellen"}
        </motion.button>
      </div>
    </div>
  );
}

function FileUploadField({ label, url, setUrl, inputRef, uploading, onPick }: {
  label: string;
  url: string;
  setUrl: (u: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onPick: (f: File) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">{label}</div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL (oder hochladen)"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-xs sm:text-sm outline-none focus:border-white/20 transition placeholder:text-zinc-600"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition shrink-0"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
        />
      </div>
      {url && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Preview" className="w-full h-24 object-cover rounded-lg border border-white/10" />
          <button
            onClick={() => setUrl("")}
            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 border border-white/10 text-white hover:bg-black/90 transition"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Abo-Status Banner ─────────────────────────────────────────

function AboStatusBanner({ tierState, isAdmin }: { tierState: ReturnType<typeof useTier>; isAdmin: boolean }) {
  const tier = tierState.tier;
  if (tierState.loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[10px] text-zinc-500">
        Lade Abo-Status…
      </div>
    );
  }
  if (isAdmin) {
    return (
      <Link
        href="/tiers"
        className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] to-transparent px-3 py-2 hover:from-amber-500/[0.12] transition"
      >
        <Crown className="w-3.5 h-3.5 text-amber-300 shrink-0" />
        <span className="text-[11px] font-bold text-amber-200">Admin · alle Tiers freigeschaltet</span>
        <ArrowRight className="w-3 h-3 text-amber-300 ml-auto shrink-0" />
      </Link>
    );
  }
  if (!tier) {
    return (
      <Link
        href="/tiers"
        className="relative overflow-hidden flex items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.10] via-amber-500/[0.04] to-transparent px-3 py-2.5 hover:from-amber-500/[0.16] transition group"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-amber-400/40" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.30), rgba(245,158,11,0.08))" }}>
          <Lock className="w-4 h-4 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-amber-100">Kein aktives Abo</div>
          <div className="text-[10px] text-amber-200/80 leading-snug">
            Wähle Bronze, Silber oder Gold — schalte alle Tools frei.
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-200 group-hover:text-amber-100 shrink-0">
          Plan wählen
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
        <ArrowRight className="sm:hidden w-4 h-4 text-amber-200 shrink-0" />
      </Link>
    );
  }
  const key = tier.key;
  const metal =
    key === "starter"
      ? "linear-gradient(135deg, #c2410c 0%, #92400e 100%)"
      : key === "pro"
        ? "linear-gradient(135deg, #cbd5e1 0%, #64748b 100%)"
        : "linear-gradient(135deg, #fde047 0%, #ca8a04 100%)";
  const ringColor =
    key === "starter" ? "rgba(217,119,6,0.55)" : key === "pro" ? "rgba(203,213,225,0.65)" : "rgba(250,204,21,0.75)";
  const iconColor =
    key === "starter" ? "#fff7ed" : key === "pro" ? "#0f172a" : "#422006";
  return (
    <Link
      href="/tiers"
      className="relative overflow-hidden flex items-center gap-3 rounded-xl border border-white/[0.08] px-3 py-2.5 hover:bg-white/[0.02] transition group"
      style={{ boxShadow: `inset 0 0 0 1px ${ringColor}` }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/[0.10]"
        style={{ background: metal, boxShadow: `0 4px 14px -4px ${ringColor}` }}
      >
        <Crown className="w-4.5 h-4.5" style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-400">
            Aktives Abo
          </span>
          <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            aktiv
          </span>
        </div>
        <div className="text-[12px] font-bold leading-tight truncate">
          {tier.label}
          {tier.priceMonthlyEur > 0 && (
            <span className="text-zinc-500 font-normal"> · {tier.priceMonthlyEur} €/Mo</span>
          )}
        </div>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 group-hover:text-zinc-200 shrink-0">
        Verwalten
        <ArrowRight className="w-3 h-3" />
      </span>
      <ArrowRight className="sm:hidden w-4 h-4 text-zinc-500 shrink-0" />
    </Link>
  );
}
