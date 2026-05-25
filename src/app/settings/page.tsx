"use client";

// ─── /settings ───────────────────────────────────────────────────
// Full-featured mobile-first settings hub. Each section is a
// collapsible accordion that saves on its own — no giant "Save all"
// button. Mobile-first paddings, the action bar always sticks within
// the section so the user knows what they're committing.
//
// Sections:
//   • Google Account     — link/unlink the Google login email
//   • Shopify-Verbindung — show + edit credentials, jump to /setup
//   • Brand-Kit          — logo, primary color, accent color, voice
//   • Firmendaten        — legal data feeding /legal generator
//   • Plan & Credits     — read-only summary + topup link

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings as SettingsIcon,
  Store,
  Scale,
  Sparkles,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  Save,
  Key,
  Globe,
  Coins,
  ChevronRight,
  Plus,
  X,
  Mail,
  Link2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  ShieldOff,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { useCredits } from "@/lib/credits";
import { tierFromSku, TIER_DISPLAY_LABEL, DEFAULT_TIERS, type TierKey } from "@/lib/tiers-shared";

interface Profile {
  shopify_credentials?: { clientId?: string; clientSecret?: string };
  linkedGoogleEmail?: string;
  tier?: TierKey;
  tierSince?: string;
  tierCanceledAt?: string;
  subscriptionEndsAt?: string;
  lastSubscriptionRefillAt?: string;
  subscriptionContractId?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const credits = useCredits();
  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [kundenEmail, setKundenEmail] = useState("");
  const [hasShopifyToken, setHasShopifyToken] = useState(false);
  const [googleProfile, setGoogleProfile] = useState<{ name?: string; email?: string; image?: string } | null>(null);
  const [linkedGoogleEmail, setLinkedGoogleEmail] = useState("");

  const [credentials, setCredentials] = useState({ clientId: "", clientSecret: "" });

  // Subscription state — drives the Plan & Credits box. Kuendigung
  // laeuft jetzt ausserhalb des Hubs direkt im Shopify Customer-Portal
  // (Link, nicht Modal/API) — deshalb keine cancel-Loading/Message-State
  // mehr.
  const [planSku, setPlanSku] = useState<string>("");
  const [planStatus, setPlanStatus] = useState<string>("");
  const [tierSince, setTierSince] = useState<string>("");
  const [tierCanceledAt, setTierCanceledAt] = useState<string>("");
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string>("");
  const [lastRefillAt, setLastRefillAt] = useState<string>("");
  const [hasContractId, setHasContractId] = useState(false);

  const [openSection, setOpenSection] = useState<string>("account");
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [error, setError] = useState("");

  // ── URL-Hash → Section ───────────────────────────────────────────
  // /settings#shopify oeffnet die Shopify-Section und scrollt dahin.
  // Hash-Werte muessen den 3 verbleibenden Section-IDs entsprechen:
  // account, shopify, plan. (brand + legal wurden entfernt.)
  useEffect(() => {
    const SECTION_IDS = new Set(["account", "shopify", "plan"]);
    const applyHash = () => {
      const h = (window.location.hash || "").replace("#", "").trim();
      if (h && SECTION_IDS.has(h)) {
        setOpenSection(h);
        // Kleiner Delay damit der framer-motion Akkordion vorher den
        // expand startet — sonst scrollt Browser zu collapsed Section
        // und der User sieht nur den Header.
        setTimeout(() => {
          const el = document.getElementById(`section-${h}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    };
    applyHash(); // Beim Mount
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (data.googleName || data.googleEmail || data.googleImage) {
          setGoogleProfile({ name: data.googleName, email: data.googleEmail, image: data.googleImage });
        }
      })
      .catch(() => {});

    fetch("/api/profile")
      .then((r) => { if (r.status === 401) { router.push("/"); return null; } return r.json(); })
      .then((data) => {
        if (!data) return;
        const p: Profile = data.profile || {};
        setShopDomain(data.shopDomain || "");
        setKundenEmail(data.kundenEmail || "");
        setHasShopifyToken(data.hasShopifyToken || false);
        setLinkedGoogleEmail(p.linkedGoogleEmail || "");
        setCredentials({
          clientId: p.shopify_credentials?.clientId || "",
          clientSecret: p.shopify_credentials?.clientSecret || "",
        });
        // Subscription-Felder. SKU (B/S/G) ist Source of Truth via tierFromSku,
        // profile.tier ist nur Konvenienz. status (column C) zeigt aktiv/gekuendigt/abgelaufen.
        setPlanSku(data.sku || "");
        setPlanStatus(data.status || "");
        setTierSince(p.tierSince || "");
        setTierCanceledAt(p.tierCanceledAt || "");
        setSubscriptionEndsAt(p.subscriptionEndsAt || "");
        setLastRefillAt(p.lastSubscriptionRefillAt || "");
        setHasContractId(!!(p.subscriptionContractId && p.subscriptionContractId.trim()));
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);


  // ── Section save helper ──
  const saveSection = useCallback(async (
    sectionKey: string,
    payload: Partial<Profile>,
  ) => {
    setSaving(sectionKey);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Speichern fehlgeschlagen.");
        return;
      }
      setSavedFlash(sectionKey);
      setTimeout(() => setSavedFlash((f) => (f === sectionKey ? null : f)), 1800);
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setSaving(null);
    }
  }, []);

  async function handleLinkGoogle(email: string) {
    if (!email.includes("@")) return;
    setSaving("account");
    try {
      const res = await fetch("/api/profile/link-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleEmail: email }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkedGoogleEmail(data.linkedEmail);
        setSavedFlash("account");
        setTimeout(() => setSavedFlash(null), 1800);
      } else {
        setError(data.error || "Google-Verknüpfung fehlgeschlagen.");
      }
    } catch {
      setError("Netzwerkfehler beim Verknüpfen.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 left-6 w-56 h-56 bg-indigo-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-indigo-400" />
            Einstellungen
          </h1>
          <p className="text-zinc-400 text-[12px] mt-1">
            Account, Shop-Verbindung, Branding und Firmendaten.
          </p>
        </motion.div>

        {/* Toasts */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")} className="p-1 hover:bg-red-500/10 rounded">
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Account / Google ─────────────────────── */}
        <SettingsSection
          id="account"
          title="Account"
          desc="Login & Google-Verknüpfung"
          icon={Mail}
          color="#6366F1"
          open={openSection === "account"}
          onToggle={() => setOpenSection(openSection === "account" ? "" : "account")}
          saving={saving === "account"}
          saved={savedFlash === "account"}
        >
          <div className="space-y-3">
            {/* Email-display */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              {googleProfile?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={googleProfile.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/25 to-purple-500/25 flex items-center justify-center text-sm font-bold">
                  {(googleProfile?.name || kundenEmail || "U")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{googleProfile?.name || "Kunde"}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {googleProfile?.email || kundenEmail || "Keine E-Mail hinterlegt"}
                </div>
              </div>
            </div>

            {/* Google linking */}
            <GoogleLinkBlock
              linkedEmail={linkedGoogleEmail || googleProfile?.email || ""}
              onLink={handleLinkGoogle}
            />

            {/* Read-only license + email */}
            <div className="space-y-2">
              <ReadOnlyField label="Account-E-Mail" value={kundenEmail || "—"} icon={Mail} />
              <ReadOnlyField label="Shop-Domain" value={shopDomain || "Nicht verbunden"} icon={Globe} />
            </div>
          </div>
        </SettingsSection>

        {/* ─── Shopify Connection ────────────────────── */}
        <SettingsSection
          id="shopify"
          title="Shopify-Verbindung"
          desc={hasShopifyToken ? "Verbunden" : "Nicht verbunden"}
          status={hasShopifyToken ? "ok" : "warn"}
          icon={Store}
          color="#95BF47"
          open={openSection === "shopify"}
          onToggle={() => setOpenSection(openSection === "shopify" ? "" : "shopify")}
          saving={saving === "shopify"}
          saved={savedFlash === "shopify"}
        >
          <div className="space-y-3">
            {!hasShopifyToken && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-300 mb-2">
                  Du hast deinen Shop noch nicht verbunden. Ohne Verbindung sind Charts-Import, Themes-Push & Email-Deploy deaktiviert.
                </p>
                <button
                  onClick={() => router.push("/setup")}
                  className="text-xs font-bold text-amber-200 underline"
                >
                  → Jetzt verbinden
                </button>
              </div>
            )}
            <FormField
              label="Client-ID"
              value={credentials.clientId}
              onChange={(v) => setCredentials((p) => ({ ...p, clientId: v }))}
              icon={Key}
              placeholder="z.B. a1b2c3d4…"
              mono
            />
            <FormField
              label="Client Secret"
              value={credentials.clientSecret}
              onChange={(v) => setCredentials((p) => ({ ...p, clientSecret: v }))}
              icon={Key}
              placeholder="shpss_…"
              type="password"
              mono
            />
            <FormField
              label="Shop-Domain"
              value={shopDomain}
              onChange={() => {}}
              icon={Globe}
              disabled
              hint="Wird beim Setup automatisch gesetzt."
            />
            <SaveButton
              onClick={() => saveSection("shopify", { shopify_credentials: credentials })}
              saving={saving === "shopify"}
              saved={savedFlash === "shopify"}
            />
            {hasShopifyToken && (
              <button
                onClick={() => router.push("/setup")}
                className="w-full text-[11px] text-zinc-400 hover:text-white transition flex items-center justify-center gap-1.5 py-2"
              >
                Shop neu verbinden / wechseln <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </SettingsSection>

        {/* Brand-Kit + Firmendaten wurden entfernt. Brand-Kit Daten
            werden trotzdem noch von AI-Tools genutzt wenn sie im
            Profile-JSON vorhanden sind (siehe Profile-Type) — sie
            koennen jetzt nur nicht mehr ueber die Settings-UI gepflegt
            werden. Falls wir das doch nochmal wollen: Section-Code im
            Git-History ist erreichbar. Rechtstexte-Generator unter
            /legal nutzt eigene Formularfelder, ist also nicht auf die
            entfernte "Firmendaten"-Section angewiesen. */}

        {/* ─── Abo & Credits ─────────── */}
        <PlanSection
          credits={credits}
          planSku={planSku}
          planStatus={planStatus}
          tierSince={tierSince}
          tierCanceledAt={tierCanceledAt}
          subscriptionEndsAt={subscriptionEndsAt}
          lastRefillAt={lastRefillAt}
          hasContractId={hasContractId}
          hasShopifyToken={hasShopifyToken}
          openSection={openSection}
          onToggle={() => setOpenSection(openSection === "plan" ? "" : "plan")}
        />
      </div>
    </div>
  );
}

// ─── Plan & Credits Section ──────────────────────────────────────
// Komplexer als die anderen Sections weil sie 3 Zustande visualisiert:
//   - aktiv (Plan + naechster Refill + Cancel-Button)
//   - gekuendigt-laufzeit (Plan + "Zugriff bis X" + reaktivieren-Hinweis)
//   - kein Plan (Tier-Auswahl-Link zum Shop)
// Bekommt alle Felder als Props weil Settings-Page seinen State direkt managed.

interface PlanSectionProps {
  credits: { balance: number; totalPurchased: number; totalUsed: number; loading?: boolean };
  planSku: string;
  planStatus: string;
  tierSince: string;
  tierCanceledAt: string;
  subscriptionEndsAt: string;
  lastRefillAt: string;
  hasContractId: boolean;
  hasShopifyToken: boolean;
  openSection: string;
  onToggle: () => void;
}

function PlanSection({
  credits, planSku, planStatus, tierSince, tierCanceledAt, subscriptionEndsAt,
  lastRefillAt, hasContractId, hasShopifyToken, openSection, onToggle,
}: PlanSectionProps) {
  // hasContractId aktuell unused — entfernen wenn nicht in 1-2 Wochen
  // wieder gebraucht. Behalten weil API-Endpoint /api/subscription/cancel
  // existiert und das Feld lesen koennte (future).
  void hasContractId;
  const tierKey = tierFromSku(planSku);
  const tier = tierKey ? DEFAULT_TIERS.find((t) => t.key === tierKey) : null;
  const tierLabel = tierKey ? TIER_DISPLAY_LABEL[tierKey] : "Kein Abo";
  const monthlyAllowance = tier?.monthlyCreditAllowance || 0;
  const isCanceled = !!tierCanceledAt;
  const isExpired = subscriptionEndsAt && new Date(subscriptionEndsAt) < new Date();
  const statusLabel = isExpired ? "Abgelaufen" : isCanceled ? "Gekuendigt" : tierKey ? "Aktiv" : "Kein Abo";
  const statusColor = isExpired ? "#EF4444" : isCanceled ? "#F59E0B" : tierKey ? "#10B981" : "#71717A";

  return (
    <SettingsSection
      id="plan"
      title="Abo & Credits"
      desc={`${tierLabel} · ${credits.balance.toLocaleString("de-DE")} Credits verfuegbar`}
      icon={Coins}
      color="#F59E0B"
      open={openSection === "plan"}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* KPI-Reihe */}
        <div className="grid grid-cols-3 gap-2">
          <KPICard label="Plan" value={tierLabel} color="#95BF47" />
          <KPICard label="Status" value={statusLabel} color={statusColor} />
          <KPICard label="Credits" value={credits.balance.toLocaleString("de-DE")} color="#F59E0B" />
        </div>

        {/* Tier-Details */}
        {tier && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">Monatliche Credits</span>
              <span className="font-mono font-semibold text-[#95BF47]">
                {monthlyAllowance.toLocaleString("de-DE")} / Monat
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-zinc-400">Preis</span>
              <span className="font-mono text-zinc-300">{tier.priceMonthlyEur} EUR / Monat</span>
            </div>
            {tierSince && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Abo seit
                </span>
                <span className="text-zinc-300">{formatGermanDate(tierSince)}</span>
              </div>
            )}
            {lastRefillAt && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <RefreshCcw className="w-3 h-3" /> Letzte Aufladung
                </span>
                <span className="text-zinc-300">{formatGermanRelative(lastRefillAt)}</span>
              </div>
            )}
          </div>
        )}

        {/* Status-Box: Aktiv / Gekuendigt / Abgelaufen */}
        {tierKey && isCanceled && !isExpired && subscriptionEndsAt && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-300">
              <ShieldOff className="w-3.5 h-3.5" /> Abo gekuendigt
            </div>
            <p className="text-[11px] text-amber-200/80 leading-snug">
              Du hast vollen Zugriff bis <b>{formatGermanDate(subscriptionEndsAt)}</b>.
              Danach werden keine neuen Credits mehr gutgeschrieben. Deine
              verbleibenden {credits.balance.toLocaleString("de-DE")} Credits
              kannst du weiterhin nutzen.
            </p>
          </div>
        )}

        {tierKey && isExpired && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-red-300">
              <XCircle className="w-3.5 h-3.5" /> Abo abgelaufen
            </div>
            <p className="text-[11px] text-red-200/80 leading-snug">
              Dein Abo ist seit {formatGermanDate(subscriptionEndsAt)} ausgelaufen.
              Verlaengere es im Brospify-Shop um wieder Zugriff auf alle Tools zu bekommen.
            </p>
          </div>
        )}

        {tierKey && !isCanceled && !isExpired && subscriptionEndsAt && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-green-300">
              <CheckCircle2 className="w-3.5 h-3.5" /> Abo aktiv
            </div>
            <p className="text-[11px] text-green-200/80 leading-snug">
              Naechste Verlaengerung &amp; Aufladung am <b>{formatGermanDate(subscriptionEndsAt)}</b> ({formatGermanRelative(subscriptionEndsAt)}).
              Du erhaeltst dann automatisch <b>{monthlyAllowance.toLocaleString("de-DE")} neue Credits</b>.
            </p>
          </div>
        )}

        {/* Action-Reihe */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/credits"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-white/[0.06] hover:bg-white/[0.10] transition"
          >
            <Plus className="w-4 h-4" />
            Mehr Credits
          </Link>
          {tierKey && !isCanceled && (
            // Direkter Link zum Shopify Customer-Portal damit der Kunde sein Abo
            // selbst bei Shopify kuendigt — keine Risiken durch API-Fehler, kein
            // Modal noetig, Kunde sieht Stornoschein direkt im offiziellen
            // Shopify-Account. URL kann via NEXT_PUBLIC_SHOPIFY_CUSTOMER_PORTAL_URL
            // ueberschrieben werden falls die Shop-Adresse mal wechselt.
            <a
              href={process.env.NEXT_PUBLIC_SHOPIFY_CUSTOMER_PORTAL_URL || "https://brospify.com/account"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition"
            >
              <ShieldOff className="w-4 h-4" />
              Abo bei Shopify kuendigen
              <ExternalLinkIcon className="w-3 h-3" />
            </a>
          )}
          {(!tierKey || isExpired) && (
            <Link
              href="/tiers"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold btn-accent"
            >
              <Sparkles className="w-4 h-4" />
              Abo abschliessen
            </Link>
          )}
        </div>

        {/* Shop-Status */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/[0.04]">
          <span>Shopify-Shop</span>
          <span className={hasShopifyToken ? "text-green-400" : "text-zinc-500"}>
            {hasShopifyToken ? "Verbunden" : "Nicht verbunden"}
          </span>
        </div>
      </div>
    </SettingsSection>
  );
}

// ─── Datum-Helfer ────────────────────────────────────────────────
function formatGermanDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatGermanRelative(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diffMs = t - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  if (Math.abs(diffDays) < 1) return "heute";
  if (diffDays === 1) return "morgen";
  if (diffDays === -1) return "gestern";
  if (diffDays > 0) return `in ${diffDays} Tagen`;
  return `vor ${Math.abs(diffDays)} Tagen`;
}

// ─── Settings section (collapsible card) ─────────────────────────

function SettingsSection({
  id, title, desc, icon: Icon, color, open, onToggle, saving, saved, status, children,
}: {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  open: boolean;
  onToggle: () => void;
  saving?: boolean;
  saved?: boolean;
  status?: "ok" | "warn" | "error";
  children: React.ReactNode;
}) {
  return (
    <motion.div
      key={id}
      id={`section-${id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden scroll-mt-20"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
          style={{ backgroundColor: `${color}15`, borderColor: `${color}30` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold truncate">{title}</span>
            {status === "ok" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            {status === "warn" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {saving && <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />}
            {saved && (
              <motion.span
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
              >
                <Check className="w-2 h-2" /> Gespeichert
              </motion.span>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 truncate">{desc}</div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
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
            <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Form field ──────────────────────────────────────────────────

function FormField({
  label, value, onChange, placeholder, type = "text", mono, icon: Icon, disabled, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1.5 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-[13px] outline-none transition placeholder:text-zinc-600 ${
          mono ? "font-mono" : ""
        } ${disabled ? "opacity-60 cursor-not-allowed" : "focus:border-white/25"}`}
      />
      {hint && <p className="text-[10px] text-zinc-600 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Read-only field ─────────────────────────────────────────────

function ReadOnlyField({ label, value, icon: Icon }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
      <Icon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold leading-tight">
          {label}
        </div>
        <div className="text-[12px] text-zinc-200 truncate font-mono">
          {value}
        </div>
      </div>
    </div>
  );
}

// ─── Save button (in-section) ────────────────────────────────────

function SaveButton({ onClick, saving, saved }: {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={saving}
      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition ${
        saved
          ? "bg-emerald-500/15 border border-emerald-500/35 text-emerald-300"
          : "bg-[#95BF47] text-black"
      } disabled:opacity-50`}
    >
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saving ? "Speichere…" : saved ? "Gespeichert" : "Diesen Bereich speichern"}
    </motion.button>
  );
}

// ─── KPI card (mini) ─────────────────────────────────────────────

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-lg border p-2 text-center"
      style={{ borderColor: `${color}25`, background: `${color}08` }}
    >
      <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">{label}</div>
      <div className="text-[12px] font-bold mt-0.5 truncate" style={{ color }}>{value}</div>
    </div>
  );
}

// ─── Google link block ──────────────────────────────────────────

function GoogleLinkBlock({ linkedEmail, onLink }: {
  linkedEmail: string;
  onLink: (email: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");

  if (linkedEmail && !editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-[12px]">
        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-widest text-emerald-500/70 font-semibold leading-tight">
            Google verknüpft
          </div>
          <div className="text-emerald-200 truncate">{linkedEmail}</div>
        </div>
        <button
          onClick={() => { setInput(linkedEmail); setEditing(true); }}
          className="text-[10px] text-emerald-400 hover:text-emerald-300 transition shrink-0"
        >
          Ändern
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      <div className="flex items-center gap-1.5">
        <Link2 className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[11px] font-semibold">
          {linkedEmail ? "Andere Google-E-Mail verknüpfen" : "Google-Account verknüpfen"}
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="meine@gmail.com"
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] outline-none focus:border-white/25 transition"
        />
        <button
          onClick={() => { onLink(input); setEditing(false); }}
          disabled={!input.includes("@")}
          className="px-3 py-1.5 rounded-lg bg-[#95BF47] text-black text-[11px] font-semibold disabled:opacity-40 transition"
        >
          Verknüpfen
        </button>
        {editing && (
          <button
            onClick={() => setEditing(false)}
            className="px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-400 text-[11px] transition"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <p className="text-[10px] text-zinc-500 leading-snug">
        Du loggst dich künftig mit dieser Google-Adresse ein. Praktisch wenn deine Account-E-Mail kein Google-Konto ist.
      </p>
    </div>
  );
}
