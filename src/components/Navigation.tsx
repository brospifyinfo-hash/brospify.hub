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
  Crown,
  MessageCircle,
  Search,
  PenTool,
  ChevronDown,
  BarChart,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

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
  { href: "/chats", labelKey: "chats" as const, icon: MessageCircle },
  { href: "/themes", labelKey: "themes" as const, icon: Palette },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const seoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then(setSession)
      .catch(() => {});
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setSeoOpen(false);
  }, [pathname]);

  // Close SEO dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (seoRef.current && !seoRef.current.contains(e.target as Node)) {
        setSeoOpen(false);
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

  const isSeoActive = pathname === "/seo" || pathname === "/blog";

  return (
    <>
      {/* Top Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link href="/home" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-[#95BF47]/20 border border-[#95BF47]/30 flex items-center justify-center">
                <Crown className="w-4 h-4 md:w-5 md:h-5 text-[#95BF47]" />
              </div>
              <span className="text-base md:text-lg font-bold hidden sm:block">
                Brospify<span className="text-[#95BF47]">Hub</span>
              </span>
            </Link>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "text-[#95BF47]"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{t.nav[item.labelKey]}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 bg-[#95BF47]/10 border border-[#95BF47]/20 rounded-xl"
                        style={{ zIndex: -1 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* SEO Dropdown */}
              <div ref={seoRef} className="relative">
                <button
                  onClick={() => setSeoOpen(!seoOpen)}
                  className={`relative flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isSeoActive
                      ? "text-[#95BF47]"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden lg:inline">SEO</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${seoOpen ? "rotate-180" : ""}`} />
                  {isSeoActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 bg-[#95BF47]/10 border border-[#95BF47]/20 rounded-xl"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </button>

                <AnimatePresence>
                  {seoOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] p-3 rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
                      style={{ background: "rgba(20,20,20,0.95)", backdropFilter: "blur(30px)" }}
                    >
                      <Link
                        href="/seo"
                        onClick={() => setSeoOpen(false)}
                        className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 ${
                          pathname === "/seo"
                            ? "border-[#95BF47]/30 bg-[#95BF47]/10"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-[#95BF47]/20 hover:bg-[#95BF47]/5"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <BarChart className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">SEO-Score & Analyse</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Analysiere und optimiere deine Produkt-SEO</div>
                        </div>
                      </Link>

                      <Link
                        href="/blog"
                        onClick={() => setSeoOpen(false)}
                        className={`group flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 mt-2 ${
                          pathname === "/blog"
                            ? "border-[#95BF47]/30 bg-[#95BF47]/10"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-[#95BF47]/20 hover:bg-[#95BF47]/5"
                        }`}
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#95BF47]/20 to-emerald-500/20 border border-[#95BF47]/20 flex items-center justify-center shrink-0">
                          <PenTool className="w-6 h-6 text-[#95BF47]" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white">KI-Blogbeitrag Generator</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">Generiere SEO-optimierte Blog-Artikel mit KI</div>
                        </div>
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {session.isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    pathname === "/admin"
                      ? "text-[#95BF47] bg-[#95BF47]/10"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden lg:inline">{t.nav.admin}</span>
                </Link>
              )}
            </div>

            {/* Right Side: Profile Avatar + Logout */}
            <div className="flex items-center gap-2">
              {/* Profile Avatar Button */}
              <Link
                href="/profile"
                className={`hidden md:flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 ${
                  pathname === "/profile"
                    ? "bg-[#95BF47]/10 border border-[#95BF47]/20"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                {session.googleImage ? (
                  <img
                    src={session.googleImage}
                    alt=""
                    className="w-7 h-7 rounded-lg border border-white/10 object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">
                      {(session.googleName || "U")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="hidden lg:block text-left max-w-[120px]">
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
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-14 left-0 right-0 z-40 glass-strong border-b border-white/10 md:hidden max-h-[calc(100vh-3.5rem)] overflow-y-auto"
            >
              <div className="p-3 space-y-1">
                {/* Profile card at top of mobile menu */}
                <Link
                  href="/profile"
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-2 ${
                    pathname === "/profile"
                      ? "bg-[#95BF47]/10 border border-[#95BF47]/20"
                      : "bg-white/[0.03] border border-white/5 hover:bg-white/5"
                  }`}
                >
                  {session.googleImage ? (
                    <img src={session.googleImage} alt="" className="w-9 h-9 rounded-lg border border-white/10 object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">{(session.googleName || "U")[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{session.googleName || "Profil"}</div>
                    {session.googleEmail && <div className="text-[10px] text-zinc-500 truncate">{session.googleEmail}</div>}
                  </div>
                </Link>

                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "text-[#95BF47] bg-[#95BF47]/10"
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {t.nav[item.labelKey]}
                    </Link>
                  );
                })}

                {/* Mobile SEO section */}
                <div className="border-t border-white/5 my-2 pt-2">
                  <div className="text-[10px] text-zinc-600 uppercase tracking-widest px-4 mb-2 font-semibold">SEO & Content</div>
                  <Link
                    href="/seo"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      pathname === "/seo" ? "text-[#95BF47] bg-[#95BF47]/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <BarChart className="w-5 h-5" />
                    SEO-Score & Analyse
                  </Link>
                  <Link
                    href="/blog"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      pathname === "/blog" ? "text-[#95BF47] bg-[#95BF47]/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <PenTool className="w-5 h-5" />
                    KI-Blogbeitrag Generator
                  </Link>
                </div>

                {session.isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5"
                  >
                    <Settings className="w-5 h-5" />
                    {t.nav.admin}
                  </Link>
                )}

                <div className="border-t border-white/5 my-2" />

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all"
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
