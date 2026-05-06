"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BarChart3,
  Palette,
  Settings,
  LogOut,
  Menu,
  X,
  PenTool,
  ChevronDown,
  ChevronRight,
  BarChart,
  Bot,
  Mail,
  Sparkles,
  ImageUp,
  Scissors,
  Camera,
  Plus,
  FolderHeart,
  Store,
  User as UserIcon,
  FileText,
  Shield,
  Scale,
  Receipt,
  Undo2,
  ExternalLink,
  Inbox,
  Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BrandLogo, useBranding } from "@/lib/branding";
import { useCredits } from "@/lib/credits";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  googleName?: string;
  googleEmail?: string;
  googleImage?: string;
  lizenzschluessel?: string | null;
  impersonatedBy?: string | null;
}

const NAV_ITEMS = [
  { href: "/home", labelKey: "home" as const, icon: Home },
  { href: "/charts", labelKey: "charts" as const, icon: BarChart3 },
  { href: "/library", labelKey: "library" as const, icon: FolderHeart },
  { href: "/themes", labelKey: "themes" as const, icon: Palette },
];

const AI_TOOLS = [
  {
    href: "/email-templates",
    title: "AI Email Generator",
    desc: "10 Shopify-Mails per KI · 20 Credits",
    icon: Mail,
    color: "from-rose-500/15 to-pink-500/15",
    border: "border-rose-500/15",
    iconColor: "text-rose-400",
  },
  {
    href: "/seo",
    title: "SEO Analyse",
    desc: "On-Page Audit & Optimierung · 0 Credits",
    icon: BarChart,
    color: "from-blue-500/15 to-cyan-500/15",
    border: "border-blue-500/15",
    iconColor: "text-blue-400",
  },
  {
    href: "/blog",
    title: "Blog-Beiträge",
    desc: "KI-Writer für Shopify-Blogs · 10 Credits",
    icon: PenTool,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
  },
  {
    href: "/ai-tools/hybrid-upscaler",
    title: "Image Upscaler",
    desc: "Bilder 4× hochskalieren · 5 Credits",
    icon: ImageUp,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
  },
  {
    href: "/ai-tools/background-remover",
    title: "Magic Background Remover",
    desc: "Produkt freistellen + Hintergrund · 5 Credits",
    icon: Scissors,
    color: "from-amber-500/15 to-orange-500/15",
    border: "border-amber-500/15",
    iconColor: "text-amber-400",
  },
  {
    href: "/ai-tools/ai-studio",
    title: "AI Studio: Produktfotos",
    desc: "Szenen, Schatten, fertig · 15 Credits",
    icon: Camera,
    color: "from-purple-500/15 to-fuchsia-500/15",
    border: "border-purple-500/15",
    iconColor: "text-purple-400",
  },
] as const;

// ─── Mobile bottom-tab destinations ────────────────────────────────
// Five thumb-reachable shortcuts. "AI" opens a bottom sheet listing
// every AI tool — no second tap to navigate anywhere on the app.

interface BottomTab {
  key: string;
  label: string;
  href?: string;          // direct link
  action?: "ai" | "more"; // sheet trigger
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const BOTTOM_TABS: readonly BottomTab[] = [
  { key: "home", label: "Home", href: "/home", icon: Home },
  { key: "charts", label: "Charts", href: "/charts", icon: BarChart3 },
  { key: "ai", label: "AI", action: "ai", icon: Sparkles },
  { key: "library", label: "Mediathek", href: "/library", icon: FolderHeart },
  { key: "more", label: "Mehr", action: "more", icon: Menu },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const { logoUrl } = useBranding();
  const credits = useCredits();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setAiOpen(false);
    setAiSheetOpen(false);
    setMoreSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (aiRef.current && !aiRef.current.contains(e.target as Node)) {
        setAiOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (!session?.isLoggedIn) return null;

  const isAiActive = AI_TOOLS.some(
    (tool) => pathname === tool.href || pathname.startsWith(tool.href + "/"),
  );
  const isAiSupportActive = pathname === "/ai-support";
  const isImpersonating = !!session.impersonatedBy;

  async function exitImpersonation() {
    try {
      const res = await fetch("/api/admin/impersonate/exit", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(data.redirect || "/admin");
      }
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* ── Impersonation banner (visible across the app) ── */}
      {isImpersonating && (
        <div
          className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 px-3 py-1.5 text-[11px] font-semibold border-b border-amber-500/40"
          style={{
            background: "linear-gradient(90deg, rgba(245,158,11,0.95) 0%, rgba(217,119,6,0.95) 100%)",
            color: "#1a1108",
          }}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="truncate">
            Impersonating <span className="font-mono">{session.lizenzschluessel || "user"}</span>
            {session.impersonatedBy && <span className="opacity-80"> · als {session.impersonatedBy}</span>}
          </span>
          <button
            onClick={exitImpersonation}
            className="ml-2 px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 transition flex items-center gap-1"
          >
            <Undo2 className="w-3 h-3" />
            Zurück
          </button>
        </div>
      )}

      {/* ── Top bar (slim everywhere, same density on mobile + desktop) ── */}
      <nav
        className="fixed left-0 right-0 z-50 glass-header"
        style={{ top: isImpersonating ? "28px" : "0" }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
          <div className="flex items-center justify-between h-12 gap-2">
            {/* Logo */}
            <Link href="/home" className="flex items-center gap-1.5 group shrink-0">
              <div className="transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(149,191,71,0.2)] rounded-lg">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Logo" className="h-7 object-contain rounded-lg" />
                ) : (
                  <BrandLogo size="md" />
                )}
              </div>
              {!logoUrl && (
                <span className="text-sm font-bold hidden sm:block">
                  Brospify<span className="text-[#95BF47]">Hub</span>
                </span>
              )}
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                      isActive
                        ? "text-[#95BF47]"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span>{t.nav[item.labelKey]}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-[#95BF47]/8 border border-[#95BF47]/15 rounded-lg"
                        style={{ zIndex: -1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}

              <div ref={aiRef} className="relative">
                <button
                  onClick={() => setAiOpen(!aiOpen)}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-200 ${
                    isAiActive ? "" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span className="ai-gradient-text">AI Tools</span>
                  <ChevronDown
                    className={`w-2.5 h-2.5 text-zinc-400 transition-transform duration-200 ${
                      aiOpen ? "rotate-180" : ""
                    }`}
                  />
                  {isAiActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-purple-500/8 border border-purple-500/15 rounded-lg"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {aiOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-2 right-0 w-[380px] p-3 rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60"
                      style={{
                        background: "rgba(12,12,14,0.97)",
                        backdropFilter: "blur(48px) saturate(180%)",
                      }}
                    >
                      <div className="px-3 pt-1 pb-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
                          AI Suite · {AI_TOOLS.length} Tools
                        </span>
                        <Link
                          href="/credits"
                          onClick={() => setAiOpen(false)}
                          className="text-[10px] font-mono text-[#95BF47] hover:text-white transition flex items-center gap-1"
                        >
                          🪙 {credits.loading ? "···" : credits.balance.toLocaleString("de-DE")}
                          <Plus className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                      <div className="space-y-1.5">
                        {AI_TOOLS.map((tool) => {
                          const isActive =
                            pathname === tool.href ||
                            pathname.startsWith(tool.href + "/");
                          const Icon = tool.icon;
                          return (
                            <Link
                              key={tool.href}
                              href={tool.href}
                              onClick={() => setAiOpen(false)}
                              className={`group flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-200 ${
                                isActive
                                  ? "border-[#95BF47]/25 bg-[#95BF47]/8"
                                  : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.10] hover:bg-white/[0.04]"
                              }`}
                            >
                              <div
                                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.color} border ${tool.border} flex items-center justify-center shrink-0`}
                              >
                                <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[13.5px] text-white truncate">
                                  {tool.title}
                                </div>
                                <div className="text-[11px] text-zinc-500 mt-0.5 truncate">
                                  {tool.desc}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                href="/ai-support"
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                  isAiSupportActive ? "" : "hover:bg-white/[0.04]"
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-zinc-300">Support</span>
                {isAiSupportActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-white/[0.06] border border-white/[0.10] rounded-lg"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>

              {session.isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                    pathname === "/admin"
                      ? "text-[#95BF47] bg-[#95BF47]/8"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{t.nav.admin}</span>
                </Link>
              )}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreditsPill balance={credits.balance} loading={credits.loading} />

              {/* Profile/Logout shown on desktop only — mobile uses bottom tabs */}
              <Link
                href="/profile"
                className={`hidden md:flex items-center gap-1.5 px-1.5 py-1 rounded-lg transition-all duration-200 ${
                  pathname === "/profile"
                    ? "bg-[#95BF47]/8 border border-[#95BF47]/15"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {session.googleImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.googleImage}
                    alt=""
                    className="w-6 h-6 rounded-md border border-white/[0.08] object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-white/[0.08] flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white">
                      {(session.googleName || "U")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="hidden xl:block text-left max-w-[100px]">
                  <div className="text-[11px] font-semibold text-white truncate leading-tight">
                    {session.googleName || "Profil"}
                  </div>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-zinc-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ─────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-header border-t border-white/[0.08]"
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-14">
          {BOTTOM_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActiveLink = tab.href && (pathname === tab.href || pathname.startsWith(tab.href + "/"));
            const isActiveAction =
              (tab.action === "ai" && (isAiActive || aiSheetOpen)) ||
              (tab.action === "more" && moreSheetOpen);
            const isActive = !!isActiveLink || !!isActiveAction;
            const isAi = tab.action === "ai";

            const inner = (
              <div className="relative flex flex-col items-center justify-center gap-0.5">
                {isActive && !isAi && (
                  <motion.div
                    layoutId="bottom-nav-indicator"
                    className="absolute -top-3 w-8 h-0.5 rounded-full bg-[#95BF47]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 ${
                    isAi
                      ? "text-purple-400"
                      : isActive
                        ? "text-[#95BF47]"
                        : "text-zinc-400"
                  }`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={`text-[10px] leading-none tracking-tight ${
                    isAi
                      ? "ai-gradient-text font-semibold"
                      : isActive
                        ? "text-[#95BF47] font-semibold"
                        : "text-zinc-500 font-medium"
                  }`}
                >
                  {tab.label}
                </span>
              </div>
            );

            if (tab.href) {
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className="flex-1 h-full flex items-center justify-center"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.action === "ai") setAiSheetOpen(true);
                  if (tab.action === "more") setMoreSheetOpen(true);
                }}
                className="flex-1 h-full flex items-center justify-center"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── AI tools bottom sheet (mobile) ────────────────────── */}
      <AnimatePresence>
        {aiSheetOpen && (
          <BottomSheet onClose={() => setAiSheetOpen(false)} title="AI Tools">
            <div className="grid grid-cols-2 gap-2">
              {AI_TOOLS.map((tool) => {
                const isActive = pathname === tool.href || pathname.startsWith(tool.href + "/");
                const Icon = tool.icon;
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setAiSheetOpen(false)}
                    className={`group flex flex-col gap-2 p-3 rounded-xl border transition ${
                      isActive
                        ? "border-[#95BF47]/30 bg-[#95BF47]/8"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tool.color} border ${tool.border} flex items-center justify-center`}
                    >
                      <Icon className={`w-4 h-4 ${tool.iconColor}`} />
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-white leading-tight">
                        {tool.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                        {tool.desc.split("·")[1]?.trim() || tool.desc}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* ── More sheet (sorted, expandable Profile group) ─────── */}
      <AnimatePresence>
        {moreSheetOpen && (
          <BottomSheet onClose={() => setMoreSheetOpen(false)} title="Mehr">
            <div className="space-y-2">
              {/* ─── Profile & Account expandable ─── */}
              <ProfileAccountGroup
                session={session}
                pathname={pathname}
                onNavigate={() => setMoreSheetOpen(false)}
              />

              {/* ─── Tools ─── */}
              <SectionLabel>Tools</SectionLabel>
              <SheetItem href="/themes" icon={Palette} label="Themes" active={pathname === "/themes"} onClick={() => setMoreSheetOpen(false)} />

              {/* ─── Support — with Tickets sub-item ─── */}
              <SectionLabel>Support</SectionLabel>
              <SheetItem href="/ai-support" icon={Bot} label="AI Support" active={isAiSupportActive && !pathname.includes("ticket")} onClick={() => setMoreSheetOpen(false)} />
              <SheetItem href="/ai-support?view=tickets" icon={Inbox} label="Meine Tickets" active={false} onClick={() => setMoreSheetOpen(false)} sub="Vergangene Anfragen" />

              {/* ─── Admin (if applicable) ─── */}
              {session.isAdmin && (
                <>
                  <SectionLabel>Verwaltung</SectionLabel>
                  <SheetItem href="/admin" icon={Settings} label="Admin-Panel" active={pathname === "/admin"} onClick={() => setMoreSheetOpen(false)} />
                </>
              )}

              {/* ─── Logout ─── */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setMoreSheetOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] text-red-300 transition active:bg-red-500/15"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm font-semibold flex-1 text-left">Abmelden</span>
                </button>
              </div>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav (top) — extra 28px when impersonation banner is on */}
      <div style={{ height: isImpersonating ? "76px" : "48px" }} />
    </>
  );
}

// ─── Bottom sheet wrapper ───────────────────────────────────────

function BottomSheet({ children, title, onClose }: {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 360, damping: 36 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => { if (info.offset.y > 100) onClose(); }}
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-3xl border-t border-white/[0.08] overflow-hidden"
        style={{
          background: "rgba(10,10,12,0.96)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          paddingBottom: "calc(var(--safe-bottom, 0px) + 0.75rem)",
          maxHeight: "85vh",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-300">{title}</div>
          <button onClick={onClose} className="p-1.5 -m-1.5 hover:bg-white/[0.06] rounded-lg transition">
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
        <div className="px-3 pb-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
          {children}
        </div>
      </motion.div>
    </>
  );
}

function SheetItem({ href, icon: Icon, label, active, onClick, accent, external, sub }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  accent?: boolean;
  external?: boolean;
  sub?: string;
}) {
  const inner = (
    <>
      <Icon className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] sm:text-sm font-semibold truncate">{label}</div>
        {sub && <div className="text-[10px] text-zinc-500 truncate">{sub}</div>}
      </div>
      {external ? <ExternalLink className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />}
    </>
  );
  const className = `flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition ${
    active
      ? "border-[#95BF47]/25 bg-[#95BF47]/8 text-[#95BF47]"
      : accent
        ? "border-[#95BF47]/15 bg-[#95BF47]/5 text-[#95BF47]"
        : "border-white/[0.05] bg-white/[0.02] text-zinc-200"
  }`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {inner}
    </Link>
  );
}

// ─── Section label inside the Mehr sheet ────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1 px-2">
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {children}
      </span>
    </div>
  );
}

// ─── Profil & Account expandable group ──────────────────────────
// Top of the Mehr sheet. Header card always visible (avatar + name).
// Tapping the header expands a sub-list with Profil, Einstellungen,
// Rechtstexte (für Shop), Impressum / Datenschutz / AGB / Widerruf
// (links to brospify.com/policies for the platform-level pages).

function ProfileAccountGroup({ session, pathname, onNavigate }: {
  session: { googleName?: string; googleEmail?: string; googleImage?: string };
  pathname: string;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-3"
      >
        {session.googleImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.googleImage} alt="" className="w-10 h-10 rounded-lg border border-white/[0.08] object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-white/[0.08] flex items-center justify-center shrink-0">
            <UserIcon className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-[13px] sm:text-sm font-semibold truncate">{session.googleName || "Profil"}</div>
          {session.googleEmail && (
            <div className="text-[10px] text-zinc-500 truncate">{session.googleEmail}</div>
          )}
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1 space-y-1 border-t border-white/[0.04]">
              {/* Account */}
              <div className="px-1 pt-1 pb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  Account
                </span>
              </div>
              <SubItem href="/profile" icon={UserIcon} label="Mein Profil" active={pathname === "/profile"} onClick={onNavigate} />
              <SubItem href="/settings" icon={Settings} label="Einstellungen" active={pathname === "/settings"} onClick={onNavigate} />

              {/* Shop */}
              <div className="px-1 pt-2 pb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  Shop
                </span>
              </div>
              <SubItem href="/setup" icon={Store} label="Shop verbinden / Setup" active={pathname === "/setup"} onClick={onNavigate} />
              <SubItem href="/legal" icon={Scale} label="Rechtstexte für deinen Shop" active={pathname === "/legal"} onClick={onNavigate} />

              {/* Brospify Hub legal */}
              <div className="px-1 pt-2 pb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
                  Rechtliches
                </span>
              </div>
              <SubItem href="https://brospify.com/policies/legal-notice" icon={FileText} label="Impressum" external onClick={onNavigate} />
              <SubItem href="https://brospify.com/policies/privacy-policy" icon={Shield} label="Datenschutzerklärung" external onClick={onNavigate} />
              <SubItem href="https://brospify.com/policies/terms-of-service" icon={Receipt} label="AGB" external onClick={onNavigate} />
              <SubItem href="https://brospify.com/policies/refund-policy" icon={Undo2} label="Widerrufsbelehrung" external onClick={onNavigate} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubItem({ href, icon: Icon, label, active, external, onClick }: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  external?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
      <span className="text-[12.5px] font-medium flex-1 truncate">{label}</span>
      {external
        ? <ExternalLink className="w-3 h-3 text-zinc-600 shrink-0" />
        : <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />}
    </>
  );
  const className = `flex items-center gap-2 px-2.5 py-2 rounded-lg transition ${
    active
      ? "bg-[#95BF47]/10 text-[#95BF47]"
      : "text-zinc-200 hover:bg-white/[0.04] active:bg-white/[0.06]"
  }`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {inner}
    </Link>
  );
}

// ─── Global Credits Pill ────────────────────────────────────────
// Always-visible balance display. Compact on mobile (icon + number),
// full pill on tablet+. Pulses when value changes after a tool runs.

function CreditsPill({ balance, loading }: { balance: number; loading: boolean }) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(balance);

  useEffect(() => {
    if (prev.current !== balance && !loading) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
    prev.current = balance;
  }, [balance, loading]);

  const empty = balance <= 0 && !loading;
  const low = !empty && balance < 20 && !loading;
  const accent = empty ? "#ef4444" : low ? "#fbbf24" : "#95BF47";
  const tint = empty
    ? "rgba(239, 68, 68, 0.10)"
    : low
    ? "rgba(245, 158, 11, 0.10)"
    : "rgba(149, 191, 71, 0.10)";
  const ring = empty
    ? "rgba(239, 68, 68, 0.25)"
    : low
    ? "rgba(245, 158, 11, 0.25)"
    : "rgba(149, 191, 71, 0.25)";

  return (
    <Link
      href="/credits"
      title={`${balance} Credits verfügbar`}
      className="flex items-center gap-1.5 sm:gap-2 pl-2 pr-2.5 sm:pl-2.5 sm:pr-3 h-8 sm:h-9 rounded-lg sm:rounded-xl border transition-all duration-300"
      style={{
        background: tint,
        borderColor: ring,
        boxShadow: pulse ? `0 0 0 4px ${tint}` : undefined,
      }}
    >
      <span className="text-[12px] sm:text-[14px]" style={{ filter: empty ? "saturate(0.6)" : "none" }}>
        🪙
      </span>
      <motion.span
        key={balance}
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="font-mono font-semibold text-[11px] sm:text-[12.5px] tabular-nums"
        style={{ color: accent }}
      >
        {loading ? "···" : balance.toLocaleString("de-DE")}
      </motion.span>
      <Plus className="w-2.5 sm:w-3 h-2.5 sm:h-3 opacity-70" style={{ color: accent }} />
    </Link>
  );
}
