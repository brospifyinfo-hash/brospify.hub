"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Settings,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Bot,
  Mail,
  Sparkles,
  ImageUp,
  Scissors,
  Camera,
  Plus,
  FolderHeart,
  User as UserIcon,
  FileText,
  Shield,
  Receipt,
  Undo2,
  ExternalLink,
  Inbox,
  Eye,
  Lock,
  Crown,
  Check,
  GraduationCap,
  Coins,
  Gauge,
  Gift,
  Search,
} from "lucide-react";
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

// Desktop-Top-Bar ist bewusst minimal: nur Logo + Credits + das rechte
// Avatar-Menü. ALLES (Home, AI Tools, Mediathek, Support, Konto) liegt
// im rechten Menü (AccountMenu). Die mobile Bottom-Bar bleibt unberührt.

// Hinweis: Das frühere "Shop-Einstellungen"-Dropdown (Themes, Liquid-
// Blöcke, Rechtstexte) wurde entfernt. Liquid-Blöcke + Rechtstexte
// gibt es nicht mehr; "Themes" liegt jetzt im Avatar-Menü (AccountMenu).

const AI_TOOLS = [
  {
    href: "/email-templates",
    title: "AI Email Generator",
    desc: "Shopify-Mails per KI · Code zum Einfügen · 20 Credits",
    icon: Mail,
    color: "from-rose-500/15 to-pink-500/15",
    border: "border-rose-500/15",
    iconColor: "text-rose-400",
    feature: "emailTemplates" as const,
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
  { key: "charts", label: "Drop", href: "/charts", icon: Gift },
  { key: "ai", label: "AI", action: "ai", icon: Sparkles },
  { key: "library", label: "Mediathek", href: "/library", icon: FolderHeart },
  { key: "more", label: "Mehr", action: "more", icon: Menu },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
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
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-8">
          <div className="relative flex items-center justify-between h-12 md:h-14 gap-2">
            {/* Logo */}
            <Link href="/home" className="flex items-center group shrink-0">
              <div className="transition-all duration-300 group-hover:shadow-[0_0_16px_rgba(149,191,71,0.2)] rounded-lg">
                <BrandLogo size="md" />
              </div>
            </Link>


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
              {/* ═══ PROFIL — Section mit Pfeil, DEFAULT OFFEN ═══
                  Header zeigt Profilbild + Email/Lizenz. Pfeil kann
                  zum Einklappen genutzt werden, aber ist beim Oeffnen
                  des Sheets immer aufgeklappt. */}
              <MobileSection
                title="Profil"
                defaultOpen={true}
                headerSlot={
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {session.googleImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={session.googleImage} alt="" className="w-11 h-11 rounded-xl border border-white/[0.10] object-cover shrink-0 shadow-md" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/[0.10] flex items-center justify-center shrink-0 shadow-md">
                        <span className="text-sm font-bold text-white">
                          {(session.googleName || session.googleEmail || session.lizenzschluessel || "U")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[13px] font-bold text-white truncate">
                        {session.googleEmail || session.googleName || "Konto"}
                      </div>
                      {session.lizenzschluessel && (
                        <div className="text-[10px] text-zinc-500 truncate font-mono">
                          {session.lizenzschluessel}
                        </div>
                      )}
                    </div>
                    {session.isAdmin && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                }
              >
                <SheetItem href="/account/settings" icon={Settings} label="Einstellungen" active={pathname === "/account/settings"} onClick={() => setMoreSheetOpen(false)} sub="Login & Google-Verknüpfung" />
                <SheetItem href="/account/subscription" icon={Coins} label="Abo verwalten" active={pathname === "/account/subscription"} onClick={() => setMoreSheetOpen(false)} sub="Status, Credits, Verlängerung" />
              </MobileSection>

              {/* ═══ SUPPORT — Section mit Pfeil, DEFAULT ZU ═══ */}
              <MobileSection title="Support" icon={Bot} defaultOpen={false}>
                <SheetItem href="/ai-support" icon={Bot} label="AI Support" active={isAiSupportActive && !pathname.includes("ticket")} onClick={() => setMoreSheetOpen(false)} sub="Sofort-Antwort vom KI-Bot" />
                <SheetItem href="/ai-support?view=tickets" icon={Inbox} label="Meine Tickets" active={false} onClick={() => setMoreSheetOpen(false)} sub="Vergangene Anfragen" />
                <SheetItem href="/email-support" icon={Mail} label="E-Mail Support" active={pathname === "/email-support"} onClick={() => setMoreSheetOpen(false)} sub="Direkt an unser Team" />
                <SheetItem href="/coaching" icon={GraduationCap} label="Privates Coaching" active={pathname === "/coaching"} onClick={() => setMoreSheetOpen(false)} sub="1:1 mit Team" />
              </MobileSection>

              {/* Admin */}
              {session.isAdmin && (
                <MobileSection title="Verwaltung" icon={Shield} defaultOpen={false}>
                  <SheetItem href="/admin" icon={Settings} label="Admin-Panel" active={pathname === "/admin"} onClick={() => setMoreSheetOpen(false)} sub="Voller Zugriff" />
                  <SheetItem href="/admin/loadtest" icon={Gauge} label="Load-Tester" active={pathname === "/admin/loadtest"} onClick={() => setMoreSheetOpen(false)} sub="Shopify Dev-Store Standhaftigkeit" />
                </MobileSection>
              )}

              {/* ═══ RECHTLICHES + VERSION — direkt im Menue unten ═══ */}
              <MobileLegalFooter onNavigate={() => setMoreSheetOpen(false)} />

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

      {/* Spacer for fixed nav (top) — Bar ist mobil 48px, Desktop 56px;
          +28px wenn das Impersonation-Banner sichtbar ist. */}
      <div className={isImpersonating ? "h-[76px] md:h-[84px]" : "h-12 md:h-14"} />
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

// ─── Collapsible Mobile Section (mit Pfeil + Animation) ─────────
// Im Mehr-Sheet auf Mobile: Header mit Title + ChevronDown der je
// nach State rotiert. Children werden ein/ausgeblendet via height
// animation. defaultOpen steuert den initial-State (Profil = true,
// Shop-Einstellungen + Support = false).

function MobileSection({
  title, icon: Icon, defaultOpen, headerSlot, children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen: boolean;
  headerSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left active:bg-white/[0.04] transition"
      >
        {headerSlot ?? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-zinc-300" />
              </div>
            )}
            <span className="text-[13px] font-bold text-white">{title}</span>
          </div>
        )}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="shrink-0 ml-2"
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
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 pt-1 space-y-1 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mobile Legal Footer im Mehr-Sheet (NICHT global!) ──────────
// Direkt im Sheet unten: Impressum/Datenschutz/AGB/Widerruf + Version.
// Version wird live aus /api/version geholt und zeigt commit-SHA, so
// dass User sofort sieht ob ein Deploy durch ist.

function MobileLegalFooter({ onNavigate }: { onNavigate: () => void }) {
  const [version, setVersion] = useState<{ version: string; buildTime: string } | null>(null);

  useEffect(() => {
    fetch("/api/version", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.version) setVersion({ version: data.version, buildTime: data.buildTime || "" });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="pt-2 mt-2 border-t border-white/[0.06] space-y-2">
      {/* Rechtstexte als kompakte Link-Liste */}
      <div className="px-2 pb-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          Rechtliches
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 px-1">
        <LegalLink href="https://brospify.com/policies/legal-notice" label="Impressum" onClick={onNavigate} />
        <LegalLink href="https://brospify.com/policies/privacy-policy" label="Datenschutz" onClick={onNavigate} />
        <LegalLink href="https://brospify.com/policies/terms-of-service" label="AGB" onClick={onNavigate} />
        <LegalLink href="https://brospify.com/policies/refund-policy" label="Widerruf" onClick={onNavigate} />
      </div>

      {/* Version-Indicator — updated automatisch bei jedem Deploy */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1 text-[10px] text-zinc-600">
        <span className="font-semibold text-zinc-500">Brospify Hub</span>
        <span className="font-mono">
          {version ? (
            <>
              {version.version}
              {version.buildTime && (
                <span className="text-zinc-700"> · {version.buildTime}</span>
              )}
            </>
          ) : (
            "…"
          )}
        </span>
      </div>
    </div>
  );
}

function LegalLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] active:bg-white/[0.06] transition"
    >
      <span className="text-[11px] font-medium text-zinc-300 truncate">{label}</span>
      <ExternalLink className="w-2.5 h-2.5 text-zinc-600 shrink-0" />
    </a>
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
  pro: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-500/30" },
};

const NEUTRAL_CHIP_STYLE = { bg: "bg-zinc-500/15", text: "text-zinc-300", border: "border-zinc-500/25" };

function TierBadge({ tier, kind, compact }: { tier: string; kind: string; compact?: boolean }) {
  const style = TIER_CHIP_STYLES[kind] || NEUTRAL_CHIP_STYLE;
  return (
    <span
      className={`hidden lg:inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider rounded border ${style.bg} ${style.text} ${style.border} ${compact ? "px-1.5 py-0.5" : "px-2 py-1"}`}
    >
      <Crown className="w-2.5 h-2.5" />
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
      {/* Header — grosses Profilbild + Email/Lizenz prominent.
          Email steht oben (wenn da), sonst Lizenzschluessel als
          monospace darunter. Tier-Chip rechts oben. */}
      <div className="relative p-4 border-b border-white/[0.06] overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background: tierKey === "pro"
              ? "radial-gradient(circle at top right, rgba(251,191,36,0.16), transparent 65%)"
              : "radial-gradient(circle at top right, rgba(149,191,71,0.12), transparent 65%)",
          }}
        />
        <div className="relative flex items-start gap-3">
          {/* Profilbild – grossformatig damit es klar erkennbar ist */}
          {session.googleImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={session.googleImage}
              alt=""
              className="w-14 h-14 rounded-xl border border-white/[0.12] object-cover shrink-0 shadow-lg"
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/[0.12] flex items-center justify-center shrink-0 shadow-lg">
              <span className="text-lg font-bold text-white">
                {(session.googleName || session.googleEmail || session.lizenzschluessel || "U")[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            {/* Primary: Email wenn vorhanden, sonst Name */}
            <div className="text-[13px] font-bold text-white truncate">
              {session.googleEmail || session.googleName || "Konto"}
            </div>
            {/* Secondary: Lizenzschluessel monospace, klein, voll sichtbar */}
            {session.lizenzschluessel && (
              <div className="text-[10.5px] text-zinc-500 truncate font-mono mt-0.5">
                {session.lizenzschluessel}
              </div>
            )}
            {/* Tier oder Admin Badge */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {session.isAdmin ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              ) : tier ? (
                <span
                  className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${chipStyle.bg} ${chipStyle.text} ${chipStyle.border}`}
                >
                  <Crown className="w-2.5 h-2.5" />
                  {tier.label}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                  Kein Abo
                </span>
              )}
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
      {/* Profil-Dropdown: EXAKT die 4 vom User gewuenschten Items.
          Credits/Abo upgraden sind in der "/account/subscription" Seite
          als prominente Action-Buttons erreichbar. Rechtstexte ist in
          Shop-Einstellungen Dropdown. */}
      <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {/* Home — Standardseite */}
        <div className="space-y-0.5">
          <MenuItem
            href="/home"
            icon={Home}
            label="Home"
            active={pathname === "/home"}
            onClick={onClose}
            sub="Startseite"
          />
        </div>

        {/* AI Tools — komplettes Dropdown im rechten Menü */}
        <MenuGroup label="AI Tools">
          <MenuItem
            href="/charts"
            icon={Search}
            label="Produkt Search"
            active={pathname === "/charts" || pathname.startsWith("/charts/")}
            onClick={onClose}
            sub="Zufalls-Generator · 50 Credits"
          />
          {AI_TOOLS.map((tool) => (
            <MenuItem
              key={tool.href}
              href={tool.href}
              icon={tool.icon}
              label={tool.title}
              active={pathname === tool.href || pathname.startsWith(tool.href + "/")}
              onClick={onClose}
              sub={tool.desc}
            />
          ))}
        </MenuGroup>

        {/* Konto */}
        <MenuGroup label="Konto">
          <MenuItem
            href="/account/settings"
            icon={SettingsIcon}
            label="Einstellungen"
            active={pathname === "/account/settings"}
            onClick={onClose}
            sub="Login & Google-Verknüpfung"
          />
          <MenuItem
            href="/account/subscription"
            icon={Coins}
            label="Abo verwalten"
            active={pathname === "/account/subscription"}
            onClick={onClose}
            sub={tier ? `${tier.label} · Status & Credits` : "Status & Credits"}
          />
        </MenuGroup>

        {/* Mediathek — auf dem Desktop hier statt in der Top-Bar. */}
        <MenuGroup label="Mediathek">
          <MenuItem
            href="/library"
            icon={FolderHeart}
            label="Mediathek"
            active={pathname === "/library"}
            onClick={onClose}
            sub="Deine gespeicherten Assets"
          />
        </MenuGroup>

        {/* Support — auf dem Desktop hier statt eigenem Top-Bar-Dropdown. */}
        <MenuGroup label="Support">
          {SUPPORT_ITEMS.map((it) => (
            <MenuItem
              key={it.href}
              href={it.href}
              icon={it.icon}
              label={it.label}
              active={pathname === it.href.split("?")[0]}
              onClick={onClose}
              sub={it.sub}
            />
          ))}
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
            <MenuItem
              href="/admin/loadtest"
              icon={Gauge}
              label="Load-Tester"
              active={pathname === "/admin/loadtest"}
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

// ─── Support-Items ──────────────────────────────────────────────
// Die vier Support-Wege. Werden auf dem Desktop im Avatar-Menü
// (AccountMenu) und mobil im "Mehr"-Sheet gerendert.

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
  { href: "/coaching", label: "Privates Coaching", sub: "1:1 mit unserem Team", icon: GraduationCap, color: "text-purple-400" },
];


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
