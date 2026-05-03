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
  BarChart,
  Bot,
  Mail,
  Sparkles,
  ImageUp,
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
}

const NAV_ITEMS = [
  { href: "/home", labelKey: "home" as const, icon: Home },
  { href: "/charts", labelKey: "charts" as const, icon: BarChart3 },
  { href: "/themes", labelKey: "themes" as const, icon: Palette },
];

const AI_TOOLS = [
  {
    href: "/email-templates",
    title: "AI Email Generator",
    desc: "10 Shopify-Mails per KI generieren · 30 Credits",
    icon: Mail,
    color: "from-rose-500/15 to-pink-500/15",
    border: "border-rose-500/15",
    iconColor: "text-rose-400",
  },
  {
    href: "/seo",
    title: "SEO Analyse",
    desc: "On-Page Audit & Optimierung · 10 Credits",
    icon: BarChart,
    color: "from-blue-500/15 to-cyan-500/15",
    border: "border-blue-500/15",
    iconColor: "text-blue-400",
  },
  {
    href: "/blog",
    title: "Blog-Beiträge",
    desc: "KI-Writer für Shopify-Blogs · 50 Credits",
    icon: PenTool,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
  },
  {
    href: "/ai-tools/hybrid-upscaler",
    title: "Image Upscaler",
    desc: "Lokal (GPU) oder Cloud (HQ) · Toggle",
    icon: ImageUp,
    color: "from-[#95BF47]/15 to-emerald-500/15",
    border: "border-[#95BF47]/15",
    iconColor: "text-[#95BF47]",
    isNew: true,
  },
] as const;

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
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
    setMobileOpen(false);
    setAiOpen(false);
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

  return (
    <>
      {/* Top Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/home" className="flex items-center gap-2.5 group shrink-0">
              <div className="transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(149,191,71,0.2)] rounded-xl">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-8 md:h-9 object-contain rounded-xl" />
                ) : (
                  <BrandLogo size="md" />
                )}
              </div>
              {!logoUrl && (
                <span className="text-base md:text-lg font-bold hidden sm:block">
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
                    className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-[#95BF47]"
                        : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{t.nav[item.labelKey]}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-[#95BF47]/8 border border-[#95BF47]/15 rounded-xl"
                        style={{ zIndex: -1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* AI Tools Mega Dropdown */}
              <div ref={aiRef} className="relative">
                <button
                  onClick={() => setAiOpen(!aiOpen)}
                  className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isAiActive
                      ? ""
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="hidden lg:inline ai-gradient-text">AI Tools</span>
                  <ChevronDown
                    className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
                      aiOpen ? "rotate-180" : ""
                    }`}
                  />
                  {isAiActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-purple-500/8 border border-purple-500/15 rounded-xl"
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
                        <span className="text-[10px] font-mono text-[#95BF47]">
                          🪙 {credits.loading ? "···" : credits.remaining}
                        </span>
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
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-[13.5px] text-white truncate">
                                    {tool.title}
                                  </div>
                                  {"isNew" in tool && tool.isNew && (
                                    <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                      Neu
                                    </span>
                                  )}
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

              {/* AI Support — kept separate (live chat helper) */}
              <Link
                href="/ai-support"
                className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isAiSupportActive ? "" : "hover:bg-white/[0.04]"
                }`}
              >
                <Bot className="w-4 h-4 text-zinc-400" />
                <span className="hidden lg:inline text-zinc-300">Support</span>
                {isAiSupportActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-white/[0.06] border border-white/[0.10] rounded-xl"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Link>

              {session.isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    pathname === "/admin"
                      ? "text-[#95BF47] bg-[#95BF47]/8"
                      : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">{t.nav.admin}</span>
                </Link>
              )}
            </div>

            {/* Right Side: Credits + Profile Avatar + Logout */}
            <div className="flex items-center gap-2">
              {/* Global Credits Pill — always visible */}
              <CreditsPill
                remaining={credits.remaining}
                max={credits.max}
                loading={credits.loading}
              />

              {/* Profile Avatar Button */}
              <Link
                href="/profile"
                className={`hidden md:flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 ${
                  pathname === "/profile"
                    ? "bg-[#95BF47]/8 border border-[#95BF47]/15"
                    : "hover:bg-white/[0.04] border border-transparent"
                }`}
              >
                {session.googleImage ? (
                  <img
                    src={session.googleImage}
                    alt=""
                    className="w-7 h-7 rounded-lg border border-white/[0.08] object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-white/[0.08] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {(session.googleName || "U")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="hidden xl:block text-left max-w-[120px]">
                  <div className="text-xs font-semibold text-white truncate leading-tight">
                    {session.googleName || "Profil"}
                  </div>
                  {session.googleEmail && (
                    <div className="text-[10px] text-zinc-500 truncate leading-tight">
                      {session.googleEmail}
                    </div>
                  )}
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/8 transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-14 left-0 right-0 z-40 glass-elevated border-b border-white/[0.06] md:hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            >
              <div className="p-3 space-y-1">
                {/* Mobile credits row */}
                <div className="flex items-center justify-between px-4 py-3 mb-2 rounded-xl bg-[#95BF47]/8 border border-[#95BF47]/15">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-400">
                    Verfügbare Credits
                  </span>
                  <span className="text-sm font-mono font-semibold text-[#95BF47] tabular-nums">
                    🪙 {credits.loading ? "···" : credits.remaining} / {credits.max}
                  </span>
                </div>

                {/* Profile card */}
                <Link
                  href="/profile"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-2 ${
                    pathname === "/profile"
                      ? "bg-[#95BF47]/8 border border-[#95BF47]/15"
                      : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                  }`}
                >
                  {session.googleImage ? (
                    <img src={session.googleImage} alt="" className="w-9 h-9 rounded-lg border border-white/[0.08] object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/25 to-purple-500/25 border border-white/[0.08] flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{(session.googleName || "U")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{session.googleName || "Profil"}</div>
                    {session.googleEmail && <div className="text-[10px] text-zinc-500 truncate">{session.googleEmail}</div>}
                  </div>
                </Link>

                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "text-[#95BF47] bg-[#95BF47]/8"
                          : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {t.nav[item.labelKey]}
                    </Link>
                  );
                })}

                {/* Mobile AI Tools section */}
                <div className="border-t border-white/[0.04] my-2 pt-2">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-widest px-4 mb-2 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    <span className="ai-gradient-text">AI Tools</span>
                  </div>
                  {AI_TOOLS.map((tool) => {
                    const isActive =
                      pathname === tool.href ||
                      pathname.startsWith(tool.href + "/");
                    const Icon = tool.icon;
                    return (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? "text-[#95BF47] bg-[#95BF47]/8"
                            : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${tool.iconColor}`} />
                        <span className="flex-1">{tool.title}</span>
                        {"isNew" in tool && tool.isNew && (
                          <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            Neu
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Mobile Support */}
                <div className="border-t border-white/[0.04] my-2 pt-2">
                  <Link
                    href="/ai-support"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isAiSupportActive ? "bg-white/[0.06] border border-white/[0.10]" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <Bot className="w-5 h-5 text-zinc-400" />
                    Support
                  </Link>
                </div>

                {session.isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                  >
                    <Settings className="w-5 h-5" />
                    {t.nav.admin}
                  </Link>
                )}

                <div className="border-t border-white/[0.04] my-2" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/8 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  {t.nav.logout}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Spacer for fixed nav */}
      <div className="h-14 md:h-16" />
    </>
  );
}

// ─── Global Credits Pill ────────────────────────────────────────
// Always-visible balance display in the top-right of the nav.
// Animates the value when it changes after a tool consumes credits.

function CreditsPill({
  remaining,
  max,
  loading,
}: {
  remaining: number;
  max: number;
  loading: boolean;
}) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(remaining);

  useEffect(() => {
    if (prev.current !== remaining && !loading) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      return () => clearTimeout(t);
    }
    prev.current = remaining;
  }, [remaining, loading]);

  const low = remaining <= 30 && !loading;
  const ratio = max > 0 ? Math.min(100, (remaining / max) * 100) : 0;

  return (
    <Link
      href="/profile"
      title={`${remaining} von ${max} Credits verfügbar`}
      className="hidden sm:flex items-center gap-2 pl-2.5 pr-3 h-9 rounded-xl border transition-all duration-300"
      style={{
        background: low
          ? "rgba(245, 158, 11, 0.10)"
          : "rgba(149, 191, 71, 0.10)",
        borderColor: low
          ? "rgba(245, 158, 11, 0.25)"
          : "rgba(149, 191, 71, 0.25)",
        boxShadow: pulse
          ? `0 0 0 4px ${low ? "rgba(245, 158, 11, 0.18)" : "rgba(149, 191, 71, 0.18)"}`
          : undefined,
      }}
    >
      <div className="relative flex items-center justify-center w-5 h-5">
        <span
          className="text-[14px]"
          style={{ filter: low ? "saturate(0.85)" : "none" }}
        >
          🪙
        </span>
      </div>
      <div className="flex flex-col leading-none">
        <motion.span
          key={remaining}
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="font-mono font-semibold text-[12.5px] tabular-nums"
          style={{ color: low ? "#fbbf24" : "#95BF47" }}
        >
          {loading ? "···" : remaining}
        </motion.span>
        <span
          className="text-[8.5px] uppercase tracking-[0.12em] font-medium text-white/40 mt-0.5"
        >
          Credits
        </span>
      </div>
      <div className="hidden lg:block w-12 h-1 rounded-full overflow-hidden bg-white/[0.06] ml-1">
        <div
          className="h-full transition-all duration-700 rounded-full"
          style={{
            width: `${ratio}%`,
            background: low
              ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
              : "linear-gradient(90deg, #95BF47, #86ad3f)",
          }}
        />
      </div>
    </Link>
  );
}
