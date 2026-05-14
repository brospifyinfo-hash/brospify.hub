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
  Lock,
  Crown,
  Check,
  Code2,
  GraduationCap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BrandLogo, useBranding } from "@/lib/branding";
import { useCredits } from "@/lib/credits";
import { useTier } from "@/lib/use-tier";

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
  { href: "/home", labelKey: "home" as const, icon: Home, feature: undefined },
  { href: "/charts", labelKey: "charts" as const, icon: BarChart3, feature: "chartsAnalytics" as const },
  { href: "/library", labelKey: "library" as const, icon: FolderHeart, feature: "library" as const },
  { href: "/themes", labelKey: "themes" as const, icon: Palette, feature: "themesGallery" as const },
  { href: "/code-blocks", labelKey: "codeBlocks" as const, icon: Code2, feature: "codeBlocks" as const },
  { href: "/coaching", labelKey: "coaching" as const, icon: GraduationCap, feature: "coaching" as const },
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
    feature: "emailTemplates" as const,
  },
  {
    href: "/seo",
    title: "SEO Analyse",
    desc: "On-Page Audit & Optimierung · 0 Credits",
    icon: BarChart,
    color: "from-blue-500/15 to-cyan-500/15",
    border: "border-blue-500/15",
    iconColor: "text-blue-400",
    feature: "seoAudit" as const,
  },
  {
    href: "/blog",
    title: "Blog-Beiträge",
    desc: "KI-Writer für Shopify-Blogs · 10 Credits",
    icon: PenTool,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
    feature: "blogGenerator" as const,
  },
  {
    href: "/ai-tools/hybrid-upscaler",
    title: "Image Upscaler",
    desc: "Bilder 4× hochskalieren · 5 Credits",
    icon: ImageUp,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
    feature: "upscale" as const,
  },
  {
    href: "/ai-tools/background-remover",
    title: "Magic Background Remover",
    desc: "Produkt freistellen + Hintergrund · 5 Credits",
    icon: Scissors,
    color: "from-amber-500/15 to-orange-500/15",
    border: "border-amber-500/15",
    iconColor: "text-amber-400",
    feature: "bgRemove" as const,
  },
  {
    href: "/ai-tools/ai-studio",
    title: "AI Studio: Produktfotos",
    desc: "Szenen, Schatten, fertig · 15 Credits",
    icon: Camera,
    color: "from-purple-500/15 to-fuchsia-500/15",
    border: "border-purple-500/15",
    iconColor: "text-purple-400",
    feature: "aiStudio" as const,
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
  const [accountOpen, setAccountOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const { logoUrl, brandName } = useBranding();
  const credits = useCredits();
  const tierState = useTier();

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
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAiOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

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
                  {brandName ? (
                    brandName
                  ) : (
                    <>Brospify<span className="text-[#95BF47]">Hub</span></>
                  )}
                </span>
              )}
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const locked = !!item.feature && !tierState.loading && !tierState.has(item.feature);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={locked ? `Nicht in deinem ${tierState.tier?.label || "Tier"}-Abo` : undefined}
                    className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
                      isActive
                        ? "text-[#95BF47]"
                        : locked
                        ? "text-zinc-600 hover:text-zinc-400"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {locked ? <Lock className="w-3 h-3" /> : <item.icon className="w-3.5 h-3.5" />}
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
                      transition={{ duration: 0.16 }}
                      className="absolute top-full mt-2 right-0 w-[400px] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden"
                      style={{
                        background: "rgba(12,12,14,0.97)",
                        backdropFilter: "blur(48px) saturate(180%)",
                        WebkitBackdropFilter: "blur(48px) saturate(180%)",
                      }}
                    >
                      {/* Gradient header */}
                      <div className="relative px-4 pt-3 pb-2 border-b border-white/[0.06] overflow-hidden">
                        <div
                          className="absolute inset-0 opacity-50 pointer-events-none"
                          style={{
                            background:
                              "radial-gradient(circle at 20% 50%, rgba(168,85,247,0.16), transparent 60%), radial-gradient(circle at 90% 50%, rgba(96,165,250,0.12), transparent 60%)",
                          }}
                        />
                        <div className="relative flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center">
                              <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-white">AI Suite</div>
                              <div className="text-[9px] text-zinc-500 uppercase tracking-[0.12em]">
                                {AI_TOOLS.length} Tools
                              </div>
                            </div>
                          </div>
                          <Link
                            href="/credits"
                            onClick={() => setAiOpen(false)}
                            className="flex items-center gap-1 text-[10px] font-mono text-[#95BF47] hover:text-white transition px-2 py-1 rounded-md border border-[#95BF47]/15 hover:border-[#95BF47]/30 hover:bg-[#95BF47]/[0.08]"
                          >
                            🪙 {credits.loading ? "···" : credits.balance.toLocaleString("de-DE")}
                            <Plus className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      </div>

                      <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {AI_TOOLS.map((tool) => {
                          const isActive =
                            pathname === tool.href ||
                            pathname.startsWith(tool.href + "/");
                          const Icon = tool.icon;
                          const locked = !tierState.loading && !tierState.has(tool.feature);
                          return (
                            <Link
                              key={tool.href}
                              href={tool.href}
                              onClick={() => setAiOpen(false)}
                              title={locked ? `Nicht in deinem ${tierState.tier?.label || "Tier"}-Abo` : undefined}
                              className={`nav-lift group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                                isActive
                                  ? "border-[#95BF47]/25 bg-[#95BF47]/8"
                                  : locked
                                  ? "border-white/[0.03] bg-white/[0.01] opacity-55 hover:opacity-80"
                                  : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]"
                              }`}
                            >
                              <div
                                className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${tool.color} border ${tool.border} flex items-center justify-center shrink-0 transition group-hover:scale-105`}
                              >
                                <Icon className={`w-4.5 h-4.5 ${tool.iconColor}`} />
                                {locked && (
                                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-zinc-900 border border-white/15 flex items-center justify-center">
                                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-[13px] text-white truncate flex items-center gap-1.5">
                                  {tool.title}
                                  {locked && (
                                    <span className="text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold shrink-0 border border-amber-500/20">
                                      Upgrade
                                    </span>
                                  )}
                                  {isActive && !locked && (
                                    <span className="text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#95BF47]/15 text-[#95BF47] font-bold shrink-0 border border-[#95BF47]/20">
                                      Aktiv
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-zinc-500 mt-0.5 truncate">
                                  {tool.desc}
                                </div>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0 opacity-0 group-hover:opacity-100 transition" />
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
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreditsPill balance={credits.balance} loading={credits.loading} />

              {/* Account mega-dropdown — desktop only */}
              <div ref={accountRef} className="relative hidden md:block">
                <button
                  onClick={() => setAccountOpen((v) => !v)}
                  className={`flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-lg border transition-all duration-200 ${
                    accountOpen
                      ? "bg-white/[0.06] border-white/[0.12]"
                      : "border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]"
                  }`}
                >
                  {session.googleImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={session.googleImage}
                      alt=""
                      className="w-6 h-6 rounded-md border border-white/[0.08] object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/[0.08] flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white">
                        {(session.googleName || "U")[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  {tierState.tier && !session.isAdmin && (
                    <TierBadge tier={tierState.tier.label} kind={tierState.tier.key} compact />
                  )}
                  {session.isAdmin && (
                    <span className="hidden lg:inline text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      Admin
                    </span>
                  )}
                  <ChevronDown
                    className={`w-3 h-3 text-zinc-500 transition-transform ${accountOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {accountOpen && (
                    <AccountMenu
                      session={session}
                      tierState={tierState}
                      pathname={pathname}
                      onClose={() => setAccountOpen(false)}
                      onLogout={handleLogout}
                    />
                  )}
                </AnimatePresence>
              </div>
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
                const locked = !tierState.loading && !tierState.has(tool.feature);
                return (
                  <Link
                    key={tool.href}
                    href={tool.href}
                    onClick={() => setAiSheetOpen(false)}
                    className={`group flex flex-col gap-2 p-3 rounded-xl border transition ${
                      isActive
                        ? "border-[#95BF47]/30 bg-[#95BF47]/8"
                        : locked
                        ? "border-white/[0.04] bg-white/[0.01] opacity-60"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div
                      className={`relative w-9 h-9 rounded-lg bg-gradient-to-br ${tool.color} border ${tool.border} flex items-center justify-center`}
                    >
                      <Icon className={`w-4 h-4 ${tool.iconColor}`} />
                      {locked && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-zinc-900 border border-white/15 flex items-center justify-center">
                          <Lock className="w-2 h-2 text-amber-400" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[12.5px] font-semibold text-white leading-tight">
                        {tool.title}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                        {locked ? "Upgrade nötig" : tool.desc.split("·")[1]?.trim() || tool.desc}
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
              <SubItem href="/tiers" icon={Crown} label="Abo-Modelle" active={pathname === "/tiers"} onClick={onNavigate} />

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

// ─── Tier Badge ─────────────────────────────────────────────────
// Small chip rendered next to the avatar on desktop. Color-coded so
// the user instantly sees which plan they're on.

const TIER_CHIP_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  starter:  { bg: "bg-cyan-500/15",   text: "text-cyan-300",   border: "border-cyan-500/25" },
  pro:      { bg: "bg-purple-500/15", text: "text-purple-300", border: "border-purple-500/30" },
  business: { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30" },
};

const NEUTRAL_CHIP_STYLE = { bg: "bg-zinc-500/15", text: "text-zinc-300", border: "border-zinc-500/25" };

function TierBadge({ tier, kind, compact }: { tier: string; kind: string; compact?: boolean }) {
  const style = TIER_CHIP_STYLES[kind] || NEUTRAL_CHIP_STYLE;
  return (
    <span
      className={`hidden lg:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded border ${style.bg} ${style.text} ${style.border} ${compact ? "px-1.5 py-0.5" : "px-2 py-1"}`}
    >
      {kind === "business" && <Crown className="w-2.5 h-2.5" />}
      {tier}
    </span>
  );
}

// ─── Account mega-dropdown ──────────────────────────────────────
// Replaces the simple avatar+logout in the desktop header. Mirrors the
// content that mobile users see in the "Mehr" bottom-sheet so desktop
// no longer hides Profil / Settings / Setup / Rechtstexte / external
// policies. Click-outside + Escape close it.

interface AccountMenuProps {
  session: SessionInfo;
  tierState: ReturnType<typeof useTier>;
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
}

function AccountMenu({ session, tierState, pathname, onClose, onLogout }: AccountMenuProps) {
  const tier = tierState.tier;
  const tierKey = tier?.key || "";
  const chipStyle = TIER_CHIP_STYLES[tierKey] || NEUTRAL_CHIP_STYLE;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.16 }}
      className="absolute top-full mt-2 right-0 w-[320px] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden"
      style={{
        background: "rgba(12,12,14,0.97)",
        backdropFilter: "blur(48px) saturate(180%)",
        WebkitBackdropFilter: "blur(48px) saturate(180%)",
      }}
    >
      {/* Header — avatar + name + tier chip */}
      <div className="relative p-4 border-b border-white/[0.06] overflow-hidden">
        {/* Subtle gradient accent based on tier color */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              tierKey === "business"
                ? "radial-gradient(circle at top right, rgba(251,191,36,0.14), transparent 65%)"
                : tierKey === "pro"
                ? "radial-gradient(circle at top right, rgba(168,85,247,0.14), transparent 65%)"
                : tierKey === "starter"
                ? "radial-gradient(circle at top right, rgba(6,182,212,0.12), transparent 65%)"
                : "radial-gradient(circle at top right, rgba(149,191,71,0.10), transparent 65%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          {session.googleImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={session.googleImage}
              alt=""
              className="w-12 h-12 rounded-xl border border-white/[0.10] object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/[0.10] flex items-center justify-center shrink-0">
              <span className="text-base font-bold text-white">
                {(session.googleName || "U")[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">{session.googleName || "Profil"}</div>
            {session.googleEmail && (
              <div className="text-[10px] text-zinc-500 truncate">{session.googleEmail}</div>
            )}
            <div className="mt-1.5 flex items-center gap-1.5">
              {session.isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              ) : tier ? (
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${chipStyle.bg} ${chipStyle.text} ${chipStyle.border}`}
                >
                  {tierKey === "business" && <Crown className="w-2.5 h-2.5" />}
                  {tier.label}
                </span>
              ) : null}
              {tier && tier.priceMonthlyEur > 0 && !session.isAdmin && (
                <span className="text-[9px] text-zinc-500 tabular-nums">
                  {tier.priceMonthlyEur} €/Mo
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu groups */}
      <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <MenuGroup label="Account">
          <MenuItem
            href="/profile"
            icon={UserIcon}
            label="Mein Profil"
            active={pathname === "/profile"}
            onClick={onClose}
          />
          <MenuItem
            href="/settings"
            icon={Settings}
            label="Einstellungen"
            active={pathname === "/settings"}
            onClick={onClose}
          />
          <MenuItem
            href="/credits"
            icon={Plus}
            label="Credits"
            active={pathname === "/credits"}
            onClick={onClose}
            sub="Aufladen & Verlauf"
          />
          <MenuItem
            href="/tiers"
            icon={Crown}
            label="Abo-Modelle"
            active={pathname === "/tiers"}
            onClick={onClose}
            sub={tier ? `Aktuell: ${tier.label}` : "Plan wählen"}
          />
        </MenuGroup>

        <MenuGroup label="Shop">
          <MenuItem
            href="/setup"
            icon={Store}
            label="Shop verbinden"
            active={pathname === "/setup"}
            onClick={onClose}
          />
          <MenuItem
            href="/legal"
            icon={Scale}
            label="Rechtstexte für deinen Shop"
            active={pathname === "/legal"}
            onClick={onClose}
          />
        </MenuGroup>

        <MenuGroup label="Support">
          <MenuItem
            href="/ai-support"
            icon={Bot}
            label="AI Support"
            active={pathname === "/ai-support" && !pathname.includes("ticket")}
            onClick={onClose}
          />
          <MenuItem
            href="/ai-support?view=tickets"
            icon={Inbox}
            label="Meine Tickets"
            active={false}
            onClick={onClose}
          />
        </MenuGroup>

        <MenuGroup label="Rechtliches">
          <MenuItem
            href="https://brospify.com/policies/legal-notice"
            icon={FileText}
            label="Impressum"
            external
            onClick={onClose}
          />
          <MenuItem
            href="https://brospify.com/policies/privacy-policy"
            icon={Shield}
            label="Datenschutz"
            external
            onClick={onClose}
          />
          <MenuItem
            href="https://brospify.com/policies/terms-of-service"
            icon={Receipt}
            label="AGB"
            external
            onClick={onClose}
          />
          <MenuItem
            href="https://brospify.com/policies/refund-policy"
            icon={Undo2}
            label="Widerrufsbelehrung"
            external
            onClick={onClose}
          />
        </MenuGroup>

        {session.isAdmin && (
          <MenuGroup label="Verwaltung">
            <MenuItem
              href="/admin"
              icon={Settings}
              label="Admin-Panel"
              active={pathname === "/admin"}
              onClick={onClose}
              accent
            />
          </MenuGroup>
        )}
      </div>

      {/* Logout footer */}
      <div className="p-2 border-t border-white/[0.06]">
        <button
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-red-500/15 bg-red-500/[0.05] text-red-300 hover:bg-red-500/[0.10] hover:border-red-500/25 transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[12.5px] font-semibold flex-1 text-left">Abmelden</span>
        </button>
      </div>
    </motion.div>
  );
}

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-2 pt-1.5 pb-1">
        <span className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-zinc-600">{label}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  active,
  external,
  onClick,
  accent,
  sub,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  external?: boolean;
  onClick?: () => void;
  accent?: boolean;
  sub?: string;
}) {
  const className = `group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 border ${
    active
      ? "bg-[#95BF47]/10 border-[#95BF47]/20 text-[#95BF47]"
      : accent
      ? "bg-amber-500/[0.06] border-amber-500/15 text-amber-200 hover:bg-amber-500/10"
      : "border-transparent text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.06]"
  }`;
  const inner = (
    <>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-[#95BF47]" : "text-zinc-500 group-hover:text-zinc-300"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-medium truncate leading-tight">{label}</div>
        {sub && <div className="text-[10px] text-zinc-600 truncate">{sub}</div>}
      </div>
      {external ? (
        <ExternalLink className="w-3 h-3 text-zinc-600 shrink-0" />
      ) : (
        <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0 opacity-0 group-hover:opacity-100 transition" />
      )}
    </>
  );
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
