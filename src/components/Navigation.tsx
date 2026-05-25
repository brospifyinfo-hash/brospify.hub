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
  Settings as SettingsIcon,
  Zap,
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
  Coins,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BrandLogo } from "@/lib/branding";
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

// Top-Bar: NUR Daily-Browsing Seiten. Tools/Support/Shop-Einstellungen
// sind eigene Dropdowns. Themes ist jetzt unter Shop-Einstellungen-
// Dropdown, deshalb hier raus.
const NAV_ITEMS = [
  { href: "/home", labelKey: "home" as const, icon: Home, feature: undefined },
  { href: "/charts", labelKey: "charts" as const, icon: BarChart3, feature: "chartsAnalytics" as const },
  { href: "/library", labelKey: "library" as const, icon: FolderHeart, feature: "library" as const },
];

// ─── Shop-Einstellungen Dropdown ─────────────────────────────────
// Tools die DIREKT ans Shopify-Theme gehen: Themes-Galerie zum Pushen,
// Code-Blocks fuer Liquid-Snippets. NICHT die Connection-Verwaltung —
// die liegt im Profil-Dropdown unter "Shopify-Verbindung".
interface ShopSettingsItem {
  href: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  feature?: "themesGallery" | "codeBlocks";
}

const SHOP_SETTINGS_ITEMS: ShopSettingsItem[] = [
  {
    href: "/themes",
    label: "Themes",
    sub: "Theme-Galerie + Push",
    icon: Palette,
    color: "text-fuchsia-400",
    feature: "themesGallery",
  },
  {
    href: "/code-blocks",
    label: "Liquid-Blöcke",
    sub: "Code-Snippets für dein Theme",
    icon: Code2,
    color: "text-emerald-400",
    feature: "codeBlocks",
  },
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
  // Code-Blöcke ist jetzt unter Shop-Einstellungen-Dropdown (passt
  // logisch besser — Liquid ist Shopify-spezifisch, nicht generisches
  // AI-Tool).
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
  const [supportOpen, setSupportOpen] = useState(false);
  const [shopSettingsOpen, setShopSettingsOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLDivElement>(null);
  const shopSettingsRef = useRef<HTMLDivElement>(null);
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
      if (supportRef.current && !supportRef.current.contains(e.target as Node)) {
        setSupportOpen(false);
      }
      if (shopSettingsRef.current && !shopSettingsRef.current.contains(e.target as Node)) {
        setShopSettingsOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAiOpen(false);
        setAccountOpen(false);
        setSupportOpen(false);
        setShopSettingsOpen(false);
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
    setSupportOpen(false);
    setShopSettingsOpen(false);
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
            <Link href="/home" className="flex items-center group shrink-0">
              <div className="transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(149,191,71,0.2)] rounded-lg">
                <BrandLogo size="md" />
              </div>
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

              {/* Shop-Einstellungen Dropdown: Themes + Liquid-Blöcke.
                  Nur Shopify-spezifische Theme/Code-Tools. */}
              <ShopSettingsDropdown
                shopSettingsRef={shopSettingsRef}
                shopSettingsOpen={shopSettingsOpen}
                setShopSettingsOpen={setShopSettingsOpen}
                pathname={pathname}
                tierState={tierState}
              />

              {/* Support-Dropdown: AI Support, Tickets, E-Mail Support,
                  Privates Coaching. */}
              <SupportDropdown
                supportRef={supportRef}
                supportOpen={supportOpen}
                setSupportOpen={setSupportOpen}
                pathname={pathname}
              />
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
              {/* Kompakter Avatar-Header — kein Expand mehr noetig,
                  weil alle Profil/Account-Items unten in den
                  Sektionen direkt klickbar sind. */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                {session.googleImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={session.googleImage} alt="" className="w-10 h-10 rounded-lg border border-white/[0.08] object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-white/[0.08] flex items-center justify-center shrink-0">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{session.googleName || "Profil"}</div>
                  {session.googleEmail && (
                    <div className="text-[10px] text-zinc-500 truncate">{session.googleEmail}</div>
                  )}
                </div>
                {session.isAdmin && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                    Admin
                  </span>
                )}
              </div>

              {/* Mobile More-Sheet: gleiche Hierarchie wie Desktop.
                  5 Sektionen: Mein Profil, Konto-Extras, Shop-Einstellungen,
                  Support, (Admin). Rechtliches ist nur noch im Footer. */}

              {/* ─── Mein Profil ─── */}
              <SectionLabel>Mein Profil</SectionLabel>
              <SheetItem href="/profile" icon={UserIcon} label="Mein Profil" active={pathname === "/profile"} onClick={() => setMoreSheetOpen(false)} sub="Persönliche Daten + Tickets" />
              <SheetItem href="/account/settings" icon={Settings} label="Einstellungen" active={pathname === "/account/settings"} onClick={() => setMoreSheetOpen(false)} sub="Login, Google-Verknüpfung" />
              <SheetItem href="/account/subscription" icon={Coins} label="Abo verwalten" active={pathname === "/account/subscription"} onClick={() => setMoreSheetOpen(false)} sub="Status, Credits, Verlängerung" />
              <SheetItem href="/account/shopify" icon={Store} label="Shopify-Verbindung" active={pathname === "/account/shopify"} onClick={() => setMoreSheetOpen(false)} sub="API-Credentials" />
              <SheetItem href="/setup" icon={Zap} label="Setup einrichten" active={pathname === "/setup"} onClick={() => setMoreSheetOpen(false)} sub="Verbindungs-Wizard" />

              {/* ─── Konto-Extras ─── */}
              <SectionLabel>Konto-Extras</SectionLabel>
              <SheetItem href="/credits" icon={Plus} label="Credits aufladen" active={pathname === "/credits"} onClick={() => setMoreSheetOpen(false)} sub="Extra Credits kaufen" />
              <SheetItem href="/tiers" icon={Crown} label="Abo upgraden" active={pathname === "/tiers"} onClick={() => setMoreSheetOpen(false)} sub="Mehr Credits pro Monat" />
              <SheetItem href="/legal" icon={Scale} label="Rechtstexte generieren" active={pathname === "/legal"} onClick={() => setMoreSheetOpen(false)} sub="Impressum + AGB für deinen Shop" />

              {/* ─── Shop-Einstellungen ─── */}
              <SectionLabel>Shop-Einstellungen</SectionLabel>
              <SheetItem href="/themes" icon={Palette} label="Themes" active={pathname === "/themes"} onClick={() => setMoreSheetOpen(false)} sub="Theme-Galerie + Push" />
              <SheetItem href="/code-blocks" icon={Code2} label="Liquid-Blöcke" active={pathname === "/code-blocks"} onClick={() => setMoreSheetOpen(false)} sub="Code-Snippets für dein Theme" />

              {/* ─── Support (4 Wege) ─── */}
              <SectionLabel>Support</SectionLabel>
              <SheetItem href="/ai-support" icon={Bot} label="AI Support" active={isAiSupportActive && !pathname.includes("ticket")} onClick={() => setMoreSheetOpen(false)} sub="Sofort-Antwort vom KI-Bot" />
              <SheetItem href="/ai-support?view=tickets" icon={Inbox} label="Meine Tickets" active={false} onClick={() => setMoreSheetOpen(false)} sub="Vergangene Anfragen" />
              <SheetItem href="/email-support" icon={Mail} label="E-Mail Support" active={pathname === "/email-support"} onClick={() => setMoreSheetOpen(false)} sub="Direkt an unser Team" />
              <SheetItem href="/coaching" icon={GraduationCap} label="Privates Coaching" active={pathname === "/coaching"} onClick={() => setMoreSheetOpen(false)} sub="1:1 mit Team (Gold-only)" />

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

// ─── Shop-Einstellungen Dropdown (Desktop Top-Bar) ──────────────
// Themes-Galerie + Liquid-Blöcke. Beide tier-gated.

function ShopSettingsDropdown({
  shopSettingsRef, shopSettingsOpen, setShopSettingsOpen, pathname, tierState,
}: {
  shopSettingsRef: React.RefObject<HTMLDivElement | null>;
  shopSettingsOpen: boolean;
  setShopSettingsOpen: (v: boolean) => void;
  pathname: string;
  tierState: ReturnType<typeof useTier>;
}) {
  const isAnyActive = SHOP_SETTINGS_ITEMS.some((it) => pathname === it.href || pathname.startsWith(it.href + "/"));
  return (
    <div ref={shopSettingsRef} className="relative">
      <button
        onClick={() => setShopSettingsOpen(!shopSettingsOpen)}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
          isAnyActive ? "" : "hover:bg-white/[0.04]"
        }`}
      >
        <Store className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-zinc-300">Shop-Einstellungen</span>
        <ChevronDown className={`w-2.5 h-2.5 text-zinc-400 transition-transform duration-200 ${shopSettingsOpen ? "rotate-180" : ""}`} />
        {isAnyActive && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute inset-0 bg-white/[0.06] border border-white/[0.10] rounded-lg"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
      </button>

      <AnimatePresence>
        {shopSettingsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full mt-2 right-0 w-[300px] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden"
            style={{
              background: "rgba(12,12,14,0.97)",
              backdropFilter: "blur(48px) saturate(180%)",
              WebkitBackdropFilter: "blur(48px) saturate(180%)",
            }}
          >
            <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold text-white">Shop-Einstellungen</div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-[0.12em]">Theme & Liquid</div>
            </div>
            <div className="p-2 space-y-1">
              {SHOP_SETTINGS_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                const locked = !!item.feature && !tierState.loading && !tierState.has(item.feature);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShopSettingsOpen(false)}
                    title={locked ? `Nicht in deinem ${tierState.tier?.label || "Tier"}-Abo` : undefined}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border transition ${
                      isActive
                        ? "border-[#95BF47]/25 bg-[#95BF47]/8"
                        : locked
                        ? "border-white/[0.03] bg-white/[0.01] opacity-60"
                        : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      {locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Icon className={`w-4 h-4 ${item.color}`} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13px] text-white truncate flex items-center gap-1.5">
                        {item.label}
                        {locked && (
                          <span className="text-[8.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold shrink-0 border border-amber-500/20">
                            Upgrade
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-zinc-500 mt-0.5 truncate">{item.sub}</div>
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
  );
}

// ProfileAccountGroup + SubItem entfernt — durch direkte SheetItems
// im Mobile-More-Sheet ersetzt, die identisch zur Desktop-Avatar-
// Menue-Struktur sind. Keine Doppelung mehr.

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

      {/* Profil-Dropdown: exakt die 4 vom User gewuenschten Items.
          Keine Rechtliches-Group hier — die ist im globalen Footer. */}
      <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        <MenuGroup label="Mein Profil">
          <MenuItem
            href="/profile"
            icon={UserIcon}
            label="Mein Profil"
            active={pathname === "/profile"}
            onClick={onClose}
            sub="Persönliche Daten + Tickets"
          />
          <MenuItem
            href="/account/settings"
            icon={SettingsIcon}
            label="Einstellungen"
            active={pathname === "/account/settings"}
            onClick={onClose}
            sub="Login, Google-Verknüpfung"
          />
          <MenuItem
            href="/account/subscription"
            icon={Coins}
            label="Abo verwalten"
            active={pathname === "/account/subscription"}
            onClick={onClose}
            sub={tier ? `${tier.label} · Status & Credits` : "Status & Credits"}
          />
          <MenuItem
            href="/account/shopify"
            icon={Store}
            label="Shopify-Verbindung"
            active={pathname === "/account/shopify"}
            onClick={onClose}
            sub="API-Credentials"
          />
          <MenuItem
            href="/setup"
            icon={Zap}
            label="Setup einrichten"
            active={pathname === "/setup"}
            onClick={onClose}
            sub="Verbindungs-Wizard"
          />
        </MenuGroup>

        {/* Extras direkt unter Profil — schnell erreichbar, fuehren
            zu eigenstaendigen Seiten. */}
        <MenuGroup label="Konto-Extras">
          <MenuItem
            href="/credits"
            icon={Plus}
            label="Credits aufladen"
            active={pathname === "/credits"}
            onClick={onClose}
            sub="Extra Credits kaufen"
          />
          {tierKey !== "business" && (
            <MenuItem
              href="/tiers"
              icon={Crown}
              label="Abo upgraden"
              active={pathname === "/tiers"}
              onClick={onClose}
              sub={tier ? `Mehr als ${tier.label}` : "Plan wählen"}
              accent
            />
          )}
          <MenuItem
            href="/legal"
            icon={Scale}
            label="Rechtstexte generieren"
            active={pathname === "/legal"}
            onClick={onClose}
            sub="Für deinen Shop"
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

// ─── Support-Dropdown (Desktop Top-Bar) ─────────────────────────
// Drei Support-Wege als direkter Dropdown statt einzelnen Links/
// Subroutes. Visuell wie AI Tools (Icon links, Titel + Subtext rechts).

interface SupportItem {
  href: string;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const SUPPORT_ITEMS: SupportItem[] = [
  { href: "/ai-support", label: "AI Support", sub: "Sofort-Antworten vom KI-Bot", icon: Bot, color: "text-cyan-400" },
  { href: "/ai-support?view=tickets", label: "Meine Tickets", sub: "Vergangene Anfragen & Verlauf", icon: Inbox, color: "text-amber-400" },
  { href: "/email-support", label: "E-Mail Support", sub: "Direkt an unser Team schreiben", icon: Mail, color: "text-rose-400" },
  { href: "/coaching", label: "Privates Coaching", sub: "1:1 mit unserem Team (Gold)", icon: GraduationCap, color: "text-purple-400" },
];

function SupportDropdown({
  supportRef, supportOpen, setSupportOpen, pathname,
}: {
  supportRef: React.RefObject<HTMLDivElement | null>;
  supportOpen: boolean;
  setSupportOpen: (v: boolean) => void;
  pathname: string;
}) {
  const isAnyActive = SUPPORT_ITEMS.some((it) => pathname === it.href.split("?")[0]);
  return (
    <div ref={supportRef} className="relative">
      <button
        onClick={() => setSupportOpen(!supportOpen)}
        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-200 ${
          isAnyActive ? "" : "hover:bg-white/[0.04]"
        }`}
      >
        <Bot className="w-3.5 h-3.5 text-zinc-400" />
        <span className="text-zinc-300">Support</span>
        <ChevronDown
          className={`w-2.5 h-2.5 text-zinc-400 transition-transform duration-200 ${supportOpen ? "rotate-180" : ""}`}
        />
        {isAnyActive && (
          <motion.div
            layoutId="nav-indicator"
            className="absolute inset-0 bg-white/[0.06] border border-white/[0.10] rounded-lg"
            style={{ zIndex: -1 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
      </button>

      <AnimatePresence>
        {supportOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className="absolute top-full mt-2 right-0 w-[300px] rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden"
            style={{
              background: "rgba(12,12,14,0.97)",
              backdropFilter: "blur(48px) saturate(180%)",
              WebkitBackdropFilter: "blur(48px) saturate(180%)",
            }}
          >
            <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
              <div className="text-[11px] font-bold text-white">Brospify Support</div>
              <div className="text-[9px] text-zinc-500 uppercase tracking-[0.12em]">3 Wege</div>
            </div>
            <div className="p-2 space-y-1">
              {SUPPORT_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href.split("?")[0];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSupportOpen(false)}
                    className={`group flex items-center gap-3 p-2.5 rounded-xl border transition ${
                      isActive
                        ? "border-[#95BF47]/25 bg-[#95BF47]/8"
                        : "border-white/[0.04] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <Icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13px] text-white truncate">{item.label}</div>
                      <div className="text-[10.5px] text-zinc-500 mt-0.5 truncate">{item.sub}</div>
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
