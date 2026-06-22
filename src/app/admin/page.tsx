"use client";

import { useState, useEffect, useCallback, useRef, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, Upload, Loader2, X, LogOut, Shield, Save,
  Check, AlertCircle, ImagePlus, BarChart3, DollarSign, Zap, Settings,
  Video, Palette, Image as ImageIcon, Gem, Ticket, Coins, Power,
  Users, Search, ChevronRight, ChevronLeft, Store, Mail, FileText,
  TrendingDown, TrendingUp, ArrowDownCircle, ArrowUpCircle, Sparkles,
  Clock, Crown, UserCog, ScrollText, Eye, ArrowRightLeft, Repeat, Euro,
  Code2, GraduationCap, Lightbulb, MessageCircle, Wand2, ChevronDown,
  Link2, Percent, Star,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import { AdminErrorBoundary } from "@/components/AdminErrorBoundary";
import { CodeBlockPreview } from "@/components/CodeBlockPreview";
import { safeFetch } from "@/lib/safe-fetch";
import { refreshBranding } from "@/lib/branding";
import {
  type TierDefinition,
  type FeatureFlag,
  type LimitKey,
  FEATURE_FLAGS,
  FEATURE_LABELS,
  LIMIT_KEYS,
  LIMIT_LABELS,
} from "@/lib/tiers-shared";
import {
  type CreditConfig,
  defaultCreditConfig,
  mergeCreditConfig,
  TOOL_PRICING_META,
  pricePerCreditEur,
  toolProfit,
  formatEuro,
} from "@/lib/credit-config";
import {
  type SurveyAggregate,
  type SurveyResponseRecord,
  type SurveyQuestion,
} from "@/lib/survey";

// ─── Types ───────────────────────────────────────────────────────

interface ProduktAds {
  tiktok?: string[];
  instagram?: string[];
  facebook?: string[];
  youtube?: string[];
}

interface ProduktLinks {
  aliExpressProduct?: string;
  aliExpressCategory?: string;
  /** Legacy: einzelner Shop. */
  dropshippingExample?: { url: string; title?: string };
  /** Neu: mehrere Shops. */
  dropshippingExamples?: { url: string; title?: string }[];
}

interface ProduktLinkStatus {
  aliExpressProductOk?: boolean;
  aliExpressCategoryOk?: boolean;
  dropshippingExampleOk?: boolean;
  lastCheckedAt?: string;
}

interface ProduktDeepStats {
  competition?: number;
  seasonality?: number;
  peakMonths?: number[];
  growth90d?: number;
  repeatPurchaseRate?: number;
}

interface ProduktAudience {
  primary?: string;
  ageRange?: string;
  genderSkew?: "male" | "female" | "balanced";
  interests?: string[];
  painPoint?: string;
}

interface ProduktAdStrategy {
  dailyMinEur?: number;
  dailyRecommendedEur?: number;
  estimatedCpmEur?: number;
  bestFormat?: string;
  adHooks?: string[];
  testDurationDays?: number;
}

interface ProduktVotes {
  ups?: number;
  downs?: number;
  manualBoost?: number;
}

interface ProduktExtra {
  stats?: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances?: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  images?: string[];
  links?: ProduktLinks;
  ads?: ProduktAds;
  linkStatus?: ProduktLinkStatus;
  deepStats?: ProduktDeepStats;
  audience?: ProduktAudience;
  adStrategy?: ProduktAdStrategy;
  votes?: ProduktVotes;
}

interface Produkt {
  rowIndex: number;
  id: string;
  sku: string;
  monat: string;
  titel: string;
  bildUrl: string;
  beschreibung: string;
  preis: string;
  aliExpressLink: string;
  extra: ProduktExtra;
}

interface EditProduct {
  rowIndex?: number;
  id: string;
  sku: string;
  monat: string;
  titel: string;
  beschreibung: string;
  aliExpressLink: string;
  images: string[];
  stats: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  // Passthrough-Felder — werden weder direkt im Edit-Modal editiert
  // noch von der UI angefasst, aber durch den Save-Roundtrip
  // erhalten (sonst würde ein Bearbeiten alle KI-Discovery-Daten
  // killen).
  links?: ProduktLinks;
  ads?: ProduktAds;
  linkStatus?: ProduktLinkStatus;
  deepStats?: ProduktDeepStats;
  audience?: ProduktAudience;
  adStrategy?: ProduktAdStrategy;
  votes?: ProduktVotes;
}

const EMPTY: EditProduct = {
  id: "", sku: "", monat: "", titel: "", beschreibung: "", aliExpressLink: "",
  images: [],
  stats: { trendScore: 0, viralScore: 0, impulseBuyFactor: 0, problemSolverIndex: 0, marketSaturation: 0 },
  finances: { buyPrice: 0, recommendedSellPrice: 0, profitMargin: 0 },
};

// Fixe Liste an Kategorien — identisch zu PREDEFINED_CATEGORIES auf
// der Charts-Seite (siehe src/app/charts/page.tsx). Wenn du eine
// hinzufuegst hier UND dort updaten.
const KATEGORIE_OPTIONS = [
  "Sport & Fitness",
  "Beauty & Pflege",
  "Haushalt & Ordnung",
  "Küche & Kochen",
  "Gadgets & Tech",
  "Haustier",
  "Kinder & Baby",
  "Auto & Outdoor",
  "Garten & Pflanzen",
  "Mode & Accessoires",
  "Wellness & Schlaf",
  "Heim-Deko & Licht",
];

// ─── Admin module-level types ───────────────────────────────────

type AdminTierKey = "pro";
type AdminUserRole = "admin" | "user";

interface TierPricing { key: AdminTierKey; label: string; priceEur: number }
type AdminTier = TierDefinition;

interface AdminStats {
  generatedAt: string;
  customers: { total: number; activeLast7d: number; activeLast30d: number; withShopify: number; withGoogle: number; starterGranted: number; admins: number };
  credits: { sumBalance: number; sumTotalPurchased: number; sumTotalUsed: number; avgBalance: number; avgUsed: number };
  creditsConsumed: {
    today: number;
    last7d: number;
    last30d: number;
    prev7d: number;
    trend7dPct: number;
    costEurToday: number;
    costEurLast7d: number;
    costEurLast30d: number;
  };
  subscriptions: {
    activeTotal: number;
    byTier: Record<AdminTierKey, number>;
    mrrEur: number;
    pricing: TierPricing[];
    newPaid30d: number;
    churn30d: number;
    churnRatePct: number;
  };
  signups: { last7d: number; last30d: number; daily30d: { date: string; count: number }[] };
  topSkus: { sku: string; count: number; activeSubs: number }[];
  heatmap: number[][];
  daily14d: { date: string; deduct: number; topup: number; admin: number }[];
  toolUsage: { reason: string; count: number; totalCredits: number }[];
  topUsers: { lizenzschluessel: string; email: string; shopDomain: string; balance: number; used30d: number; txCount30d: number }[];
  recentTx: { ts: string; type: string; delta: number; balanceAfter: number; reason: string; ref?: string; customer: string; email: string }[];
  money: {
    monthLabel: string;
    costThisMonthEur: number;
    costAllTimeEur: number;
    revenueThisMonthEur: number;
    revenueAllTimeEur: number;
    profitThisMonthEur: number;
    profitMarginPct: number;
    toolBreakdown: { reason: string; label: string; provider: string; calls: number; costEur: number; creditsCharged: number }[];
  };
}

interface AdminUserRow {
  rowIndex: number;
  lizenzschluessel: string;
  status: string;
  shopDomain: string;
  email: string;
  sku: string;
  role: AdminUserRole;
  tier: AdminTierKey | "";
  tierSince: string;
  tierCanceledAt: string;
  signupAt: string;
  hasShopify: boolean;
  hasGoogle: boolean;
  blocked: boolean;
  vip: boolean;
  credits: { balance: number; totalPurchased: number; totalUsed: number };
  lastTransaction?: { ts: string; type: string; delta: number; balanceAfter: number; reason: string; ref?: string };
}

interface AdminLogEntry {
  id: string;
  ts: string;
  level: "info" | "warn" | "error" | "audit";
  actor: string;
  action: string;
  target: string;
  details: Record<string, unknown>;
}

interface ActivityEntry {
  ts: string;
  type: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  ref?: string;
  customerKey: string;
  email: string;
  shopDomain: string;
}

interface ApiBalance {
  provider: "apify" | "deepseek" | "fal" | "replicate" | "anthropic" | "tavily" | "resend";
  label: string;
  configured: boolean;
  status: "ok" | "low" | "empty" | "unknown" | "not-configured";
  balanceUsd?: number;
  balanceEur?: number;
  raw?: string;
  error?: string;
  endpoint?: string;
  billingUrl?: string;
  hasBalanceApi?: boolean;
  ledgerKind?: "usd" | "count";
  ledgerUsd?: number;
  ledgerCount?: { monthUsed: number; monthLimit: number; dayUsed: number; dayLimit: number };
}

// ─── Code-Blöcke + Coaching admin types ─────────────────────────

interface AdminCodeBlockOption {
  id: string;
  label: string;
  type: "text" | "color";
  original: string;
}

interface AdminCodeBlock {
  rowIndex: number;
  id: string;
  title: string;
  description: string;
  code: string;
  previewImageUrl: string;
  options: AdminCodeBlockOption[];
  active: boolean;
  createdAt: string;
}

interface AdminCoachingTip {
  rowIndex: number;
  id: string;
  title: string;
  body: string;
  mediaUrl: string;
  author: string;
  active: boolean;
  createdAt: string;
}

// ─── Drop Zone ───────────────────────────────────────────────────

function ImageDropZone({ images, onAdd, onRemove }: {
  images: string[];
  onAdd: (newUrls: string[]) => void;
  onRemove: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!fileArr.length) return;
    setUploading(true);
    setUploadError("");
    const successUrls: string[] = [];
    let failCount = 0;
    for (const file of fileArr) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data.url && typeof data.url === "string" && data.url.startsWith("http")) {
            successUrls.push(data.url);
            console.log("[ImageDropZone] Upload OK:", data.url);
          } else {
            console.error("[ImageDropZone] Upload returned invalid URL:", data);
            failCount++;
          }
        } else {
          const errText = await res.text();
          console.error("[ImageDropZone] Upload failed:", res.status, errText);
          failCount++;
        }
      } catch (err) {
        console.error("[ImageDropZone] Upload exception:", err);
        failCount++;
      }
    }
    if (successUrls.length > 0) {
      // Use onAdd to let parent merge with latest state via functional updater
      onAdd(successUrls);
    }
    if (failCount > 0) {
      setUploadError(`${failCount} Bild(er) konnten nicht hochgeladen werden.`);
      setTimeout(() => setUploadError(""), 5000);
    }
    setUploading(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: DragEvent) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-zinc-400 font-medium">Bilder ({images.length})</label>

      {uploadError && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {uploadError}
        </div>
      )}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((url, i) => (
            <div key={`${i}-${url.slice(-20)}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 bg-white/5">
              <img src={url} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-[9px] text-center text-[#95BF47] py-0.5 font-medium">Hauptbild</span>
              )}
              <button
                onClick={() => onRemove(i)}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border border-red-400 rounded-full flex items-center justify-center shadow-lg"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
          dragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-xs text-zinc-400">Wird hochgeladen...</p>
          </div>
        ) : (
          <>
            <ImagePlus className={`w-8 h-8 mx-auto mb-2 ${dragging ? "text-indigo-400" : "text-zinc-600"}`} />
            <p className="text-sm text-zinc-400">Bilder hierher ziehen oder <span className="text-indigo-400">klicken</span></p>
            <p className="text-xs text-zinc-600 mt-1">PNG, JPG, WebP – max. 5MB</p>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Oder Bild-URL einfügen..."
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val && val.startsWith("http")) {
                onAdd([val]);
                (e.target as HTMLInputElement).value = "";
              }
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Stat Input ──────────────────────────────────────────────────

function StatInput({ label, value, onChange, icon: Icon, color }: {
  label: string; value: number; onChange: (v: number) => void; icon: typeof Zap; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-4 h-4 ${color} shrink-0`} />
      <span className="text-xs text-zinc-400 w-32 shrink-0">{label}</span>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 accent-indigo-500" />
      <span className="text-sm font-mono text-white w-10 text-right">{value}%</span>
    </div>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [produkte, setProdukte] = useState<Produkt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<EditProduct | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkJson, setBulkJson] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [aiDiscovering, setAiDiscovering] = useState(false);
  const [aiEvidence, setAiEvidence] = useState("");
  const [aiDepth, setAiDepth] = useState<"schnell" | "gruendlich">("schnell");
  const [aiKategorie, setAiKategorie] = useState("");
  const [urlImportUrl, setUrlImportUrl] = useState("");
  const [urlImporting, setUrlImporting] = useState(false);
  type TabKey = "dashboard" | "stats" | "activity" | "customers" | "licenses" | "credits" | "users" | "tiers" | "tickets" | "codes" | "products" | "themes" | "codeBlocks" | "coaching" | "news" | "knowledge" | "settings" | "system" | "logs" | "survey";
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  interface ThemeEntry {
    id: string;
    name: string;
    fileUrl: string;
    fileName?: string;
    version?: string;
    description?: string;
    previewImageUrl?: string;
    previewVideoUrl?: string;
    changelog?: string;
    priceEur?: number;
    active?: boolean;
    tierAccess?: AdminTierKey[];
    createdAt: string;
  }
  interface SettingsData {
    logoUrl: string;
    brandName: string;
    aboImageUrl: string;
    faviconUrl: string;
    youtubeUrl: string;
    themeFileUrl: string;
    themeFileName: string;
    themeVersion: string;
    brandPrimary: string;
    brandAccent: string;
    typography: string;
    toneOfVoice: string;
    themeChangelog: string;
    themes: ThemeEntry[];
  }
  const [settingsData, setSettingsData] = useState<SettingsData>({ logoUrl: "", brandName: "", aboImageUrl: "", faviconUrl: "", youtubeUrl: "", themeFileUrl: "", themeFileName: "", themeVersion: "", brandPrimary: "", brandAccent: "#95BF47", typography: "Inter", toneOfVoice: "", themeChangelog: "", themes: [] });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [aboBusy, setAboBusy] = useState(false);
  const [faviconBusy, setFaviconBusy] = useState(false);
  const [faviconDragging, setFaviconDragging] = useState(false);
  const [themeBusyId, setThemeBusyId] = useState<string | null>(null);
  const [themePreviewBusyId, setThemePreviewBusyId] = useState<string | null>(null);

  // Knowledge Base
  const [kbContent, setKbContent] = useState("");
  const [kbLoading, setKbLoading] = useState(false);
  const [kbSaving, setKbSaving] = useState(false);

  // Tickets
  const [adminTickets, setAdminTickets] = useState<{id:string;customerName:string;subject:string;status:string;updatedAt:string;messages:{sender:string;name:string;content:string;timestamp:string}[]}[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [ticketReplying, setTicketReplying] = useState(false);

  // Credit codes
  interface CreditCodeRow {
    rowIndex: number;
    code: string;
    credits: number;
    maxPerAccount: number;
    active: boolean;
    createdAt: string;
    note: string;
    totalRedemptions: number;
  }
  const [codes, setCodes] = useState<CreditCodeRow[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codeForm, setCodeForm] = useState({
    code: "",
    credits: 100,
    maxPerAccount: 1,
    note: "",
  });
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeBusyRow, setCodeBusyRow] = useState<number | null>(null);

  // ─── API balances (DeepSeek + Fal + Replicate) ─────────────────
  const [apiBalances, setApiBalances] = useState<ApiBalance[]>([]);
  const [apiBalancesLoading, setApiBalancesLoading] = useState(false);
  const loadApiBalances = useCallback(async () => {
    setApiBalancesLoading(true);
    try {
      const res = await fetch("/api/admin/api-balances");
      if (res.ok) {
        const data = await res.json();
        setApiBalances(data.providers || []);
      }
    } catch { /* ignore */ }
    finally { setApiBalancesLoading(false); }
  }, []);

  // ─── Credit config (Preise, Icon, Gewinn pro Nutzung) ──────────
  const [creditConfig, setCreditConfig] = useState<CreditConfig>(() => defaultCreditConfig());
  const [creditConfigLoading, setCreditConfigLoading] = useState(false);
  const [creditConfigSaving, setCreditConfigSaving] = useState(false);
  const loadCreditConfig = useCallback(async () => {
    setCreditConfigLoading(true);
    try {
      const res = await fetch("/api/admin/credits/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) setCreditConfig(mergeCreditConfig(data.config));
      }
    } catch { /* ignore */ }
    finally { setCreditConfigLoading(false); }
  }, []);
  const saveCreditConfig = useCallback(async (next: CreditConfig): Promise<boolean> => {
    setCreditConfigSaving(true);
    try {
      const res = await fetch("/api/admin/credits/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.config) {
        setCreditConfig(mergeCreditConfig(data.config));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setCreditConfigSaving(false);
    }
  }, []);

  // ─── System status (health) ────────────────────────────────────
  interface SystemStatus {
    generatedAt: string;
    sheetTabs: { name: string; exists: boolean; rowCount: number; error?: string }[];
    blob: { count: number; bytesEstimate: number; mbEstimate: number };
    envChecks: { key: string; label: string; required: boolean; configured: boolean }[];
    timestamps: { latestKundeIso: string; latestTxIso: string; latestNewsIso: string };
  }
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);
  const loadSystemStatus = useCallback(async () => {
    setSystemStatusLoading(true);
    try {
      const res = await fetch("/api/admin/system-status");
      if (res.ok) setSystemStatus(await res.json());
    } catch { /* ignore */ }
    finally { setSystemStatusLoading(false); }
  }, []);

  // ─── Bulk voucher generator state ──────────────────────────────
  const [bulkVoucher, setBulkVoucher] = useState({ count: 10, credits: 100, maxPerAccount: 1, prefix: "", note: "" });
  const [bulkVoucherSaving, setBulkVoucherSaving] = useState(false);
  const [lastBulkResult, setLastBulkResult] = useState<{ created: string[]; skipped: number } | null>(null);

  // ─── Dashboard auto-refresh ────────────────────────────────────
  const [dashAutoRefresh, setDashAutoRefresh] = useState(false);

  // ─── Users tab (role + tier management) ─────────────────────────
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userBusyKey, setUserBusyKey] = useState<string | null>(null);
  const [usersAutoRefresh, setUsersAutoRefresh] = useState(true);
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const data = await safeFetch<{ users?: AdminUserRow[] }>(
      "/api/admin/users",
      { coalesceKey: "admin/users" },
    );
    if (data && Array.isArray(data.users)) {
      setUsers(data.users);
    }
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "users") loadUsers();
  }, [activeTab, loadUsers]);

  // 24/7 Live-Tracking der Credit-Stände im Users-Tab. Pollt alle 30s
  // solange Tab + sichtbar ist; pausiert wenn unsichtbar oder Tab
  // weg vom Users-View, refresht beim Re-Fokus.
  useEffect(() => {
    if (!usersAutoRefresh || activeTab !== "users") return;
    const id = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        loadUsers();
      }
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") loadUsers();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [usersAutoRefresh, activeTab, loadUsers]);

  async function handleSetRole(key: string, role: AdminUserRole) {
    setUserBusyKey(key);
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, role }),
      });
      if (res.ok) {
        setSuccess(role === "admin" ? "Zum Admin befördert." : "Zum normalen User zurückgestuft.");
        setTimeout(() => setSuccess(""), 2500);
        await loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Rollen-Update fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setUserBusyKey(null); }
  }

  async function handleSetTier(key: string, tier: AdminTierKey) {
    setUserBusyKey(key);
    try {
      const res = await fetch("/api/admin/users/tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, tier }),
      });
      if (res.ok) {
        setSuccess(`Tier auf ${tier} gesetzt.`);
        setTimeout(() => setSuccess(""), 2500);
        await loadUsers();
        await loadStats();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Tier-Update fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setUserBusyKey(null); }
  }

  async function handleCancelTier(key: string) {
    if (!confirm("Tier wirklich kündigen? Der User behält den Zugang bis zum Periodenende.")) return;
    setUserBusyKey(key);
    try {
      const res = await fetch("/api/admin/users/tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, cancel: true }),
      });
      if (res.ok) {
        setSuccess("Tier gekündigt.");
        setTimeout(() => setSuccess(""), 2500);
        await loadUsers();
        await loadStats();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Kündigung fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setUserBusyKey(null); }
  }

  async function handleImpersonate(key: string, email: string) {
    if (!confirm(`In den Account von ${email || key} wechseln? Du kannst jederzeit über das Banner zurück.`)) return;
    setUserBusyKey(key);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(data.redirect || "/home");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Impersonate fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setUserBusyKey(null); }
  }

  async function handleQuickAdjustCredits(key: string) {
    const input = prompt("Neuer Credit-Stand (absoluter Wert):");
    if (input === null) return;
    const target = Number(input);
    if (!Number.isFinite(target) || target < 0) {
      setError("Ungültige Zahl.");
      return;
    }
    setUserBusyKey(key);
    try {
      const res = await fetch("/api/admin/customer-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, action: "set-credits", payload: { balance: target } }),
      });
      if (res.ok) {
        setSuccess(`Credits auf ${target} gesetzt.`);
        setTimeout(() => setSuccess(""), 2500);
        await loadUsers();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Credits-Update fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setUserBusyKey(null); }
  }

  // ─── System logs ───────────────────────────────────────────────
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<{ level: "" | "info" | "warn" | "error" | "audit"; sinceDays: number; q: string }>({ level: "", sinceDays: 30, q: "" });
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "300");
    if (logFilter.level) params.set("level", logFilter.level);
    if (logFilter.sinceDays > 0) params.set("sinceDays", String(logFilter.sinceDays));
    if (logFilter.q) params.set("actor", logFilter.q);
    const data = await safeFetch<{ entries?: AdminLogEntry[] }>(
      `/api/admin/logs?${params.toString()}`,
      { coalesceKey: `admin/logs?${params.toString()}` },
    );
    if (data && Array.isArray(data.entries)) {
      setLogs(data.entries);
    }
    setLogsLoading(false);
  }, [logFilter]);

  useEffect(() => {
    if (activeTab === "logs") loadLogs();
  }, [activeTab, loadLogs]);

  // ─── Tier config (admin-editable price table) ─────────────────
  const [tierConfig, setTierConfig] = useState<AdminTier[]>([]);
  const [tierConfigLoading, setTierConfigLoading] = useState(false);
  const [tierConfigSaving, setTierConfigSaving] = useState(false);
  const loadTierConfig = useCallback(async () => {
    setTierConfigLoading(true);
    try {
      const res = await fetch("/api/admin/tiers");
      if (res.ok) {
        const data = await res.json();
        setTierConfig(data.tiers || []);
      }
    } catch { /* ignore */ }
    finally { setTierConfigLoading(false); }
  }, []);

  async function saveTierConfig(next: AdminTier[]) {
    setTierConfigSaving(true);
    try {
      const res = await fetch("/api/admin/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setTierConfig(data.tiers || []);
        setSuccess("Tier-Preise gespeichert.");
        setTimeout(() => setSuccess(""), 2500);
        await loadStats();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Speichern fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setTierConfigSaving(false); }
  }

  useEffect(() => {
    if (activeTab === "settings" || activeTab === "tiers") loadTierConfig();
  }, [activeTab, loadTierConfig]);

  // ─── Stats / Dashboard ─────────────────────────────────────────
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const data = await safeFetch<AdminStats>(
      "/api/admin/stats",
      { coalesceKey: "admin/stats", timeoutMs: 45_000 },
    );
    if (data && (data.customers || data.subscriptions)) {
      setStats(data);
    }
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "dashboard" || activeTab === "stats") loadStats();
  }, [activeTab, loadStats]);

  // ─── Activity feed ──────────────────────────────────────────────
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState<{ type: string; q: string; sinceDays: number }>({ type: "", q: "", sinceDays: 0 });
  const loadActivity = useCallback(async () => {
    setActivityLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (activityFilter.type) params.set("type", activityFilter.type);
    if (activityFilter.q) params.set("customer", activityFilter.q);
    if (activityFilter.sinceDays) params.set("sinceDays", String(activityFilter.sinceDays));
    const data = await safeFetch<{ entries?: ActivityEntry[] }>(
      `/api/admin/activity?${params.toString()}`,
      { coalesceKey: `admin/activity?${params.toString()}` },
    );
    if (data && Array.isArray(data.entries)) {
      setActivity(data.entries);
    }
    setActivityLoading(false);
  }, [activityFilter]);

  useEffect(() => {
    if (activeTab === "activity") loadActivity();
  }, [activeTab, loadActivity]);

  // ─── News posts (admin curate via /api/admin/news) ──────────────
  interface NewsPost { rowIndex: number; id: string; type: "text" | "video"; title: string; body: string; imageUrl: string; youtubeUrl: string; previewImageUrl: string; active: boolean; createdAt: string }
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch("/api/admin/news");
      if (res.ok) {
        const data = await res.json();
        setNewsPosts(data.posts || []);
      }
    } catch { /* ignore */ }
    finally { setNewsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "news") loadNews();
  }, [activeTab, loadNews]);

  // ─── Code blocks (admin curate via /api/admin/code-blocks) ──────
  const [codeBlocks, setCodeBlocks] = useState<AdminCodeBlock[]>([]);
  const [codeBlocksLoading, setCodeBlocksLoading] = useState(false);
  const loadCodeBlocks = useCallback(async () => {
    setCodeBlocksLoading(true);
    try {
      const res = await fetch("/api/admin/code-blocks");
      if (res.ok) {
        const data = await res.json();
        setCodeBlocks(data.blocks || []);
      }
    } catch { /* ignore */ }
    finally { setCodeBlocksLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "codeBlocks") loadCodeBlocks();
  }, [activeTab, loadCodeBlocks]);

  // ─── Coaching tips (admin curate via /api/admin/coaching) ───────
  const [coachingTips, setCoachingTips] = useState<AdminCoachingTip[]>([]);
  const [coachingWhatsapp, setCoachingWhatsapp] = useState("");
  const [coachingLoading, setCoachingLoading] = useState(false);
  const loadCoaching = useCallback(async () => {
    setCoachingLoading(true);
    try {
      const res = await fetch("/api/admin/coaching");
      if (res.ok) {
        const data = await res.json();
        setCoachingTips(data.tips || []);
        setCoachingWhatsapp(data.whatsapp || "");
      }
    } catch { /* ignore */ }
    finally { setCoachingLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "coaching") loadCoaching();
  }, [activeTab, loadCoaching]);

  // ─── New: System status load + Dashboard auto-refresh ──────────
  useEffect(() => {
    if (activeTab === "system") {
      loadSystemStatus();
      loadApiBalances();
    }
    // The Dashboard now shows the API-credit balances right at the top.
    if (activeTab === "dashboard") loadApiBalances();
  }, [activeTab, loadSystemStatus, loadApiBalances]);

  useEffect(() => {
    if (activeTab === "credits") loadCreditConfig();
  }, [activeTab, loadCreditConfig]);

  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== "dashboard") return;
    const id = setInterval(() => loadStats(), 30_000);
    return () => clearInterval(id);
  }, [dashAutoRefresh, activeTab, loadStats]);

  // ── Customer action handler (note / vip / blocked / reset / set-credits) ──
  const [customerActionSaving, setCustomerActionSaving] = useState(false);
  async function handleCustomerAction(
    action: "set-note" | "set-vip" | "set-blocked" | "reset-starter" | "set-credits",
    payload?: Record<string, unknown>,
  ) {
    if (!activeCustomerKey || customerActionSaving) return;
    setCustomerActionSaving(true);
    try {
      const res = await fetch("/api/admin/customer-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: activeCustomerKey, action, payload }),
      });
      if (res.ok) {
        await loadCustomerDetail(activeCustomerKey);
        await loadCustomers();
        setSuccess(`Aktion „${action}" erfolgreich.`);
        setTimeout(() => setSuccess(""), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Aktion fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setCustomerActionSaving(false); }
  }

  // ── Bulk voucher generator ──
  async function handleBulkVoucher() {
    if (bulkVoucherSaving) return;
    setBulkVoucherSaving(true);
    setLastBulkResult(null);
    try {
      const res = await fetch("/api/admin/credit-codes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkVoucher),
      });
      if (res.ok) {
        const data = await res.json();
        setLastBulkResult({ created: data.created, skipped: data.skipped });
        setSuccess(`${data.created.length} Codes erstellt${data.skipped ? ` (${data.skipped} übersprungen)` : ""}.`);
        setTimeout(() => setSuccess(""), 4000);
        await loadCodes();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Bulk-Erstellung fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setBulkVoucherSaving(false); }
  }

  // ── CSV Export helpers ──
  function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const escape = (v: string | number) => {
      const s = String(v ?? "");
      if (s.includes('"') || s.includes(",") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCustomersCsv() {
    exportCsv(
      `kunden-${new Date().toISOString().slice(0, 10)}.csv`,
      ["License", "Email", "Shop-Domain", "SKU", "Status", "Balance", "Σ Gekauft", "Σ Verbraucht", "Starter", "Shop verbunden", "Google verknüpft"],
      customers.map((c) => [
        c.lizenzschluessel, c.kundenEmail, c.shopDomain, c.sku, c.status,
        c.credits.balance, c.credits.totalPurchased, c.credits.totalUsed,
        c.credits.starterGranted ? "ja" : "nein",
        c.hasShopifyToken ? "ja" : "nein",
        c.hasGoogleLinked ? "ja" : "nein",
      ]),
    );
  }

  function exportActivityCsv() {
    exportCsv(
      `aktivitaet-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Zeit", "Typ", "Delta", "Balance danach", "Grund", "Referenz", "Kunde-License", "Kunde-Email", "Shop"],
      activity.map((e) => [
        e.ts, e.type, e.delta, e.balanceAfter, e.reason, e.ref || "",
        e.customerKey, e.email, e.shopDomain,
      ]),
    );
  }

  // ─── Customers (admin overview) ─────────────────────────────────
  interface CustomerSummary {
    rowIndex: number;
    lizenzschluessel: string;
    status: string;
    shopDomain: string;
    kundenEmail: string;
    bestellnummer: string;
    sku: string;
    hasShopifyToken: boolean;
    hasGoogleLinked: boolean;
    hasLegalData: boolean;
    hasBrandKit: boolean;
    subscriptionEndsAt: string;
    blocked: boolean;
    credits: {
      balance: number;
      totalPurchased: number;
      totalUsed: number;
      starterGranted: boolean;
      fulfilledOrdersCount: number;
      redeemedCodesCount: number;
      logCount: number;
      lastTransaction?: { ts: string; type: string; delta: number; balanceAfter: number; reason: string; ref?: string };
    };
  }
  interface CustomerDetail extends CustomerSummary {
    profile: {
      legal_data?: Record<string, string>;
      brand_kit?: Record<string, string>;
      onboarding_checklist?: Record<string, boolean>;
      linkedGoogleEmail?: string;
      adminNote?: string;
      vip?: boolean;
      blocked?: boolean;
      blockedAt?: string;
    };
    fulfilledOrders: string[];
    redeemedCodes: Record<string, number>;
    log: { ts: string; type: string; delta: number; balanceAfter: number; reason: string; ref?: string }[];
  }
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [activeCustomerKey, setActiveCustomerKey] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ delta: 0, note: "" });
  const [adjustSaving, setAdjustSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch("/api/admin/customers");
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch { /* ignore */ }
    finally { setCustomersLoading(false); }
  }, []);

  const loadCustomerDetail = useCallback(async (key: string) => {
    setCustomerDetailLoading(true);
    setCustomerDetail(null);
    try {
      const res = await fetch(`/api/admin/customers?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        setCustomerDetail(data.customer);
      }
    } catch { /* ignore */ }
    finally { setCustomerDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "customers" || activeTab === "licenses") loadCustomers();
  }, [activeTab, loadCustomers]);

  useEffect(() => {
    if (activeCustomerKey) loadCustomerDetail(activeCustomerKey);
  }, [activeCustomerKey, loadCustomerDetail]);

  // ── Admin: ensure 500 starter credits for every customer ──
  const [ensuringStarter, setEnsuringStarter] = useState(false);
  async function handleEnsureStarter() {
    if (ensuringStarter) return;
    if (!confirm("Allen Kunden ohne Starter-Bonus die 500 Credits sicherstellen? Bestehende Kunden mit Bonus werden NICHT doppelt beschenkt.")) return;
    setEnsuringStarter(true);
    setError("");
    try {
      const res = await fetch("/api/admin/customers/ensure-starter", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Backfill fehlgeschlagen.");
      } else {
        setSuccess(`Starter-Backfill: ${data.granted} neu beschenkt, ${data.skipped} übersprungen${data.errors?.length ? ` · ${data.errors.length} Fehler` : ""}.`);
        setTimeout(() => setSuccess(""), 5000);
        await loadCustomers();
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setEnsuringStarter(false); }
  }

  async function handleAdjust() {
    if (!activeCustomerKey || !adjustForm.delta) return;
    setAdjustSaving(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeCustomerKey,
          delta: adjustForm.delta,
          note: adjustForm.note,
        }),
      });
      if (res.ok) {
        setAdjustForm({ delta: 0, note: "" });
        await loadCustomerDetail(activeCustomerKey);
        await loadCustomers();
        setSuccess(`Credits angepasst (${adjustForm.delta > 0 ? "+" : ""}${adjustForm.delta}).`);
        setTimeout(() => setSuccess(""), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Anpassung fehlgeschlagen.");
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setAdjustSaving(false); }
  }

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products");
      if (res.status === 401) { router.push("/"); return; }
      const data = await res.json();
      setProdukte((data.produkte || []).filter((p: Produkt) => p.id || p.titel));
    } catch { setError("Fehler beim Laden."); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Load knowledge base
  useEffect(() => {
    if (activeTab === "knowledge") {
      setKbLoading(true);
      fetch("/api/admin/knowledge-base").then(r => r.json()).then(d => setKbContent(d.content || "")).catch(() => {}).finally(() => setKbLoading(false));
    }
  }, [activeTab]);

  // Load tickets
  useEffect(() => {
    if (activeTab === "tickets") {
      setTicketsLoading(true);
      fetch("/api/tickets").then(r => r.json()).then(d => setAdminTickets(d.tickets || [])).catch(() => {}).finally(() => setTicketsLoading(false));
    }
  }, [activeTab]);

  // Load codes
  const loadCodes = useCallback(async () => {
    setCodesLoading(true);
    try {
      const res = await fetch("/api/admin/credit-codes");
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
      }
    } catch { /* ignore */ }
    finally { setCodesLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "codes") loadCodes();
  }, [activeTab, loadCodes]);

  async function handleCreateCode() {
    if (!codeForm.code.trim() || codeForm.credits <= 0) return;
    setCodeSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/credit-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeForm.code.trim().toUpperCase(),
          credits: codeForm.credits,
          maxPerAccount: codeForm.maxPerAccount,
          note: codeForm.note.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Anlegen fehlgeschlagen.");
      } else {
        setSuccess(`Code "${codeForm.code.trim().toUpperCase()}" angelegt.`);
        setTimeout(() => setSuccess(""), 3000);
        setCodeForm({ code: "", credits: 100, maxPerAccount: 1, note: "" });
        await loadCodes();
      }
    } catch { setError("Verbindungsfehler."); }
    finally { setCodeSaving(false); }
  }

  async function handleToggleCode(c: CreditCodeRow) {
    setCodeBusyRow(c.rowIndex);
    try {
      await fetch("/api/admin/credit-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: c.rowIndex, active: !c.active }),
      });
      await loadCodes();
    } catch { setError("Update fehlgeschlagen."); }
    finally { setCodeBusyRow(null); }
  }

  async function handleDeleteCode(c: CreditCodeRow) {
    if (!confirm(`Code "${c.code}" wirklich löschen?`)) return;
    setCodeBusyRow(c.rowIndex);
    try {
      await fetch("/api/admin/credit-codes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: c.rowIndex }),
      });
      await loadCodes();
    } catch { setError("Löschen fehlgeschlagen."); }
    finally { setCodeBusyRow(null); }
  }

  async function saveKnowledgeBase() {
    setKbSaving(true);
    try {
      const res = await fetch("/api/admin/knowledge-base", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: kbContent }) });
      if (res.ok) { setSuccess("KI-Firmenwissen gespeichert."); setTimeout(() => setSuccess(""), 3000); }
    } catch { setError("Speichern fehlgeschlagen."); }
    finally { setKbSaving(false); }
  }

  async function handleTicketReply(ticketId: string) {
    if (!ticketReply.trim()) return;
    setTicketReplying(true);
    try {
      await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, message: ticketReply, senderName: "Support" }) });
      setTicketReply("");
      const res = await fetch("/api/tickets"); const d = await res.json(); setAdminTickets(d.tickets || []);
    } catch { setError("Antwort fehlgeschlagen."); }
    finally { setTicketReplying(false); }
  }

  async function handleTicketStatus(ticketId: string, status: string) {
    try {
      await fetch("/api/tickets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId, status }) });
      const res = await fetch("/api/tickets"); const d = await res.json(); setAdminTickets(d.tickets || []);
      setSuccess(`Ticket ${status === "resolved" ? "gelöst" : "geschlossen"}.`); setTimeout(() => setSuccess(""), 3000);
    } catch { setError("Status-Update fehlgeschlagen."); }
  }

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(data => {
      setSettingsData({
        logoUrl: data.logoUrl || "",
        brandName: data.brandName || "",
        aboImageUrl: data.aboImageUrl || "",
        faviconUrl: data.faviconUrl || "",
        youtubeUrl: data.youtubeUrl || "",
        themeFileUrl: data.themeFileUrl || "",
        themeFileName: data.themeFileName || "",
        themeVersion: data.themeVersion || "",
        brandPrimary: data.brandPrimary || "",
        brandAccent: data.brandAccent || "#95BF47",
        typography: data.typography || "Inter",
        toneOfVoice: data.toneOfVoice || "",
        themeChangelog: data.themeChangelog || "",
        themes: Array.isArray(data.themes) ? data.themes : [],
      });
    }).catch(() => {});
  }, []);

  async function saveSettings() {
    setSettingsLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settingsData) });
      if (res.ok) {
        setSuccess("Einstellungen gespeichert.");
        setTimeout(() => setSuccess(""), 3000);
        // Push the new logo / brand-name to every open tab + this page
        refreshBranding();
      } else { const d = await res.json(); setError(d.error || "Fehler."); }
    } catch { setError("Speichern fehlgeschlagen."); }
    finally { setSettingsLoading(false); }
  }

  // ── Logo: upload + persist as one atomic action ────────────────
  // Picking a file uploads AND saves immediately — no separate
  // "Speichern" click to forget. Large raster logos are downscaled in
  // the browser first so the upload can never trip a body-size limit.
  function prepareLogoFile(file: File): Promise<File> {
    return new Promise((resolve) => {
      // SVG is vector + tiny; small files are already fine.
      if (file.type === "image/svg+xml" || file.size <= 600 * 1024) {
        resolve(file);
        return;
      }
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > MAX || h > MAX) {
          const s = MAX / Math.max(w, h);
          w = Math.round(w * s);
          h = Math.round(h * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const name = file.name.replace(/\.[^.]+$/, "") + ".png";
            resolve(new File([blob], name, { type: "image/png" }));
          },
          "image/png",
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  }

  // POST only logoUrl — the settings route merges it into the stored
  // JSON, so unsaved edits in other fields are never swept in.
  async function persistLogo(logoUrl: string): Promise<boolean> {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoUrl }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Logo speichern fehlgeschlagen.");
      return false;
    }
    setSettingsData((prev) => ({ ...prev, logoUrl }));
    refreshBranding();
    return true;
  }

  async function uploadLogo(file: File) {
    setLogoBusy(true);
    setError("");
    try {
      const prepared = await prepareLogoFile(file);
      const fd = new FormData();
      fd.append("file", prepared);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData?.url) {
        setError(upData?.error || "Logo-Upload fehlgeschlagen.");
        return;
      }
      if (await persistLogo(upData.url)) {
        setSuccess("Logo hochgeladen und gespeichert.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Logo-Upload fehlgeschlagen.");
    } finally {
      setLogoBusy(false);
    }
  }

  async function commitLogoUrl(rawUrl: string) {
    const logoUrl = rawUrl.trim();
    setLogoBusy(true);
    setError("");
    try {
      if (await persistLogo(logoUrl)) {
        setSuccess(logoUrl ? "Logo gespeichert." : "Logo entfernt.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Logo speichern fehlgeschlagen.");
    } finally {
      setLogoBusy(false);
    }
  }

  // ── Abo-Bild (Login-Seite): upload + persist ───────────────────
  async function persistAboImage(aboImageUrl: string): Promise<boolean> {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aboImageUrl }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Abo-Bild speichern fehlgeschlagen.");
      return false;
    }
    setSettingsData((prev) => ({ ...prev, aboImageUrl }));
    return true;
  }

  async function uploadAboImage(file: File) {
    setAboBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData?.url) {
        setError(upData?.error || "Abo-Bild-Upload fehlgeschlagen.");
        return;
      }
      if (await persistAboImage(upData.url)) {
        setSuccess("Abo-Bild hochgeladen und gespeichert.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Abo-Bild-Upload fehlgeschlagen.");
    } finally {
      setAboBusy(false);
    }
  }

  async function commitAboImageUrl(rawUrl: string) {
    const aboImageUrl = rawUrl.trim();
    setAboBusy(true);
    setError("");
    try {
      if (await persistAboImage(aboImageUrl)) {
        setSuccess(aboImageUrl ? "Abo-Bild gespeichert." : "Abo-Bild entfernt.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Abo-Bild speichern fehlgeschlagen.");
    } finally {
      setAboBusy(false);
    }
  }

  // ── Favicon (Browser-Tab-Icon) — Upload + Drag&Drop ──
  async function persistFavicon(faviconUrl: string): Promise<boolean> {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faviconUrl }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Favicon speichern fehlgeschlagen.");
      return false;
    }
    setSettingsData((prev) => ({ ...prev, faviconUrl }));
    return true;
  }

  async function uploadFavicon(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Bitte eine Bilddatei ablegen (PNG, ICO, SVG …).");
      return;
    }
    setFaviconBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json().catch(() => ({}));
      if (!upRes.ok || !upData?.url) {
        setError(upData?.error || "Favicon-Upload fehlgeschlagen.");
        return;
      }
      if (await persistFavicon(upData.url)) {
        setSuccess("Favicon hochgeladen und gespeichert.");
        refreshBranding();
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Favicon-Upload fehlgeschlagen.");
    } finally {
      setFaviconBusy(false);
    }
  }

  async function commitFaviconUrl(rawUrl: string) {
    const faviconUrl = rawUrl.trim();
    setFaviconBusy(true);
    setError("");
    try {
      if (await persistFavicon(faviconUrl)) {
        setSuccess(faviconUrl ? "Favicon gespeichert." : "Favicon entfernt.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Favicon speichern fehlgeschlagen.");
    } finally {
      setFaviconBusy(false);
    }
  }

  function addNewTheme() {
    const id = `theme_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const next: ThemeEntry = {
      id,
      name: "Neues Theme",
      fileUrl: "",
      fileName: "",
      version: "1.0.0",
      description: "",
      previewImageUrl: "",
      previewVideoUrl: "",
      changelog: "",
      priceEur: 0,
      active: true,
      tierAccess: ["pro"],
      createdAt: new Date().toISOString(),
    };
    setSettingsData(prev => ({ ...prev, themes: [...prev.themes, next] }));
  }

  function updateTheme(id: string, patch: Partial<ThemeEntry>) {
    setSettingsData(prev => ({
      ...prev,
      themes: prev.themes.map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  }

  function removeTheme(id: string) {
    if (!confirm("Theme wirklich entfernen? (Speichern nicht vergessen)")) return;
    setSettingsData(prev => ({ ...prev, themes: prev.themes.filter(t => t.id !== id) }));
  }

  async function uploadThemeZip(id: string, file: File) {
    setThemeBusyId(id);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        updateTheme(id, { fileUrl: data.url, fileName: file.name });
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Theme-Upload fehlgeschlagen.");
      }
    } catch { setError("Theme-Upload fehlgeschlagen."); }
    finally { setThemeBusyId(null); }
  }

  async function uploadThemePreview(id: string, file: File) {
    setThemePreviewBusyId(id);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        updateTheme(id, { previewImageUrl: data.url });
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Vorschaubild-Upload fehlgeschlagen.");
      }
    } catch { setError("Vorschaubild-Upload fehlgeschlagen."); }
    finally { setThemePreviewBusyId(null); }
  }

  function produktToEdit(p: Produkt): EditProduct {
    // Deduplicate: bildUrl is also stored as first element of extra.images
    const allImgs = [p.bildUrl, ...(p.extra?.images || [])].filter(Boolean);
    const uniqueImgs = [...new Set(allImgs)];
    return {
      rowIndex: p.rowIndex, id: p.id, sku: p.sku, monat: p.monat, titel: p.titel,
      beschreibung: p.beschreibung, aliExpressLink: p.aliExpressLink,
      images: uniqueImgs,
      stats: p.extra?.stats || { ...EMPTY.stats },
      finances: p.extra?.finances || { ...EMPTY.finances },
      links: p.extra?.links,
      ads: p.extra?.ads,
      linkStatus: p.extra?.linkStatus,
      deepStats: p.extra?.deepStats,
      audience: p.extra?.audience,
      adStrategy: p.extra?.adStrategy,
      votes: p.extra?.votes,
    };
  }

  function openNew() { setAiEvidence(""); setEditProduct({ ...EMPTY, stats: { ...EMPTY.stats }, finances: { ...EMPTY.finances }, images: [] }); setIsNew(true); setEditModal(true); }
  function openEdit(p: Produkt) { setAiEvidence(""); setEditProduct(produktToEdit(p)); setIsNew(false); setEditModal(true); }

  async function handleSave() {
    if (!editProduct) return;
    // Harte Frontend-Validierung VOR dem Senden — kein leerer Titel
    // mehr ans Backend (sonst 400 vom Server).
    if (!editProduct.titel.trim()) {
      setError("Bitte einen Titel eingeben.");
      return;
    }
    setSaving(true); setError("");
    try {
      const images = editProduct.images.filter(u => u && typeof u === "string" && u.startsWith("http"));
      const body = {
        ...(isNew ? {} : { rowIndex: editProduct.rowIndex }),
        // ID + SKU werden nicht mehr im Formular editiert. Bei neuen
        // Produkten wird die ID automatisch generiert. SKU bleibt
        // leer (oder behaelt seinen alten Wert wenn editiert).
        id: editProduct.id || `prod_${Date.now()}`,
        sku: editProduct.sku || "", monat: editProduct.monat || "",
        titel: editProduct.titel.trim(), beschreibung: editProduct.beschreibung,
        aliExpressLink: editProduct.aliExpressLink,
        bildUrl: images[0] || "",
        preis: String(editProduct.finances.recommendedSellPrice || ""),
        extra: {
          stats: editProduct.stats,
          finances: {
            ...editProduct.finances,
            profitMargin: Math.round((Number(editProduct.finances.recommendedSellPrice || 0) - Number(editProduct.finances.buyPrice || 0)) * 100) / 100,
          },
          images,
          // Strukturierte Felder durchreichen — der Admin editiert sie
          // (noch) nicht im Formular, aber sie müssen den Roundtrip
          // überleben damit Linkstatus + Beispiel-Ads erhalten bleiben.
          ...(editProduct.links ? { links: editProduct.links } : {}),
          ...(editProduct.ads ? { ads: editProduct.ads } : {}),
          ...(editProduct.linkStatus ? { linkStatus: editProduct.linkStatus } : {}),
          ...(editProduct.deepStats ? { deepStats: editProduct.deepStats } : {}),
          ...(editProduct.audience ? { audience: editProduct.audience } : {}),
          ...(editProduct.adStrategy ? { adStrategy: editProduct.adStrategy } : {}),
          ...(editProduct.votes ? { votes: editProduct.votes } : {}),
        },
      };
      console.log("=== [Save] PAYLOAD VOR DEM SENDEN ===");
      console.log("[Save] isNew:", isNew, "rowIndex:", editProduct.rowIndex);
      console.log("[Save] titel:", body.titel, "preis:", body.preis, "id:", body.id);
      console.log("[Save] images:", JSON.stringify(images));
      console.log("[Save] extra keys:", Object.keys(body.extra || {}).join(","));
      console.log("[Save] full body:", JSON.stringify(body));
      const res = await fetch("/api/admin/products", { method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      let d: Record<string, unknown> = {};
      try { d = await res.json(); } catch { d = {}; }
      console.log("[Save] HTTP", res.status, "version:", d.version, "response:", d);
      if (!res.ok) { setError(String(d.error || `Speichern fehlgeschlagen (HTTP ${res.status})`)); return; }
      // Verification ist nicht-fatal. Wenn der Server nur Warning hat
      // (z.B. updatedRange-Parser hat -1 geliefert, Sheets ist eventual
      // consistent), zeigen wir das im Success-Banner an aber blockieren
      // den Erfolg NICHT.
      const verification = d.verification as { ok?: boolean; message?: string } | undefined;
      setEditModal(false); setEditProduct(null);
      const warning = d.warning ? ` (${String(d.warning)})` : "";
      const verifyWarning = verification?.message ? ` — ${verification.message}` : "";
      setSuccess(
        (isNew ? "Produkt hinzugefügt." : "Produkt aktualisiert.") + warning + verifyWarning,
      );
      setTimeout(() => setSuccess(""), warning || verifyWarning ? 10000 : 3000);
      await loadProducts();
    } catch { setError("Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function handleDelete(rowIndex: number) {
    if (!confirm("Produkt wirklich löschen?")) return;
    try {
      const res = await fetch("/api/admin/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rowIndex }) });
      if (!res.ok) { const d = await res.json(); setError(d.error); return; }
      setSuccess("Produkt gelöscht."); setTimeout(() => setSuccess(""), 3000);
      await loadProducts();
    } catch { setError("Löschen fehlgeschlagen."); }
  }

  async function handleBulkImport() {
    setBulkLoading(true); setError("");
    try {
      let parsed;
      try { parsed = JSON.parse(bulkJson); } catch { setError("Ungültiges JSON."); setBulkLoading(false); return; }
      const payload = Array.isArray(parsed) ? parsed : parsed;
      const res = await fetch("/api/admin/products/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setBulkModal(false); setBulkJson("");
      setSuccess(`${data.count} Produkte importiert.`); setTimeout(() => setSuccess(""), 5000);
      await loadProducts();
    } catch { setError("Bulk-Import fehlgeschlagen."); }
    finally { setBulkLoading(false); }
  }

  async function handleAiDiscover() {
    setAiDiscovering(true); setError(""); setSuccess(""); setAiEvidence("");
    try {
      const res = await fetch("/api/admin/products/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: aiDepth, kategorie: aiKategorie.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "KI-Produktsuche fehlgeschlagen."); return; }
      const p = data.produkt || {};
      setEditProduct({
        id: "",
        sku: p.sku || "",
        monat: "",
        titel: p.titel || "",
        beschreibung: p.beschreibung || "",
        aliExpressLink: p.aliExpressLink || p.links?.aliExpressProduct || "",
        images: Array.isArray(p.images) ? p.images : [],
        stats: { ...EMPTY.stats, ...(p.stats || {}) },
        finances: { ...EMPTY.finances, ...(p.finances || {}) },
        links: p.links,
        ads: p.ads,
        linkStatus: p.linkStatus,
        deepStats: p.deepStats,
        audience: p.audience,
        adStrategy: p.adStrategy,
        votes: p.votes,
      });
      setIsNew(true);
      setAiEvidence(data.viralEvidence || "");
      setEditModal(true);
    } catch { setError("KI-Produktsuche fehlgeschlagen."); }
    finally { setAiDiscovering(false); }
  }

  // URL-basierte KI-Discovery: Admin gibt einen Link (Insta-Reel,
  // TikTok-Video, Shopify-Produkt, AliExpress-Item), die KI extrahiert
  // alle Daten drumherum (Bilder, Ads, Shops, Audience, Strategie).
  // Fuellt dieselbe Edit-Modal wie die normale Discovery.
  async function handleUrlDiscover() {
    const url = urlImportUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      setError("Bitte eine gueltige URL angeben (https://…).");
      return;
    }
    setUrlImporting(true); setError(""); setSuccess(""); setAiEvidence("");
    try {
      const res = await fetch("/api/admin/products/discover-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "URL-Discovery fehlgeschlagen."); return; }
      const p = data.produkt || {};
      setEditProduct({
        id: "",
        sku: p.sku || "",
        monat: "",
        titel: p.titel || "",
        beschreibung: p.beschreibung || "",
        aliExpressLink: p.aliExpressLink || p.links?.aliExpressProduct || "",
        images: Array.isArray(p.images) ? p.images : [],
        stats: { ...EMPTY.stats, ...(p.stats || {}) },
        finances: { ...EMPTY.finances, ...(p.finances || {}) },
        links: p.links,
        ads: p.ads,
        linkStatus: p.linkStatus,
        deepStats: p.deepStats,
        audience: p.audience,
        adStrategy: p.adStrategy,
        votes: p.votes,
      });
      setIsNew(true);
      setAiEvidence(data.viralEvidence || "");
      setEditModal(true);
      setUrlImportUrl(""); // Input leeren nach Erfolg
    } catch { setError("URL-Discovery fehlgeschlagen."); }
    finally { setUrlImporting(false); }
  }

  // KI-Re-Discovery: generiert die KI-Daten für ein BESTEHENDES
  // Produkt neu (Bilder, Ads, Dropshipping, Links). Behält rowIndex
  // + id, damit der Save als PUT auf dieselbe Zeile geht — keine
  // Duplikate. Wird über das Sparkles-Icon im Grid getriggert.
  async function handleReDiscover(p: Produkt) {
    setAiDiscovering(true); setError(""); setSuccess(""); setAiEvidence("");
    try {
      const res = await fetch("/api/admin/products/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ depth: aiDepth, kategorie: p.sku || "" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "KI-Produktsuche fehlgeschlagen."); return; }
      const dp = data.produkt || {};
      const existingImages = [p.bildUrl, ...(p.extra?.images || [])].filter(Boolean);
      const newImages = Array.isArray(dp.images) ? dp.images : [];
      setEditProduct({
        rowIndex: p.rowIndex,
        id: p.id,
        sku: dp.sku || p.sku || "",
        monat: p.monat || "",
        titel: dp.titel || p.titel || "",
        beschreibung: dp.beschreibung || p.beschreibung || "",
        aliExpressLink:
          dp.aliExpressLink || dp.links?.aliExpressProduct || p.aliExpressLink || "",
        images: newImages.length > 0 ? newImages : existingImages,
        stats: { ...EMPTY.stats, ...(p.extra?.stats || {}), ...(dp.stats || {}) },
        finances: { ...EMPTY.finances, ...(p.extra?.finances || {}), ...(dp.finances || {}) },
        links: dp.links || p.extra?.links,
        ads: dp.ads || p.extra?.ads,
        linkStatus: dp.linkStatus || p.extra?.linkStatus,
        deepStats: dp.deepStats || p.extra?.deepStats,
        audience: dp.audience || p.extra?.audience,
        adStrategy: dp.adStrategy || p.extra?.adStrategy,
        // Re-Discovery soll bestehende User-Votes NICHT überschreiben
        votes: p.extra?.votes,
      });
      setIsNew(false);
      setAiEvidence(data.viralEvidence || "");
      setEditModal(true);
    } catch { setError("KI-Re-Discovery fehlgeschlagen."); }
    finally { setAiDiscovering(false); }
  }

  // Manueller Trigger des Linkcheck-Cron — admin-only. Gibt sofort
  // Feedback ob alle Links noch erreichbar sind.
  const [linkCheckRunning, setLinkCheckRunning] = useState(false);
  async function handleManualLinkCheck() {
    setLinkCheckRunning(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/cron/check-product-links", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Linkcheck fehlgeschlagen."); return; }
      setSuccess(`Linkcheck abgeschlossen: ${data.scanned} geprüft, ${data.updated} aktualisiert, ${data.brokenProduct + data.brokenCategory + data.brokenDropshipping} broken.`);
      setTimeout(() => setSuccess(""), 6000);
      await loadProducts();
    } catch { setError("Linkcheck fehlgeschlagen."); }
    finally { setLinkCheckRunning(false); }
  }

  // Repariert Produktzeilen, in denen Titel und Preis vertauscht
  // gespeichert wurden (titel = "prod_xxx", preis = echter Titel).
  // Erst Dry-Run zum Vorschauen, dann ein zweiter Klick committet.
  // Im Dry-Run wird IMMER ein Sample der Rohdaten zurueckgegeben,
  // damit der Admin sieht WAS gespeichert ist falls 0 matchen.
  const [repairRunning, setRepairRunning] = useState(false);
  interface RepairSampleRow {
    rowIndex: number;
    id: string;
    sku: string;
    titel: string;
    bildUrl: string;
    preis: string;
    titelLooksLikeId: boolean;
    preisLooksLikeTitle: boolean;
  }
  interface RepairChangeRow {
    rowIndex: number;
    id: string;
    oldTitel: string;
    oldPreis: string;
    newTitel: string;
    action: string;
  }
  const [repairPreview, setRepairPreview] = useState<{
    scanned: number;
    changed: number;
    changes: RepairChangeRow[];
    sample?: RepairSampleRow[];
  } | null>(null);

  async function handleRepairProducts() {
    setRepairRunning(true); setError(""); setSuccess("");
    // Wenn schon Vorschau mit Aenderungen existiert: commit. Sonst dry-run.
    const dryRun = !(repairPreview && repairPreview.changed > 0);
    console.log("[Repair] click — dryRun:", dryRun, "existing preview:", repairPreview);
    try {
      const res = await fetch("/api/admin/products/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });
      console.log("[Repair] HTTP", res.status, res.statusText);
      // Status + Body immer einsehbar machen — falls etwas schiefgeht
      // muss der Admin den HTTP-Code sehen (404 = Deploy noch nicht da,
      // 401 = Session abgelaufen, 500 = Sheets-Fehler, etc.).
      let data: Record<string, unknown> = {};
      try { data = await res.json(); } catch { data = {}; }
      console.log("[Repair] response data:", data);
      if (!res.ok) {
        setError(`Repair fehlgeschlagen (HTTP ${res.status}): ${String(data.error || res.statusText || "Unbekannter Fehler")} — Wenn HTTP 404: Vercel-Deploy noch nicht durch, warte 1–2 Min und drück Strg+F5.`);
        return;
      }
      if (dryRun) {
        // Auch wenn 0 changes — wir oeffnen das Preview-Modal, damit
        // der Admin die Sample-Daten zur Diagnose sieht.
        setRepairPreview({
          scanned: Number(data.scanned) || 0,
          changed: Number(data.changed) || 0,
          changes: Array.isArray(data.changes) ? (data.changes as RepairChangeRow[]) : [],
          sample: Array.isArray(data.sample) ? (data.sample as RepairSampleRow[]) : undefined,
        });
      } else {
        setSuccess(`Repariert: ${data.changed} von ${data.scanned} Zeilen.`);
        setRepairPreview(null);
        setTimeout(() => setSuccess(""), 6000);
        await loadProducts();
      }
    } catch (e) {
      console.error("[Repair] exception:", e);
      setError(`Repair fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
    finally { setRepairRunning(false); }
  }

  async function handleLogout() { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); }

  const filtered = produkte;

  if (loading) return <div className="min-h-screen bg-mesh flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" /></div>;

  const openTicketsCount = adminTickets.filter(t => t.status === "open").length;

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-40 right-10 w-72 h-72 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-3">
        {/* Mobile header — sidebar trigger + title */}
        <div className="md:hidden flex items-center justify-between mb-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300"
          >
            <Settings className="w-3.5 h-3.5" />
            Bereich
            <ChevronRight className="w-3 h-3" />
          </button>
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold">Admin</span>
          </div>
        </div>

        <div className="flex gap-4">
          {/* ─── Sidebar (desktop) ─────────────────── */}
          <aside className="hidden md:block w-52 shrink-0">
            <AdminSidebarNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              counters={{ customers: customers.length, products: produkte.length, openTickets: openTicketsCount }}
            />
          </aside>

          {/* ─── Main content ─────────────────────── */}
          <main className="flex-1 min-w-0 space-y-3">
            {/* Desktop title row */}
            <div className="hidden md:flex items-center justify-between">
              <div>
                <h1 className="text-base font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  Admin Panel
                </h1>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Vollkontrolle über Kunden, Inhalte & System
                </p>
              </div>
            </div>

            {error && <div className="flex items-center gap-2 text-red-400 text-xs glass border border-red-500/20 px-3 py-2 rounded-lg"><AlertCircle className="w-3.5 h-3.5 shrink-0" /><span className="flex-1">{error}</span><button onClick={() => setError("")}><X className="w-3 h-3" /></button></div>}
            {success && <div className="flex items-center gap-2 text-emerald-400 text-xs glass border border-emerald-500/20 px-3 py-2 rounded-lg"><Check className="w-3.5 h-3.5 shrink-0" /><span>{success}</span></div>}

            {/* ─── Dashboard ──────────────────────── */}
            {activeTab === "dashboard" && (
              <AdminErrorBoundary label="Dashboard">
                <DashboardView
                  stats={stats}
                  loading={statsLoading}
                  onJumpToCustomer={(k) => { setActiveCustomerKey(k); setActiveTab("customers"); }}
                  autoRefresh={dashAutoRefresh}
                  setAutoRefresh={setDashAutoRefresh}
                  onJumpTab={(t) => setActiveTab(t)}
                  onRefresh={() => { loadStats(); loadApiBalances(); }}
                  apiBalances={apiBalances}
                  apiBalancesLoading={apiBalancesLoading}
                  onRefreshBalances={loadApiBalances}
                />
              </AdminErrorBoundary>
            )}

            {/* ─── Statistiken ────────────────────── */}
            {activeTab === "stats" && (
              <AdminErrorBoundary label="Statistiken">
                <StatsView stats={stats} loading={statsLoading} />
              </AdminErrorBoundary>
            )}

            {/* ─── Aktivität ──────────────────────── */}
            {activeTab === "activity" && (
              <AdminErrorBoundary label="Aktivität">
                <ActivityView
                  entries={activity}
                  loading={activityLoading}
                  filter={activityFilter}
                  setFilter={setActivityFilter}
                  onJumpToCustomer={(k) => { setActiveCustomerKey(k); setActiveTab("customers"); }}
                  onRefresh={loadActivity}
                  onExportCsv={exportActivityCsv}
                />
              </AdminErrorBoundary>
            )}

            {/* ─── News (Admin News-CRUD) ────────── */}
            {activeTab === "news" && (
              <AdminErrorBoundary label="News">
                <NewsAdminView posts={newsPosts} loading={newsLoading} onRefresh={loadNews} />
              </AdminErrorBoundary>
            )}

            {/* ─── System Status ─────────────────── */}
            {activeTab === "system" && (
              <AdminErrorBoundary label="System-Status">
                <SystemStatusView
                  status={systemStatus}
                  loading={systemStatusLoading}
                  onRefresh={loadSystemStatus}
                  apiBalances={apiBalances}
                  apiBalancesLoading={apiBalancesLoading}
                  onRefreshBalances={loadApiBalances}
                />
              </AdminErrorBoundary>
            )}

            {activeTab === "survey" && (
              <AdminErrorBoundary label="Umfragen">
                <SurveyAdminView />
              </AdminErrorBoundary>
            )}

            {/* ─── Users (Rollen + Tier + Impersonate) ──────────── */}
            {activeTab === "users" && (
              <AdminErrorBoundary label="User & Rollen">
                <UsersView
                  users={users}
                  loading={usersLoading}
                  search={userSearch}
                  setSearch={setUserSearch}
                  busyKey={userBusyKey}
                  tierConfig={tierConfig}
                  autoRefresh={usersAutoRefresh}
                  setAutoRefresh={setUsersAutoRefresh}
                  onRefresh={loadUsers}
                  onSetRole={handleSetRole}
                  onSetTier={handleSetTier}
                  onCancelTier={handleCancelTier}
                  onImpersonate={handleImpersonate}
                  onAdjustCredits={handleQuickAdjustCredits}
                />
              </AdminErrorBoundary>
            )}

            {/* ─── Abo-Modelle (Tier-Editor) ─────────────────────── */}
            {activeTab === "tiers" && (
              <AdminErrorBoundary label="Abo-Modelle">
                <TiersFullEditor
                  tiers={tierConfig}
                  loading={tierConfigLoading}
                  saving={tierConfigSaving}
                  onSave={saveTierConfig}
                />
              </AdminErrorBoundary>
            )}

            {/* ─── System-Logs ───────────────────────────────────── */}
            {activeTab === "logs" && (
              <AdminErrorBoundary label="System-Logs">
                <LogsView
                  entries={logs}
                  loading={logsLoading}
                  filter={logFilter}
                  setFilter={setLogFilter}
                  onRefresh={loadLogs}
                />
              </AdminErrorBoundary>
            )}

        {/* ─── Customers Tab ─────────────────────────────────── */}
        {activeTab === "customers" && (
          <AdminErrorBoundary label="Kunden">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {/* Search + KPI strip */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Suche: License, E-Mail, Shop, Bestellnr…"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600"
                />
              </div>
              <button
                onClick={loadCustomers}
                disabled={customersLoading}
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
              >
                {customersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Aktualisieren</span>
              </button>
              <button
                onClick={handleEnsureStarter}
                disabled={ensuringStarter}
                title="Allen Kunden ohne Welcome-Bonus die 500 Starter-Credits sicherstellen (idempotent)"
                className="px-3 py-2 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/30 text-xs text-[#95BF47] hover:bg-[#95BF47]/15 transition flex items-center gap-1.5 font-semibold"
              >
                {ensuringStarter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">500 Starter sicherstellen</span>
                <span className="sm:hidden">+500</span>
              </button>
              <button
                onClick={exportCustomersCsv}
                disabled={customers.length === 0}
                title="Alle Kunden als CSV exportieren"
                className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            </div>

            {/* KPI summary */}
            {customers.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <KpiTile label="Kunden" value={String(customers.length)} icon={Users} color="#3B82F6" />
                <KpiTile
                  label="Σ Balance"
                  value={customers.reduce((s, c) => s + c.credits.balance, 0).toLocaleString("de-DE")}
                  icon={Coins}
                  color="#95BF47"
                />
                <KpiTile
                  label="Σ Verbraucht"
                  value={customers.reduce((s, c) => s + c.credits.totalUsed, 0).toLocaleString("de-DE")}
                  icon={TrendingDown}
                  color="#EF4444"
                />
              </div>
            )}

            {/* List */}
            <div className="space-y-1.5">
              {customers
                .filter((c) => {
                  const q = customerSearch.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    c.lizenzschluessel.toLowerCase().includes(q) ||
                    c.kundenEmail.toLowerCase().includes(q) ||
                    c.shopDomain.toLowerCase().includes(q) ||
                    c.bestellnummer.toLowerCase().includes(q) ||
                    c.sku.toLowerCase().includes(q)
                  );
                })
                .map((c) => {
                  const isLow = c.credits.balance < 20;
                  const isEmpty = c.credits.balance <= 0;
                  return (
                    <button
                      key={c.lizenzschluessel}
                      onClick={() => setActiveCustomerKey(c.lizenzschluessel)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/15 transition text-left"
                    >
                      {/* Status icon */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          background: c.hasShopifyToken ? "rgba(149,191,71,0.15)" : "rgba(245,158,11,0.10)",
                          borderColor: c.hasShopifyToken ? "rgba(149,191,71,0.30)" : "rgba(245,158,11,0.25)",
                        }}
                      >
                        <Store className="w-3.5 h-3.5" style={{ color: c.hasShopifyToken ? "#95BF47" : "#F59E0B" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold truncate">
                          {c.kundenEmail || c.lizenzschluessel}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1.5">
                          <span className="font-mono">{c.lizenzschluessel.slice(0, 12)}…</span>
                          {c.shopDomain && (<><span>·</span><span className="truncate">{c.shopDomain}</span></>)}
                          {c.sku && (<><span>·</span><span>{c.sku}</span></>)}
                        </div>
                      </div>
                      {/* Indicators */}
                      <div className="hidden sm:flex items-center gap-1">
                        <Indicator on={c.hasShopifyToken} icon={Store} title="Shop" />
                        <Indicator on={c.hasGoogleLinked} icon={Mail} title="Google" />
                        <Indicator on={c.hasLegalData} icon={FileText} title="Legal" />
                        <Indicator on={c.hasBrandKit} icon={Palette} title="Brand" />
                      </div>
                      {/* Balance */}
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-bold tabular-nums ${
                          isEmpty ? "text-red-400" : isLow ? "text-amber-400" : "text-[#95BF47]"
                        }`}>
                          {c.credits.balance}
                        </div>
                        <div className="text-[9px] text-zinc-600 leading-tight">
                          {c.credits.totalUsed} verbr.
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                    </button>
                  );
                })}
              {customers.length === 0 && !customersLoading && (
                <div className="text-center py-10 text-sm text-zinc-500">Keine Kunden vorhanden.</div>
              )}
            </div>
          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* ─── Lizenzen Tab ─────────────────────────────────── */}
        {activeTab === "licenses" && (
          <AdminErrorBoundary label="Lizenzen">
            <LicensesView
              customers={customers}
              loading={customersLoading}
              onRefresh={loadCustomers}
              onOpenCustomer={(key) => setActiveCustomerKey(key)}
            />
          </AdminErrorBoundary>
        )}

        {/* ─── Credits Tab (Preise, Icon, Gewinn pro Nutzung) ──── */}
        {activeTab === "credits" && (
          <AdminErrorBoundary label="Credits">
            <CreditsAdminView
              config={creditConfig}
              loading={creditConfigLoading}
              saving={creditConfigSaving}
              onSave={saveCreditConfig}
              onRefresh={loadCreditConfig}
            />
          </AdminErrorBoundary>
        )}

        {/* ─── Customer Detail Modal ────────────────────────── */}
        <AnimatePresence>
          {activeCustomerKey && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCustomerKey(null)}
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:px-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0c0c0c] border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
                  <button
                    onClick={() => setActiveCustomerKey(null)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.05] transition"
                  >
                    <X className="w-4 h-4 text-zinc-500" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">
                      {customerDetail?.kundenEmail || customerDetail?.lizenzschluessel || "Kunde"}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">
                      {activeCustomerKey}
                    </div>
                  </div>
                </div>

                {customerDetailLoading ? (
                  <div className="flex-1 flex items-center justify-center py-14">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                  </div>
                ) : customerDetail ? (
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {/* Credit summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <KpiTile label="Balance" value={String(customerDetail.credits.balance)} icon={Coins} color="#95BF47" />
                      <KpiTile label="Σ Gekauft" value={String(customerDetail.credits.totalPurchased)} icon={ArrowUpCircle} color="#10B981" />
                      <KpiTile label="Σ Verbr." value={String(customerDetail.credits.totalUsed)} icon={ArrowDownCircle} color="#EF4444" />
                    </div>

                    {/* Status row */}
                    <div className="flex flex-wrap gap-1.5">
                      <StatusChip on={customerDetail.hasShopifyToken} label="Shop verbunden" />
                      <StatusChip on={customerDetail.credits.starterGranted} label={`Starter${customerDetail.credits.starterGranted ? " ✓" : " (offen)"}`} />
                      <StatusChip on={customerDetail.hasGoogleLinked} label={`Google${customerDetail.hasGoogleLinked ? " ✓" : ""}`} />
                      <StatusChip on={customerDetail.hasLegalData} label={`Firmendaten${customerDetail.hasLegalData ? " ✓" : ""}`} />
                      <StatusChip on={customerDetail.hasBrandKit} label={`Brand-Kit${customerDetail.hasBrandKit ? " ✓" : ""}`} />
                    </div>

                    {/* ─── Exact credit balance setter (overwrite) ─── */}
                    <ExactCreditsSetter
                      currentBalance={customerDetail.credits.balance}
                      saving={customerActionSaving}
                      onSet={(target) => handleCustomerAction("set-credits", { balance: target })}
                    />

                    {/* ─── Quick credit packs ─── */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                        Quick-Pack vergeben
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[50, 100, 500, 1000, 2500].map((amount) => (
                          <button
                            key={amount}
                            onClick={async () => {
                              setAdjustSaving(true);
                              try {
                                await fetch("/api/admin/customers", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ key: activeCustomerKey, delta: amount, note: `Quick-Pack +${amount}` }),
                                });
                                await loadCustomerDetail(activeCustomerKey!);
                                await loadCustomers();
                                setSuccess(`+${amount} Credits gutgeschrieben.`);
                                setTimeout(() => setSuccess(""), 2500);
                              } catch { setError("Fehler."); }
                              finally { setAdjustSaving(false); }
                            }}
                            disabled={adjustSaving}
                            className="px-2.5 py-1.5 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/30 text-[#95BF47] text-xs font-bold hover:bg-[#95BF47]/15 transition disabled:opacity-50 tabular-nums"
                          >
                            +{amount}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ─── Manual adjust form ─── */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                        Manuelle Anpassung
                      </div>
                      <div className="flex flex-col sm:flex-row gap-1.5">
                        <input
                          type="number"
                          value={adjustForm.delta || ""}
                          onChange={(e) => setAdjustForm((p) => ({ ...p, delta: Number(e.target.value) || 0 }))}
                          placeholder="±Credits (z.B. 100 oder -50)"
                          className="flex-1 sm:max-w-[160px] bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600 font-mono"
                        />
                        <input
                          type="text"
                          value={adjustForm.note}
                          onChange={(e) => setAdjustForm((p) => ({ ...p, note: e.target.value }))}
                          placeholder="Notiz (z.B. Goodwill, Refund …)"
                          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600"
                        />
                        <button
                          onClick={handleAdjust}
                          disabled={adjustSaving || !adjustForm.delta}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-40 ${
                            adjustForm.delta >= 0
                              ? "bg-[#95BF47] text-black"
                              : "bg-red-500/15 border border-red-500/30 text-red-300"
                          }`}
                        >
                          {adjustSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Anwenden"}
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-2">
                        Positive = Gutschrift, negative = Abzug. Mit Admin-Email als Audit-Trail geloggt.
                      </p>
                    </div>

                    {/* ─── Account moderation ─── */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                        Account-Moderation
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          onClick={() => handleCustomerAction("set-vip", { vip: !customerDetail.profile.vip })}
                          disabled={customerActionSaving}
                          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                            customerDetail.profile.vip
                              ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                              : "bg-white/[0.04] border border-white/10 text-zinc-300"
                          }`}
                        >
                          <Gem className="w-3.5 h-3.5" />
                          {customerDetail.profile.vip ? "VIP ✓" : "VIP setzen"}
                        </button>
                        <button
                          onClick={() => handleCustomerAction("set-blocked", { blocked: !customerDetail.profile.blocked })}
                          disabled={customerActionSaving}
                          className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                            customerDetail.profile.blocked
                              ? "bg-red-500/15 border border-red-500/30 text-red-300"
                              : "bg-white/[0.04] border border-white/10 text-zinc-300"
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          {customerDetail.profile.blocked ? "Entsperren" : "Sperren"}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("500 Starter-Credits NEU vergeben? Bestehende Balance bleibt, +500 werden draufgeschlagen.")) {
                              handleCustomerAction("reset-starter");
                            }
                          }}
                          disabled={customerActionSaving}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-500/15 transition disabled:opacity-50"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          Starter neu
                        </button>
                        <button
                          onClick={() => loadCustomerDetail(activeCustomerKey!)}
                          disabled={customerActionSaving}
                          className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-zinc-300 text-xs font-semibold hover:bg-white/[0.08] transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Refresh
                        </button>
                      </div>

                      {/* Admin note */}
                      <AdminNoteEditor
                        initial={customerDetail.profile.adminNote || ""}
                        saving={customerActionSaving}
                        onSave={(note) => handleCustomerAction("set-note", { note })}
                      />
                    </div>

                    {/* Transaction log */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                          Transaktionen ({customerDetail.log.length})
                        </div>
                        <span className="text-[9px] text-zinc-600">Neueste oben</span>
                      </div>
                      {customerDetail.log.length === 0 ? (
                        <div className="text-xs text-zinc-500 text-center py-4">Noch keine Transaktionen.</div>
                      ) : (
                        <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                          {customerDetail.log.map((entry, i) => (
                            <LogRow key={i} entry={entry} />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Profile fields */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-2">
                        Profil-Details
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                        <ProfileRow label="License" value={customerDetail.lizenzschluessel} mono />
                        <ProfileRow label="SKU" value={customerDetail.sku || "—"} />
                        <ProfileRow label="Status" value={customerDetail.status || "—"} />
                        <ProfileRow label="Bestellnr." value={customerDetail.bestellnummer || "—"} mono />
                        <ProfileRow label="E-Mail" value={customerDetail.kundenEmail || "—"} />
                        <ProfileRow label="Google" value={customerDetail.profile.linkedGoogleEmail || "—"} />
                        <ProfileRow label="Shop" value={customerDetail.shopDomain || "—"} />
                        <ProfileRow label="Firma" value={customerDetail.profile.legal_data?.firmenname || "—"} />
                      </div>
                    </div>

                    {/* Fulfilled orders + voucher codes */}
                    {(customerDetail.fulfilledOrders.length > 0 || Object.keys(customerDetail.redeemedCodes).length > 0) && (
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                        <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500">
                          Käufe & Codes
                        </div>
                        {customerDetail.fulfilledOrders.length > 0 && (
                          <div>
                            <div className="text-[10px] text-zinc-500 mb-1">Erfüllte Shopify-Orders ({customerDetail.fulfilledOrders.length}):</div>
                            <div className="flex flex-wrap gap-1">
                              {customerDetail.fulfilledOrders.map((o) => (
                                <span key={o} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                  {o}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {Object.keys(customerDetail.redeemedCodes).length > 0 && (
                          <div>
                            <div className="text-[10px] text-zinc-500 mb-1">Eingelöste Voucher:</div>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(customerDetail.redeemedCodes).map(([code, count]) => (
                                <span key={code} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300">
                                  {code} × {count}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-14 text-sm text-zinc-500">
                    Detail konnte nicht geladen werden.
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Knowledge Base Tab */}
        {activeTab === "knowledge" && (
          <AdminErrorBoundary label="KI-Wissen">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <div className="glass-strong rounded-2xl border border-purple-500/15 p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-purple-500/15 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">AI Firmenwissen</h3>
                  <p className="text-xs text-zinc-500">Dieser Text wird als System-Prompt an den DeepSeek KI-Agenten gesendet.</p>
                </div>
              </div>
              {kbLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
              ) : (
                <>
                  <textarea
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    rows={14}
                    placeholder={"Hier dein Firmenwissen eingeben...\n\nBeispiel:\n- Wir bieten Managed Dropshipping an\n- Unser Service kostet 299\u20AC/Monat\n- Versand dauert 7-14 Werktage\n- Support per Ticket oder Chat\n- Wir nutzen AliExpress als Supplier\n- Kunden bekommen einen eigenen Shopify-Store"}
                    className="input-glass w-full resize-none text-sm leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">{kbContent.length} Zeichen</span>
                    <button onClick={saveKnowledgeBase} disabled={kbSaving} className="btn-accent px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
                      {kbSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Firmenwissen speichern</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* Tickets Tab */}
        {activeTab === "tickets" && (
          <AdminErrorBoundary label="Tickets">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
            ) : adminTickets.length === 0 ? (
              <div className="text-center py-20">
                <Shield className="w-12 h-12 text-zinc-800 mx-auto mb-3" />
                <p className="text-zinc-500">Keine Tickets vorhanden.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Ticket List */}
                <div className="lg:col-span-1 space-y-2">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-2">
                    {adminTickets.length} Tickets
                  </div>
                  {adminTickets.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTicket(t.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedTicket === t.id
                          ? "border-amber-500/20 bg-amber-500/8"
                          : "border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${
                          t.status === "open" ? "bg-amber-400" : t.status === "resolved" ? "bg-emerald-400" : "bg-zinc-500"
                        }`} />
                        <span className="text-sm font-medium text-zinc-200 truncate flex-1">{t.subject}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{t.customerName}</span>
                        <span>&middot;</span>
                        <span>{new Date(t.updatedAt).toLocaleDateString("de-DE")}</span>
                        <span>&middot;</span>
                        <span>{t.messages.length} Nachr.</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Ticket Detail */}
                <div className="lg:col-span-2">
                  {selectedTicket ? (() => {
                    const t = adminTickets.find(x => x.id === selectedTicket);
                    if (!t) return null;
                    return (
                      <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-white/[0.06]">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-bold text-sm">{t.subject}</h4>
                              <p className="text-[11px] text-zinc-500 mt-0.5">{t.customerName} &middot; {t.id.slice(-8)}</p>
                            </div>
                            <div className="flex gap-2">
                              {t.status === "open" && (
                                <>
                                  <button onClick={() => handleTicketStatus(t.id, "resolved")} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition">
                                    Als gelöst markieren
                                  </button>
                                  <button onClick={() => handleTicketStatus(t.id, "closed")} className="px-3 py-1.5 rounded-lg bg-zinc-500/10 border border-zinc-500/15 text-zinc-400 text-[11px] font-semibold hover:bg-zinc-500/20 transition">
                                    Schließen
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Messages */}
                        <div className="p-4 space-y-3 max-h-[50vh] overflow-y-auto">
                          {t.messages.map((msg, i) => (
                            <div key={i} className={`flex gap-2.5 ${msg.sender === "admin" ? "flex-row-reverse" : ""}`}>
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                msg.sender === "admin" ? "bg-[#95BF47]/15 text-[#95BF47]" :
                                msg.sender === "ai" ? "bg-purple-500/15 text-purple-400" :
                                "bg-blue-500/15 text-blue-400"
                              }`}>
                                {msg.sender === "admin" ? "A" : msg.sender === "ai" ? "KI" : "K"}
                              </div>
                              <div className={`max-w-[75%] rounded-xl px-3 py-2 ${
                                msg.sender === "admin" ? "bg-[#95BF47]/8 border border-[#95BF47]/10" :
                                msg.sender === "ai" ? "bg-purple-500/8 border border-purple-500/10" :
                                "bg-white/[0.03] border border-white/[0.06]"
                              }`}>
                                <div className="text-[9px] text-zinc-500 mb-0.5">{msg.name}</div>
                                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                <div className="text-[8px] text-zinc-600 mt-1">{new Date(msg.timestamp).toLocaleString("de-DE")}</div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Reply */}
                        {t.status === "open" && (
                          <div className="p-4 border-t border-white/[0.06]">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={ticketReply}
                                onChange={(e) => setTicketReply(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleTicketReply(t.id)}
                                placeholder="Antwort schreiben..."
                                className="flex-1 input-glass text-sm"
                              />
                              <button
                                onClick={() => handleTicketReply(t.id)}
                                disabled={ticketReplying || !ticketReply.trim()}
                                className="btn-accent px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40"
                              >
                                {ticketReplying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Senden"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
                      Ticket auswählen, um Details zu sehen
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <AdminErrorBoundary label="Settings">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
            {/* Logo Upload */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#95BF47]" />Firmenlogo &amp; Brand-Name (White-Label)</h3>
              <p className="text-zinc-400 text-xs">Logo + Markenname ersetzen das Standard-„BrospifyHub" auf allen Seiten (Login, Navigation, Header).</p>

              {/* Brand Name */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Markenname (Text-Fallback wenn kein Logo)</label>
                <input
                  type="text"
                  value={settingsData.brandName}
                  onChange={e => setSettingsData({ ...settingsData, brandName: e.target.value })}
                  placeholder="z.B. MeinShop, Brand X — leer lassen für Standard"
                  className="input-glass w-full"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Erscheint nur im Header wenn kein Logo gesetzt ist. Auf der Login-Seite wird er auch als Titel genutzt.</p>
              </div>

              <div className="border-t border-white/[0.06] pt-4 -mx-6 px-6 -mb-2">
                <p className="text-xs text-zinc-400 mb-3 font-semibold">Logo-Upload</p>
              </div>

              {/* File Upload — uploads AND saves in one step */}
              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 text-[#95BF47] text-sm font-medium transition ${logoBusy ? "opacity-60 cursor-wait pointer-events-none" : "cursor-pointer hover:bg-[#95BF47]/15"}`}>
                  <Upload className="w-4 h-4" />
                  {logoBusy ? "Wird gespeichert…" : "Logo hochladen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={logoBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadLogo(file);
                    }}
                  />
                </label>
                {settingsData.logoUrl && (
                  <button
                    onClick={() => commitLogoUrl("")}
                    disabled={logoBusy}
                    className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 -mt-1">Wird sofort gespeichert &amp; überall übernommen — kein extra Klick auf „Speichern" nötig. Große Bilder werden automatisch verkleinert.</p>

              {/* URL fallback — persists when you leave the field */}
              <input
                type="text"
                value={settingsData.logoUrl}
                onChange={e => setSettingsData({ ...settingsData, logoUrl: e.target.value })}
                onBlur={e => commitLogoUrl(e.target.value)}
                disabled={logoBusy}
                placeholder="Oder Logo-URL direkt eingeben (speichert beim Verlassen des Feldes)…"
                className="input-glass w-full text-xs disabled:opacity-50"
              />

              {/* Preview */}
              {settingsData.logoUrl && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Vorschau</p>
                  <img src={settingsData.logoUrl} alt="Logo" className="h-14 object-contain rounded" />
                </div>
              )}
            </div>

            {/* Abo-Bild für die Login-Seite */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Crown className="w-5 h-5 text-[#95BF47]" />Abo-Bild (Login-Seite)</h3>
              <p className="text-zinc-400 text-sm">Wird im „Membership abschließen"-Bereich auf der Login-Seite angezeigt. Empfohlen: Querformat (z.B. 1200×600).</p>

              <div className="flex items-center gap-3">
                <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 text-[#95BF47] text-sm font-medium transition ${aboBusy ? "opacity-60 cursor-wait pointer-events-none" : "cursor-pointer hover:bg-[#95BF47]/15"}`}>
                  <Upload className="w-4 h-4" />
                  {aboBusy ? "Wird gespeichert…" : "Abo-Bild hochladen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={aboBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadAboImage(file);
                    }}
                  />
                </label>
                {settingsData.aboImageUrl && (
                  <button
                    onClick={() => commitAboImageUrl("")}
                    disabled={aboBusy}
                    className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 -mt-1">Wird sofort gespeichert &amp; auf der Login-Seite übernommen — max. 5MB.</p>

              <input
                type="text"
                value={settingsData.aboImageUrl}
                onChange={e => setSettingsData({ ...settingsData, aboImageUrl: e.target.value })}
                onBlur={e => commitAboImageUrl(e.target.value)}
                disabled={aboBusy}
                placeholder="Oder Bild-URL direkt eingeben (speichert beim Verlassen des Feldes)…"
                className="input-glass w-full text-xs disabled:opacity-50"
              />

              {settingsData.aboImageUrl && (
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-wider">Vorschau</p>
                  <img src={settingsData.aboImageUrl} alt="Abo-Bild" className="w-full max-h-44 object-cover rounded-lg" />
                </div>
              )}
            </div>

            {/* Favicon (Browser-Tab-Icon) — Drag & Drop */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-[#95BF47]" />Favicon (Browser-Tab)</h3>
              <p className="text-zinc-400 text-sm">Das kleine Icon im Browser-Tab und in Lesezeichen. Empfohlen: quadratisch, PNG/SVG/ICO (z.B. 512×512). Wird sofort gespeichert.</p>

              <div
                onDragOver={(e) => { e.preventDefault(); if (!faviconBusy) setFaviconDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setFaviconDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setFaviconDragging(false);
                  if (faviconBusy) return;
                  const file = e.dataTransfer.files?.[0];
                  if (file) uploadFavicon(file);
                }}
                className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition ${
                  faviconDragging
                    ? "border-[#95BF47] bg-[#95BF47]/10"
                    : "border-white/15 bg-white/[0.02] hover:border-white/25"
                } ${faviconBusy ? "opacity-60 pointer-events-none" : ""}`}
              >
                <div className="flex items-center justify-center gap-4">
                  {settingsData.faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settingsData.faviconUrl} alt="Favicon" className="w-12 h-12 object-contain rounded-lg bg-white/5 border border-white/10 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-zinc-600" />
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-zinc-200">
                      {faviconBusy ? "Wird hochgeladen…" : faviconDragging ? "Datei hier ablegen" : "Bild hierher ziehen & ablegen"}
                    </p>
                    <label className={`mt-1 inline-flex items-center gap-1.5 text-xs text-[#95BF47] ${faviconBusy ? "cursor-wait" : "cursor-pointer hover:underline"}`}>
                      <Upload className="w-3.5 h-3.5" />
                      oder Datei auswählen
                      <input
                        type="file"
                        accept="image/*,.ico"
                        className="hidden"
                        disabled={faviconBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) uploadFavicon(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={settingsData.faviconUrl}
                  onChange={e => setSettingsData({ ...settingsData, faviconUrl: e.target.value })}
                  onBlur={e => commitFaviconUrl(e.target.value)}
                  disabled={faviconBusy}
                  placeholder="Oder Bild-URL direkt eingeben (speichert beim Verlassen)…"
                  className="input-glass w-full text-xs disabled:opacity-50"
                />
                {settingsData.faviconUrl && (
                  <button
                    onClick={() => commitFaviconUrl("")}
                    disabled={faviconBusy}
                    className="shrink-0 text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <p className="text-[10px] text-zinc-500 -mt-1">Hinweis: Browser cachen Favicons aggressiv — nach dem Speichern ggf. Tab neu laden oder Hard-Refresh, bis das neue Icon erscheint.</p>
            </div>

            {/* YouTube */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Video className="w-5 h-5 text-red-400" />YouTube Anleitungs-URL</h3>
              <p className="text-zinc-400 text-sm">Wird auf der Setup-Seite als Video-Tutorial eingebettet.</p>
              <input type="text" value={settingsData.youtubeUrl} onChange={e => setSettingsData({ ...settingsData, youtubeUrl: e.target.value })} placeholder="https://youtube.com/watch?v=..." className="input-glass w-full" />
            </div>

            {/* Themes-Verwaltung in eigenen Tab verschoben */}
            <div className="glass-strong rounded-2xl border border-purple-500/20 p-5 space-y-2 bg-purple-500/[0.03]">
              <h3 className="font-semibold flex items-center gap-2 text-sm"><Palette className="w-4 h-4 text-purple-400" />Themes verwalten</h3>
              <p className="text-zinc-400 text-xs">
                Theme-Vorlagen, Preise, Vorschau-Videos und Tier-Berechtigungen findest du jetzt im eigenen Tab <span className="text-purple-300 font-semibold">„Themes"</span> in der Sidebar.
              </p>
              <button
                onClick={() => setActiveTab("themes")}
                className="btn-accent px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Palette className="w-3.5 h-3.5" /> Zum Themes-Tab
              </button>
            </div>

            {/* Brand Kit */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Gem className="w-5 h-5 text-amber-400" />Brand-Kit</h3>
              <p className="text-zinc-400 text-sm">Definiere deine Markenidentität. Diese Werte werden beim Theme-Push automatisch übernommen.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Primärfarbe</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={settingsData.brandPrimary || "#000000"} onChange={e => setSettingsData({...settingsData, brandPrimary: e.target.value})} className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent" />
                    <input type="text" value={settingsData.brandPrimary} onChange={e => setSettingsData({...settingsData, brandPrimary: e.target.value})} placeholder="#000000" className="input-glass flex-1" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Akzentfarbe</label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={settingsData.brandAccent || "#95BF47"} onChange={e => setSettingsData({...settingsData, brandAccent: e.target.value})} className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent" />
                    <input type="text" value={settingsData.brandAccent} onChange={e => setSettingsData({...settingsData, brandAccent: e.target.value})} placeholder="#95BF47" className="input-glass flex-1" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Typografie</label>
                <select value={settingsData.typography} onChange={e => setSettingsData({...settingsData, typography: e.target.value})} className="input-glass w-full">
                  <option value="Inter">Inter</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Playfair Display">Playfair Display</option>
                  <option value="Roboto">Roboto</option>
                  <option value="Open Sans">Open Sans</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Lato">Lato</option>
                </select>
              </div>
            </div>

            {/* Tone of Voice */}
            <div className="glass-strong rounded-2xl border border-white/10 p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2"><Zap className="w-5 h-5 text-purple-400" />Tone of Voice (KI-Anweisung)</h3>
              <p className="text-zinc-400 text-sm">Beschreibe den Tonfall für KI-generierte Produkttexte. Z.B. &quot;Locker, modern, Gen-Z, mit Emojis&quot;</p>
              <textarea value={settingsData.toneOfVoice} onChange={e => setSettingsData({...settingsData, toneOfVoice: e.target.value})} rows={3} placeholder="z.B. Professionell aber locker, deutsche Sprache, Vertrauen aufbauen, Emojis sparsam einsetzen..." className="input-glass w-full resize-none" />
            </div>

            <button onClick={saveSettings} disabled={settingsLoading} className="btn-accent px-6 py-3 rounded-xl font-semibold flex items-center gap-2">
              {settingsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Einstellungen speichern</>}
            </button>

          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* Themes Tab — dedicated admin area for theme templates */}
        {activeTab === "themes" && (
          <AdminErrorBoundary label="Themes">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-6xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-purple-400" />
                  Theme-Vorlagen
                </h2>
                <p className="text-zinc-400 text-xs mt-1 max-w-2xl leading-relaxed">
                  Lege Themes an, lade ZIPs + Vorschau-Bilder/Videos hoch, setze Preise und entscheide, welche Abos welche Themes nutzen dürfen. Inaktive Themes sind in der Kunden-Galerie nicht sichtbar.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={addNewTheme}
                  className="btn-accent px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Theme hinzufügen
                </button>
                <button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border border-[#95BF47]/40 bg-[#95BF47]/10 text-[#95BF47] hover:bg-[#95BF47]/20 transition disabled:opacity-50"
                >
                  {settingsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Speichern</>}
                </button>
              </div>
            </div>

            {/* Empty state */}
            {settingsData.themes.length === 0 && (
              <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-white/10 rounded-xl">
                Noch keine Themes. Klicke oben rechts auf <span className="text-purple-300 font-semibold">Theme hinzufügen</span>.
              </div>
            )}

            {/* Theme cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settingsData.themes.map((t) => {
                const tierAccess = Array.isArray(t.tierAccess) ? t.tierAccess : [];
                const isActive = t.active !== false;
                const toggleTierAccess = (k: AdminTierKey) => {
                  const has = tierAccess.includes(k);
                  const next = has ? tierAccess.filter(x => x !== k) : [...tierAccess, k];
                  updateTheme(t.id, { tierAccess: next });
                };
                return (
                <div key={t.id} className={`rounded-xl border bg-white/[0.02] p-4 space-y-3 ${isActive ? "border-white/10" : "border-red-500/20 opacity-70"}`}>
                  {/* Preview image */}
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/10">
                    {t.previewImageUrl ? (
                      <img src={t.previewImageUrl} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-xs gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span>Kein Vorschaubild</span>
                      </div>
                    )}
                    <label className="absolute bottom-2 right-2 cursor-pointer">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-black/70 backdrop-blur border border-white/20 rounded-lg text-[11px] font-semibold hover:bg-black/90 transition">
                        {themePreviewBusyId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                        Vorschau
                      </span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadThemePreview(t.id, e.target.files[0])} />
                    </label>
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <button
                        onClick={() => updateTheme(t.id, { active: !isActive })}
                        title={isActive ? "Theme deaktivieren" : "Theme aktivieren"}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                          isActive
                            ? "bg-emerald-500/80 border-emerald-400 text-white"
                            : "bg-zinc-700/80 border-zinc-600 text-zinc-200"
                        }`}
                      >
                        {isActive ? "Aktiv" : "Inaktiv"}
                      </button>
                    </div>
                    <button
                      onClick={() => removeTheme(t.id)}
                      title="Theme entfernen"
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500/80 hover:bg-red-500 border border-red-400 rounded-lg flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>

                  {/* Title + Version */}
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={t.name}
                      onChange={e => updateTheme(t.id, { name: e.target.value })}
                      placeholder="Titel"
                      className="input-glass col-span-2 w-full text-sm font-semibold"
                    />
                    <input
                      type="text"
                      value={t.version || ""}
                      onChange={e => updateTheme(t.id, { version: e.target.value })}
                      placeholder="v1.0"
                      className="input-glass w-full text-sm tabular-nums"
                    />
                  </div>

                  {/* Description */}
                  <textarea
                    value={t.description || ""}
                    onChange={e => updateTheme(t.id, { description: e.target.value })}
                    rows={2}
                    placeholder="Beschreibung (z.B. Conversion-optimiert für Mode-Brands)"
                    className="input-glass w-full text-xs resize-none"
                  />

                  {/* ZIP upload */}
                  <div className="flex gap-2 items-center">
                    <label className="flex-1 cursor-pointer">
                      <span className="flex items-center justify-center gap-2 px-3 py-2 glass hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition">
                        {themeBusyId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {t.fileUrl ? "Theme-ZIP ersetzen" : "Theme-ZIP hochladen"}
                      </span>
                      <input type="file" accept=".zip" className="hidden" onChange={e => e.target.files?.[0] && uploadThemeZip(t.id, e.target.files[0])} />
                    </label>
                    {t.fileUrl && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0">
                        <Check className="w-3 h-3" />
                        {t.fileName ? t.fileName.slice(0, 18) + (t.fileName.length > 18 ? "…" : "") : "Hochgeladen"}
                      </span>
                    )}
                  </div>

                  {/* Direct URL */}
                  <input
                    type="text"
                    value={t.fileUrl}
                    onChange={e => updateTheme(t.id, { fileUrl: e.target.value })}
                    placeholder="Oder direkte ZIP-URL"
                    className="input-glass w-full text-[10px] font-mono"
                  />

                  {/* Preview Video — YouTube or upload URL */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Vorschau-Video</label>
                    <input
                      type="text"
                      value={t.previewVideoUrl || ""}
                      onChange={e => updateTheme(t.id, { previewVideoUrl: e.target.value })}
                      placeholder="YouTube-Link oder MP4-URL"
                      className="input-glass w-full text-[11px] font-mono"
                    />
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Einmalkauf-Preis</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={Number.isFinite(t.priceEur) ? (t.priceEur as number) : 0}
                        onChange={e => updateTheme(t.id, { priceEur: Math.max(0, Number(e.target.value) || 0) })}
                        className="input-glass w-24 text-sm tabular-nums"
                      />
                      <span className="text-zinc-400 text-xs">€</span>
                      <span className="text-zinc-600 text-[10px] ml-2">
                        ≈ {Math.round((Number(t.priceEur) || 0) * 50)} Credits
                      </span>
                    </div>
                  </div>

                  {/* Tier access toggles */}
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">
                      Zugriff über Abo
                    </label>
                    <div className="flex gap-1.5 flex-wrap">
                      {(["pro"] as const).map((k) => {
                        const on = tierAccess.includes(k);
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => toggleTierAccess(k)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition ${
                              on
                                ? "bg-[#95BF47]/15 border-[#95BF47]/40 text-[#95BF47]"
                                : "bg-white/[0.02] border-white/10 text-zinc-500 hover:text-zinc-300"
                            }`}
                            style={on ? { boxShadow: `0 0 0 1px ${TIER_COLORS[k]}30` } : undefined}
                          >
                            Membership
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-1">
                      Diese Pläne dürfen das Theme nutzen. Andere User sehen es, aber müssen einmalig freischalten.
                    </p>
                  </div>

                  {/* Changelog */}
                  <details className="group">
                    <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-200 select-none">Changelog (optional)</summary>
                    <textarea
                      value={t.changelog || ""}
                      onChange={e => updateTheme(t.id, { changelog: e.target.value })}
                      rows={3}
                      placeholder={"v1.0 — Initial release\nv1.1 — Faster product page"}
                      className="input-glass w-full text-[11px] font-mono resize-none mt-2"
                    />
                  </details>
                </div>
                );
              })}
            </div>

            {/* Sticky save shortcut at the bottom too */}
            {settingsData.themes.length > 0 && (
              <div className="sticky bottom-2 flex justify-end">
                <button
                  onClick={saveSettings}
                  disabled={settingsLoading}
                  className="btn-accent px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg"
                >
                  {settingsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" /> Alle Themes speichern</>}
                </button>
              </div>
            )}
          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* Code-Blöcke Tab */}
        {activeTab === "codeBlocks" && (
          <AdminErrorBoundary label="Code-Blöcke">
            <CodeBlocksAdminView
              blocks={codeBlocks}
              loading={codeBlocksLoading}
              onRefresh={loadCodeBlocks}
              onNotify={(t, m) => { if (t === "success") { setSuccess(m); setTimeout(() => setSuccess(""), 3000); } else { setError(m); } }}
            />
          </AdminErrorBoundary>
        )}

        {/* Coaching Tab */}
        {activeTab === "coaching" && (
          <AdminErrorBoundary label="Coaching">
            <CoachingAdminView
              tips={coachingTips}
              whatsapp={coachingWhatsapp}
              loading={coachingLoading}
              onRefresh={loadCoaching}
              onNotify={(t, m) => { if (t === "success") { setSuccess(m); setTimeout(() => setSuccess(""), 3000); } else { setError(m); } }}
            />
          </AdminErrorBoundary>
        )}

        {/* Credit Codes Tab */}
        {activeTab === "codes" && (
          <AdminErrorBoundary label="Voucher-Codes">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl space-y-3">
            {/* ── Bulk-Generator (random codes) ── */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Bulk-Generator (Random-Codes)</h3>
              </div>
              <p className="text-[10px] text-zinc-500 mb-2">
                Erstellt N zufällige Codes im Format <code className="font-mono">XXXXX-XXXXX</code>. Optional mit Prefix.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 mb-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkVoucher.count}
                  onChange={(e) => setBulkVoucher({ ...bulkVoucher, count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                  placeholder="Anzahl"
                  className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-white/25"
                />
                <input
                  type="number"
                  min={1}
                  value={bulkVoucher.credits}
                  onChange={(e) => setBulkVoucher({ ...bulkVoucher, credits: Math.max(1, Number(e.target.value) || 1) })}
                  placeholder="Credits/Code"
                  className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-white/25"
                />
                <input
                  type="number"
                  min={1}
                  value={bulkVoucher.maxPerAccount}
                  onChange={(e) => setBulkVoucher({ ...bulkVoucher, maxPerAccount: Math.max(1, Number(e.target.value) || 1) })}
                  placeholder="Max/Account"
                  className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono tabular-nums outline-none focus:border-white/25"
                />
                <input
                  type="text"
                  value={bulkVoucher.prefix}
                  onChange={(e) => setBulkVoucher({ ...bulkVoucher, prefix: e.target.value.toUpperCase() })}
                  placeholder="Prefix (opt)"
                  maxLength={8}
                  className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-xs font-mono uppercase outline-none focus:border-white/25"
                />
                <button
                  onClick={handleBulkVoucher}
                  disabled={bulkVoucherSaving}
                  className="px-3 py-1.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold hover:bg-purple-500/30 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {bulkVoucherSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Generieren
                </button>
              </div>
              <input
                type="text"
                value={bulkVoucher.note}
                onChange={(e) => setBulkVoucher({ ...bulkVoucher, note: e.target.value })}
                placeholder="Notiz für alle (optional)"
                maxLength={200}
                className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1.5 text-xs outline-none focus:border-white/25 placeholder:text-zinc-700"
              />

              {lastBulkResult && lastBulkResult.created.length > 0 && (
                <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/8 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-300">
                      ✓ {lastBulkResult.created.length} Codes erstellt
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(lastBulkResult.created.join("\n"))}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 transition flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" /> Alle kopieren
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {lastBulkResult.created.map((c) => (
                      <button
                        key={c}
                        onClick={() => { navigator.clipboard.writeText(c); }}
                        title="Klick zum Kopieren"
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/25 transition"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Create new code */}
            <div className="glass-strong rounded-2xl border border-[#95BF47]/15 p-5 md:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-[#95BF47]" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Neuen Code anlegen</h3>
                  <p className="text-xs text-zinc-500">Wird sofort einlösbar – aktivierungspflichtig kann später per Toggle geändert werden.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_2fr_auto] gap-3 items-end">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5">Code</label>
                  <input
                    type="text"
                    value={codeForm.code}
                    onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                    placeholder="WELCOME50"
                    maxLength={64}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-mono uppercase tracking-wider outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5 flex items-center gap-1"><Coins className="w-3 h-3" />Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={1_000_000}
                    value={codeForm.credits}
                    onChange={(e) => setCodeForm({ ...codeForm, credits: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-mono tabular-nums outline-none focus:border-[#95BF47]/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5">Max/Account</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={codeForm.maxPerAccount}
                    onChange={(e) => setCodeForm({ ...codeForm, maxPerAccount: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm font-mono tabular-nums outline-none focus:border-[#95BF47]/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-1.5">Notiz (optional)</label>
                  <input
                    type="text"
                    value={codeForm.note}
                    onChange={(e) => setCodeForm({ ...codeForm, note: e.target.value })}
                    placeholder="z. B. Black Friday Aktion"
                    maxLength={200}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#95BF47]/40 transition placeholder:text-zinc-700"
                  />
                </div>
                <button
                  onClick={handleCreateCode}
                  disabled={codeSaving || !codeForm.code.trim() || codeForm.credits <= 0}
                  className="btn-accent flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition"
                >
                  {codeSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Anlegen
                </button>
              </div>
              <p className="mt-3 text-[11px] text-zinc-600">
                Erlaubt: A-Z, 0-9, Bindestrich, Unterstrich (3–64 Zeichen). Codes sind nicht case-sensitiv.
              </p>
            </div>

            {/* Codes list */}
            <div className="glass border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-zinc-500">Aktive Codes</span>
                  <span className="text-[10px] font-mono text-zinc-600 tabular-nums">{codes.length}</span>
                </div>
                <button onClick={loadCodes} disabled={codesLoading} className="text-zinc-500 hover:text-white transition disabled:opacity-50">
                  {codesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Settings className="w-3.5 h-3.5" />}
                </button>
              </div>
              {codesLoading ? (
                <div className="flex items-center justify-center py-14"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
              ) : codes.length === 0 ? (
                <div className="text-center py-14 px-6 text-sm text-zinc-500">
                  <Ticket className="w-10 h-10 mx-auto mb-3 text-zinc-800" />
                  Noch keine Codes angelegt.
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {codes.map((c) => (
                    <div key={c.rowIndex} className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_1fr_1fr_2fr_auto] gap-3 items-center px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-6 rounded-full ${c.active ? "bg-[#95BF47]" : "bg-zinc-700"}`}
                        />
                        <code className="font-mono text-sm font-bold tracking-wider uppercase">{c.code}</code>
                      </div>
                      <div className="text-xs flex items-center gap-1.5">
                        <Coins className="w-3 h-3 text-[#95BF47]" />
                        <span className="font-mono tabular-nums text-white">{c.credits.toLocaleString("de-DE")}</span>
                        <span className="text-zinc-500">Credits</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-mono tabular-nums text-white">{c.maxPerAccount}×</span>
                        <span className="text-zinc-500"> / Account</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-zinc-500">Eingelöst </span>
                        <span className="font-mono tabular-nums text-white">{c.totalRedemptions.toLocaleString("de-DE")}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate">{c.note || "—"}</div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleToggleCode(c)}
                          disabled={codeBusyRow === c.rowIndex}
                          title={c.active ? "Deaktivieren" : "Aktivieren"}
                          className={`p-2 rounded-lg transition disabled:opacity-50 ${c.active ? "text-[#95BF47] hover:bg-[#95BF47]/10" : "text-zinc-600 hover:bg-white/5 hover:text-white"}`}
                        >
                          {codeBusyRow === c.rowIndex ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteCode(c)}
                          disabled={codeBusyRow === c.rowIndex}
                          title="Löschen"
                          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
          </AdminErrorBoundary>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <AdminErrorBoundary label="Produkte">
        <>
        <div className="flex flex-wrap gap-3 mb-3">
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 btn-accent rounded-xl text-sm font-medium"><Plus className="w-4 h-4" />Produkt hinzuf&uuml;gen</button>
          <select value={aiKategorie} onChange={(e) => setAiKategorie(e.target.value)} disabled={aiDiscovering} className="px-3 py-2.5 glass border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50">
            <option value="">Kategorie (optional)</option>
            {KATEGORIE_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={aiDepth} onChange={(e) => setAiDepth(e.target.value === "gruendlich" ? "gruendlich" : "schnell")} disabled={aiDiscovering} className="px-3 py-2.5 glass border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50">
            <option value="schnell">Schnell &middot; ~1 Min</option>
            <option value="gruendlich">Gr&uuml;ndlich &middot; ~1&ndash;2 Min</option>
          </select>
          <button onClick={handleAiDiscover} disabled={aiDiscovering} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600/20 border border-purple-500/30 text-purple-200 hover:bg-purple-600/30 transition disabled:opacity-50">
            {aiDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            KI-Produkt finden
          </button>
          <button onClick={() => setBulkModal(true)} className="flex items-center gap-2 px-4 py-2.5 glass hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition"><Upload className="w-4 h-4" />JSON Bulk Import</button>
          <button onClick={handleManualLinkCheck} disabled={linkCheckRunning} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-500/10 border border-amber-500/25 text-amber-200 hover:bg-amber-500/15 transition disabled:opacity-50" title="Pingt alle Produktlinks an und schreibt extra.linkStatus">
            {linkCheckRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
            Linkcheck jetzt
          </button>
          <button onClick={handleRepairProducts} disabled={repairRunning} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-500/10 border border-red-500/25 text-red-200 hover:bg-red-500/15 transition disabled:opacity-50" title="Tauscht vertauschte Titel/Preis-Felder. Erst Dry-Run, dann commit.">
            {repairRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Daten reparieren
          </button>
        </div>

        {/* ─── URL-basierte Discovery ────────────────────────── */}
        {/* Admin gibt einen Insta/TikTok/Shopify/AliExpress-Link an,
            KI extrahiert das Produkt drumherum + Ads + Shops. */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-2.5 rounded-xl bg-pink-500/[0.04] border border-pink-500/20">
          <Link2 className="w-4 h-4 text-pink-300 shrink-0 ml-1" />
          <span className="text-xs text-pink-200 font-semibold shrink-0">Aus URL importieren:</span>
          <input
            type="url"
            value={urlImportUrl}
            onChange={(e) => setUrlImportUrl(e.target.value)}
            disabled={urlImporting}
            placeholder="https://www.tiktok.com/@…/video/… ODER Insta-Reel ODER Shopify-Produkt-URL"
            className="flex-1 min-w-[260px] px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-white focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 font-mono"
          />
          <button
            onClick={handleUrlDiscover}
            disabled={urlImporting || !urlImportUrl.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500/20 border border-pink-500/35 text-pink-100 hover:bg-pink-500/30 transition disabled:opacity-50"
          >
            {urlImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Analysieren
          </button>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p, idx) => (
            <motion.div key={`${p.rowIndex}-${p.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
              className="glass border border-white/10 rounded-xl overflow-hidden hover:border-[#95BF47]/20 transition group">
              <div className="aspect-video bg-white/5 overflow-hidden relative">
                {p.bildUrl ? <img src={p.bildUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImagePlus className="w-8 h-8" /></div>}
                {(!p.titel || !p.bildUrl || !p.extra?.finances?.recommendedSellPrice) && (
                  <div className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-[9px] font-bold uppercase tracking-widest">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Daten unvollst.
                  </div>
                )}
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {p.sku && <span className="px-1.5 py-0.5 bg-[#95BF47]/10 text-[#95BF47] rounded text-[10px] font-medium">{p.sku}</span>}
                  <span className="text-[10px] text-zinc-500 ml-auto font-mono">{p.id}</span>
                </div>
                <h3 className="text-sm font-semibold truncate">
                  {p.titel || <span className="text-zinc-600 italic">(ohne Titel)</span>}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-[#95BF47] font-bold text-sm">{p.extra?.finances?.recommendedSellPrice || p.preis}&euro;</span>
                  {p.extra?.stats?.trendScore ? <span className="text-[10px] text-emerald-400 flex items-center gap-0.5"><Zap className="w-3 h-3" />{p.extra.stats.trendScore}%</span> : null}
                </div>
                <div className="flex gap-1 pt-1 border-t border-white/10">
                  <button onClick={() => openEdit(p)} className="flex-1 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition flex items-center justify-center gap-1"><Pencil className="w-3 h-3" />Bearbeiten</button>
                  <button
                    onClick={() => handleReDiscover(p)}
                    disabled={aiDiscovering}
                    title="KI-Daten neu generieren (Bilder, Ads, Links)"
                    className="py-1.5 px-2 text-xs text-purple-300 hover:bg-purple-500/10 rounded-lg transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleDelete(p.rowIndex)} className="py-1.5 px-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-center py-12 text-zinc-500">Keine Produkte gefunden.</div>}
        </div>
        </>
          </AdminErrorBoundary>
        )}
          </main>
        </div>
      </div>

      {/* ─── Mobile sidebar (drawer) ────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl border-t border-white/10 bg-[#0a0a0c]/95 backdrop-blur-xl"
              style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 0.75rem)", maxHeight: "85vh" }}
            >
              <div className="flex justify-center pt-2">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-300">Admin-Bereich</div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/[0.05]">
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              <div className="px-3 pb-3 overflow-y-auto" style={{ maxHeight: "70vh" }}>
                <AdminSidebarNav
                  activeTab={activeTab}
                  setActiveTab={(t) => { setActiveTab(t); setSidebarOpen(false); }}
                  counters={{ customers: customers.length, products: produkte.length, openTickets: openTicketsCount }}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── EDIT/ADD MODAL ─────────────────────────────────────── */}
      {/* ─── KI-PRODUKT-SUCHE OVERLAY ───────────────────────────── */}
      <AnimatePresence>
        {aiDiscovering && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6">
            <div className="text-center max-w-sm">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
              </div>
              <h3 className="text-lg font-bold">KI analysiert den US-Markt&hellip;</h3>
              <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
                Live-Recherche zu aktuell viralen Dropshipping-Produkten &mdash; Titel, Bilder, Preise &amp; Scores. Das dauert je nach Modus ca. 30 Sekunden bis 2 Minuten. Bitte das Fenster offen lassen.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── EDIT/ADD MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {editModal && editProduct && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">{isNew ? "Produkt hinzufügen" : "Produkt bearbeiten"}</h3>
                <button onClick={() => setEditModal(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              </div>

              {aiEvidence && (
                <div className="mb-5 flex gap-2.5 bg-purple-500/10 border border-purple-500/25 rounded-xl p-3">
                  <Sparkles className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-purple-200 mb-0.5">KI-Viralit&auml;ts-Analyse</div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{aiEvidence}</p>
                  </div>
                </div>
              )}

              <div className="space-y-5">
                {/* ID wird automatisch generiert (kein Eingabefeld).
                    Kategorie ist ein Dropdown mit fester Liste. */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Titel <span className="text-red-400">*</span></label>
                  <input type="text" value={editProduct.titel} onChange={e => setEditProduct({ ...editProduct, titel: e.target.value })} placeholder="z. B. Mini Snack Bag Sealer – Frische-Versiegler für Tüten" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Kategorie
                    <span className="text-zinc-600 font-normal ml-1">(steuert die Themen-Row im User-Charts)</span>
                  </label>
                  <select
                    value={editProduct.sku || ""}
                    onChange={(e) => setEditProduct({ ...editProduct, sku: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— Keine Kategorie / unkategorisiert —</option>
                    {KATEGORIE_OPTIONS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div><label className="block text-xs text-zinc-400 mb-1">Beschreibung (HTML)</label><textarea value={editProduct.beschreibung} onChange={e => setEditProduct({ ...editProduct, beschreibung: e.target.value })} rows={4} placeholder="<p>Verkaufsstarker Text mit <ul><li>Vorteilen</li></ul></p>" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
                <div><label className="block text-xs text-zinc-400 mb-1">AliExpress Link (Produkt)</label><input type="text" value={editProduct.aliExpressLink} onChange={e => setEditProduct({ ...editProduct, aliExpressLink: e.target.value })} placeholder="https://www.aliexpress.com/item/..." className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>

                {/* ─── Erweiterte Links + Ads (manuell editierbar) ─── */}
                <LinksAdsEditor
                  links={editProduct.links}
                  ads={editProduct.ads}
                  onLinksChange={(links) =>
                    setEditProduct((prev) => (prev ? { ...prev, links } : prev))
                  }
                  onAdsChange={(ads) =>
                    setEditProduct((prev) => (prev ? { ...prev, ads } : prev))
                  }
                />

                {/* ─── User-Voting Override (Admin kann faken) ─── */}
                <VotesEditor
                  votes={editProduct.votes}
                  onChange={(votes) =>
                    setEditProduct((prev) => (prev ? { ...prev, votes } : prev))
                  }
                />

                {/* Image Drop Zone */}
                <ImageDropZone
                  images={editProduct.images}
                  onAdd={(newUrls) => {
                    console.log("[ImageDropZone] onAdd called with:", newUrls);
                    setEditProduct(prev => {
                      if (!prev) return prev;
                      const merged = [...prev.images, ...newUrls];
                      console.log("[ImageDropZone] New images state:", merged);
                      return { ...prev, images: merged };
                    });
                  }}
                  onRemove={(index) => {
                    setEditProduct(prev => {
                      if (!prev) return prev;
                      return { ...prev, images: prev.images.filter((_, idx) => idx !== index) };
                    });
                  }}
                />

                {/* Finances */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400" />Finanzen</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Einkaufspreis</label><input type="number" step="0.01" value={editProduct.finances.buyPrice || ""} onChange={e => setEditProduct({ ...editProduct, finances: { ...editProduct.finances, buyPrice: Number(e.target.value) } })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Verkaufspreis</label><input type="number" step="0.01" value={editProduct.finances.recommendedSellPrice || ""} onChange={e => setEditProduct({ ...editProduct, finances: { ...editProduct.finances, recommendedSellPrice: Number(e.target.value) } })} className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div><label className="block text-[10px] text-zinc-500 mb-1">Marge (auto)</label><div className="w-full px-3 py-2 bg-zinc-800/60 border border-zinc-700 rounded-lg text-sm text-emerald-400 tabular-nums">{(Number(editProduct.finances.recommendedSellPrice || 0) - Number(editProduct.finances.buyPrice || 0)).toFixed(2)}&euro;</div></div>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-400" />Scores</h4>
                  <div className="space-y-2">
                    <StatInput label="Trend Score" value={editProduct.stats.trendScore} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, trendScore: v } })} icon={Zap} color="text-indigo-400" />
                    <StatInput label="Viralitäts-Score" value={editProduct.stats.viralScore} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, viralScore: v } })} icon={Zap} color="text-purple-400" />
                    <StatInput label="Impulskauf-Faktor" value={editProduct.stats.impulseBuyFactor} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, impulseBuyFactor: v } })} icon={Zap} color="text-amber-400" />
                    <StatInput label="Problemlöser-Index" value={editProduct.stats.problemSolverIndex} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, problemSolverIndex: v } })} icon={Zap} color="text-emerald-400" />
                    <StatInput label="Marktsättigung" value={editProduct.stats.marketSaturation} onChange={v => setEditProduct({ ...editProduct, stats: { ...editProduct.stats, marketSaturation: v } })} icon={Zap} color="text-red-400" />
                  </div>
                </div>

                {/* KI-Discovery Daten — read-only Panel, zeigt was die
                    Discovery-Pipeline gefunden hat. Werte überleben den
                    Save-Roundtrip, werden hier aber nicht editiert. */}
                <DiscoveryDataPanel
                  links={editProduct.links}
                  ads={editProduct.ads}
                  linkStatus={editProduct.linkStatus}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition">Abbrechen</button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Speichern</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── BULK IMPORT MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {bulkModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong border border-white/10 rounded-2xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">JSON Bulk Import</h3>
                <button onClick={() => setBulkModal(false)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              </div>

              <p className="text-zinc-400 text-sm mb-3">Neues JSON-Format mit Stats & Finanzen:</p>
              <pre className="text-[11px] bg-zinc-800 border border-zinc-700 rounded-xl p-3 mb-4 text-zinc-400 overflow-x-auto leading-relaxed">
{`[{
  "id": "prod_001", "sku": "SPORT", "monat": "04/2026",
  "title": "Ergonomisches Nackenkissen",
  "description": "<p>Perfekt für Reisen...</p>",
  "images": ["https://..."],
  "finances": { "buyPrice": 4.50, "recommendedSellPrice": 24.99, "profitMargin": 20.49 },
  "stats": { "trendScore": 98, "viralScore": 92, "impulseBuyFactor": 75, "problemSolverIndex": 90, "marketSaturation": 15 },
  "links": { "aliexpressLink": "https://..." }
}]`}
              </pre>

              <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)} rows={10} placeholder="JSON hier einfügen..."
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />

              <div className="flex gap-3 mt-4">
                <button onClick={() => setBulkModal(false)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition">Abbrechen</button>
                <button onClick={handleBulkImport} disabled={bulkLoading || !bulkJson.trim()} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                  {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" />Importieren</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── REPAIR PREVIEW MODAL ───────────────────────────────── */}
      <AnimatePresence>
        {repairPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => !repairRunning && setRepairPreview(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-red-300" />
                    Datenreparatur — Vorschau
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    {repairPreview.changed > 0
                      ? `${repairPreview.changed} von ${repairPreview.scanned} Produkten werden verändert. Prüf die Liste, dann committe.`
                      : `Kein Auto-Repair-Match unter ${repairPreview.scanned} Produkten. Roh-Sample unten zur Diagnose.`}
                  </p>
                </div>
                <button onClick={() => !repairRunning && setRepairPreview(null)} className="text-zinc-500 hover:text-white transition"><X className="w-5 h-5" /></button>
              </div>

              {/* Wenn KEINE Changes: zeig Rohdaten-Sample zur Diagnose */}
              {repairPreview.changed === 0 && repairPreview.sample && repairPreview.sample.length > 0 && (
                <div className="mb-4 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                    Roh-Sample (erste {repairPreview.sample.length} Zeilen wie sie im Sheet stehen)
                  </div>
                  {repairPreview.sample.map((s) => (
                    <div key={s.rowIndex} className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5 text-[11px] space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Row {s.rowIndex}</span>
                        {s.sku && <span className="px-1.5 py-0.5 bg-[#95BF47]/10 text-[#95BF47] rounded text-[9px] font-medium">{s.sku}</span>}
                        <span className="font-mono text-[10px] text-zinc-600 truncate">{s.id}</span>
                        {s.titelLooksLikeId && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/30 font-bold uppercase tracking-wider">titel=ID</span>
                        )}
                        {s.preisLooksLikeTitle && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider">preis=titel?</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                        <div className="text-zinc-400 truncate">
                          <span className="text-zinc-600">titel:</span>{" "}
                          <span className="text-zinc-200">{s.titel || "(leer)"}</span>
                        </div>
                        <div className="text-zinc-400 truncate">
                          <span className="text-zinc-600">preis:</span>{" "}
                          <span className="text-zinc-200">{s.preis || "(leer)"}</span>
                        </div>
                        <div className="text-zinc-400 truncate col-span-2">
                          <span className="text-zinc-600">bildUrl:</span>{" "}
                          <span className="text-zinc-200 font-mono text-[10px]">{s.bildUrl || "(leer)"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-zinc-600 mt-2">
                    Wenn du hier <span className="text-red-300 font-semibold">titel=ID</span> Zeilen siehst aber kein Match — gib mir den Screenshot, ich passe das Pattern an.
                  </p>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {repairPreview.changes.map((c) => (
                  <div key={c.rowIndex} className="rounded-lg bg-white/[0.03] border border-white/10 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Row {c.rowIndex}</span>
                      <span className="font-mono text-[10px] text-zinc-600 truncate">{c.id}</span>
                      <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${c.action === "swap-titel-preis" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border border-amber-500/30"}`}>
                        {c.action === "swap-titel-preis" ? "swap" : "clear-id"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-red-400 font-semibold mb-0.5">Alt</div>
                        <div className="text-zinc-400">Titel: <span className="text-zinc-200 font-mono">{c.oldTitel || "—"}</span></div>
                        <div className="text-zinc-400">Preis: <span className="text-zinc-200">{c.oldPreis || "—"}</span></div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold mb-0.5">Neu</div>
                        <div className="text-zinc-400">Titel: <span className="text-emerald-200 font-semibold">{c.newTitel || "(leer)"}</span></div>
                        <div className="text-zinc-400">Preis: <span className="text-zinc-200">{c.action === "swap-titel-preis" ? "(leer)" : c.oldPreis || "—"}</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setRepairPreview(null)} disabled={repairRunning} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-sm font-medium transition disabled:opacity-50">Schließen</button>
                {repairPreview.changed > 0 && (
                  <button onClick={handleRepairProducts} disabled={repairRunning} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
                    {repairRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Reparieren bestätigen</>}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── KI-Discovery Daten Panel (read-only) ────────────────────────
// Zeigt im Edit-Modal an, was die Discovery-Pipeline gefunden hat:
// AliExpress-Kategorie/Produkt-Link mit Status-Ampel, Dropshipping-
// Beispiel, Anzahl gefundener Beispiel-Ads pro Plattform. Werte werden
// hier nicht editiert — sie überleben den Save-Roundtrip via Passthrough.

// ─── LinksAdsEditor — manuelle Pflege aller Links + Ads ─────────
// Erlaubt dem Admin, alle Links (AliExpress-Kategorie, Dropshipping-
// Shop) und Beispiel-Ad-URLs (TikTok, Instagram, Facebook, YouTube)
// nachträglich zu editieren. Werte fließen via editProduct.links und
// editProduct.ads in den Save-Roundtrip (extra-JSON).
//
// Pro Plattform wird ein <textarea> verwendet — eine URL pro Zeile,
// leere Zeilen werden beim Save herausgefiltert.

function LinksAdsEditor({
  links,
  ads,
  onLinksChange,
  onAdsChange,
}: {
  links?: ProduktLinks;
  ads?: ProduktAds;
  onLinksChange: (links: ProduktLinks) => void;
  onAdsChange: (ads: ProduktAds) => void;
}) {
  const platformList: { key: keyof ProduktAds; label: string }[] = [
    { key: "tiktok", label: "TikTok" },
    { key: "instagram", label: "Instagram" },
    { key: "facebook", label: "Facebook" },
    { key: "youtube", label: "YouTube" },
  ];

  function setAliField(field: "aliExpressCategory" | "aliExpressProduct", value: string) {
    const next: ProduktLinks = { ...(links || {}) };
    next[field] = value || undefined;
    onLinksChange(next);
  }
  function setShopsText(raw: string) {
    // Format: pro Zeile "URL | Optionaler Titel"
    const examples = raw.split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [u, ...titleParts] = line.split("|").map((s) => s.trim());
        return { url: u, title: titleParts.join("|").trim() || undefined };
      })
      .filter((s) => /^https?:\/\//i.test(s.url));
    const next: ProduktLinks = { ...(links || {}) };
    if (examples.length === 0) {
      delete next.dropshippingExamples;
      delete next.dropshippingExample;
    } else {
      next.dropshippingExamples = examples;
      next.dropshippingExample = examples[0]; // Legacy-Mirror
    }
    onLinksChange(next);
  }
  // Initial-Wert fuer Textarea: aus dropshippingExamples ODER Legacy.
  const shopsText = (() => {
    const list = (links?.dropshippingExamples && links.dropshippingExamples.length > 0)
      ? links.dropshippingExamples
      : (links?.dropshippingExample?.url ? [links.dropshippingExample] : []);
    return list.map((s) => s.title ? `${s.url} | ${s.title}` : s.url).join("\n");
  })();
  function setPlatformUrls(key: keyof ProduktAds, raw: string) {
    const urls = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const next: ProduktAds = { ...(ads || {}) };
    if (urls.length === 0) {
      delete next[key];
    } else {
      next[key] = urls;
    }
    onAdsChange(next);
  }

  return (
    <details className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 hover:bg-white/[0.03] transition">
        <Link2 className="w-4 h-4 text-purple-300" />
        <span className="text-sm font-semibold text-zinc-200">Erweiterte Links &amp; Beispiel-Ads</span>
        <span className="ml-auto text-[10px] text-zinc-500">editierbar</span>
      </summary>
      <div className="p-4 space-y-4 border-t border-white/5">
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">AliExpress &amp; Dropshipping</div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">AliExpress Kategorie-Suche</label>
            <input
              type="text"
              value={links?.aliExpressCategory || ""}
              onChange={(e) => setAliField("aliExpressCategory", e.target.value)}
              placeholder="https://www.aliexpress.com/wholesale?SearchText=..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-[11px]"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Dropshipping-Shops (eine URL pro Zeile, optional <code className="text-zinc-500">| Titel</code>)
            </label>
            <textarea
              defaultValue={shopsText}
              onBlur={(e) => setShopsText(e.target.value)}
              rows={4}
              placeholder={"https://example.myshopify.com/products/cool-thing | Cool Things Store\nhttps://another-shop.com/products/cool-thing"}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-[10px]"
            />
            <p className="text-[10px] text-zinc-600 mt-1">
              Format pro Zeile: <code>URL | optionaler Titel</code>. Speichern beim Verlassen des Felds.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">Beispiel-Ads (URL pro Zeile)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {platformList.map((p) => {
              const value = (ads?.[p.key] || []).join("\n");
              return (
                <div key={p.key}>
                  <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
                    {p.label}
                    <span className="text-[9px] text-zinc-600">
                      ({(ads?.[p.key] || []).length})
                    </span>
                  </label>
                  <textarea
                    value={value}
                    onChange={(e) => setPlatformUrls(p.key, e.target.value)}
                    rows={3}
                    placeholder={`https://www.${p.key}.com/...`}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-[10px]"
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-600">
            Eine URL pro Zeile. Wird im Charts-Detail-Modal als anklickbare Chips beim jeweiligen Plattform-Icon angezeigt — Plattform-Icon erscheint nur wenn min. 1 URL gepflegt ist.
          </p>
        </div>
      </div>
    </details>
  );
}

// ─── VotesEditor — Admin kann ups/downs/manualBoost faken ───────
// Score = ups - downs + manualBoost. Mit manualBoost kann der Admin
// ein Produkt prominent in die "Beliebteste"-Row pushen (+50) oder
// es absichtlich runterdruecken (-30) ohne die echten User-Stimmen
// zu loeschen.
function VotesEditor({
  votes,
  onChange,
}: {
  votes?: ProduktVotes;
  onChange: (v: ProduktVotes) => void;
}) {
  const ups = votes?.ups ?? 0;
  const downs = votes?.downs ?? 0;
  const boost = votes?.manualBoost ?? 0;
  // RAW Score — der User sieht zusaetzlich noch ein deterministisches
  // Seed (basiert auf trend/viral/growth/id), damit kein Produkt bei
  // 0 startet. Seed wird hier nicht angezeigt, weil der Admin den
  // ROHWERT editieren soll.
  const score = ups - downs + boost;

  function setField(field: keyof ProduktVotes, value: number) {
    const safe = Number.isFinite(value) ? value : 0;
    onChange({
      ups: field === "ups" ? Math.max(0, Math.round(safe)) : ups,
      downs: field === "downs" ? Math.max(0, Math.round(safe)) : downs,
      manualBoost: field === "manualBoost" ? Math.round(safe) : boost,
    });
  }

  return (
    <details className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl overflow-hidden">
      <summary className="cursor-pointer select-none px-4 py-3 flex items-center gap-2 hover:bg-white/[0.03] transition">
        <ArrowUpCircle className="w-4 h-4 text-emerald-300" />
        <span className="text-sm font-semibold text-zinc-200">User-Voting Override</span>
        <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tabular-nums border ${score > 0 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : score < 0 ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-white/[0.04] text-zinc-400 border-white/10"}`}>
          Score: {score > 0 ? "+" : ""}{score}
        </span>
      </summary>
      <div className="p-4 space-y-3 border-t border-white/5">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
              Ups
            </label>
            <input
              type="number"
              min={0}
              value={ups}
              onChange={(e) => setField("ups", Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
              Downs
            </label>
            <input
              type="number"
              min={0}
              value={downs}
              onChange={(e) => setField("downs", Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
              Manual Boost
            </label>
            <input
              type="number"
              value={boost}
              onChange={(e) => setField("manualBoost", Number(e.target.value) || 0)}
              placeholder="z. B. +50 oder -30"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums"
            />
          </div>
        </div>
        <p className="text-[10px] text-zinc-500 leading-snug">
          <strong className="text-zinc-400">RAW-Score</strong> = ups - downs + manualBoost.
          Mit <strong className="text-amber-400">Manual Boost</strong> kannst du ein Produkt prominent in die „Beliebteste bei Brospify"-Reihe pushen (+) oder absichtlich runterdrücken (-) ohne die echten User-Votes anzufassen.
          Im Charts wird zusätzlich ein <strong className="text-purple-400">Seed-Wert</strong> addiert (abgeleitet aus Trend/Viral/Wachstum + ID-Hash), damit kein Produkt jemals bei 0 startet — Range <strong>+20 bis +350</strong> (höher = bessere Metriken).
        </p>
      </div>
    </details>
  );
}

function DiscoveryDataPanel({
  links,
  ads,
  linkStatus,
}: {
  links?: ProduktLinks;
  ads?: ProduktAds;
  linkStatus?: ProduktLinkStatus;
}) {
  const hasAnything =
    !!links?.aliExpressProduct ||
    !!links?.aliExpressCategory ||
    !!links?.dropshippingExample?.url ||
    Object.values(ads || {}).some((a) => Array.isArray(a) && a.length > 0);
  if (!hasAnything) return null;

  const platforms: { key: keyof ProduktAds; label: string }[] = [
    { key: "tiktok", label: "TikTok" },
    { key: "instagram", label: "Instagram" },
    { key: "facebook", label: "Facebook" },
    { key: "youtube", label: "YouTube" },
  ];

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-300" />
        KI-Discovery Daten
      </h4>

      {(links?.aliExpressCategory || links?.aliExpressProduct) && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            AliExpress
          </div>
          {links?.aliExpressCategory && (
            <LinkRow
              label="Kategorie"
              url={links.aliExpressCategory}
              ok={linkStatus?.aliExpressCategoryOk}
            />
          )}
          {links?.aliExpressProduct && (
            <LinkRow
              label="Produkt"
              url={links.aliExpressProduct}
              ok={linkStatus?.aliExpressProductOk}
            />
          )}
        </div>
      )}

      {links?.dropshippingExample?.url && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
            Dropshipping-Beispiel
          </div>
          <LinkRow
            label={links.dropshippingExample.title || "Shop"}
            url={links.dropshippingExample.url}
            ok={linkStatus?.dropshippingExampleOk}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
          Beispiel-Ads gefunden
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {platforms.map((p) => {
            const count = Array.isArray(ads?.[p.key]) ? ads![p.key]!.length : 0;
            return (
              <div
                key={p.key}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-between ${
                  count > 0
                    ? "bg-purple-500/10 border border-purple-500/25 text-purple-200"
                    : "bg-white/[0.02] border border-white/[0.06] text-zinc-600"
                }`}
              >
                <span>{p.label}</span>
                <span className="tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {linkStatus?.lastCheckedAt && (
        <div className="text-[10px] text-zinc-500">
          Linkcheck zuletzt:{" "}
          {new Date(linkStatus.lastCheckedAt).toLocaleString("de-DE")}
        </div>
      )}
    </div>
  );
}

function LinkRow({ label, url, ok }: { label: string; url: string; ok?: boolean }) {
  const statusColor =
    ok === false
      ? "bg-red-500/15 border-red-500/30 text-red-300"
      : ok === true
        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
        : "bg-white/[0.04] border-white/10 text-zinc-400";
  const statusLabel = ok === false ? "down" : ok === true ? "ok" : "?";
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0 w-16">
        {label}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 text-[11px] text-zinc-300 truncate hover:text-white"
      >
        {url}
      </a>
      <span
        className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${statusColor}`}
      >
        {statusLabel}
      </span>
    </div>
  );
}

// ─── Customer-tab helper components ──────────────────────────────

function KpiTile({ label, value, icon: Icon, color }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border p-2.5" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500">{label}</span>
        <Icon className="w-3 h-3" style={{ color }} />
      </div>
      <div className="text-base font-bold tabular-nums truncate" style={{ color }}>{value}</div>
    </div>
  );
}

function Indicator({ on, icon: Icon, title }: {
  on: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div
      title={`${title}: ${on ? "ja" : "nein"}`}
      className={`w-5 h-5 rounded flex items-center justify-center transition ${
        on ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.02] text-zinc-700"
      }`}
    >
      <Icon className="w-2.5 h-2.5" />
    </div>
  );
}

function StatusChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
        on
          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
          : "bg-zinc-500/8 border-zinc-500/20 text-zinc-500"
      }`}
    >
      {on && <Check className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}

function LogRow({ entry }: {
  entry: { ts: string; type: string; delta: number; balanceAfter: number; reason: string; ref?: string };
}) {
  const positive = entry.delta >= 0;
  const typeMeta: Record<string, { color: string; label: string }> = {
    starter: { color: "#A855F7", label: "Starter" },
    deduct: { color: "#EF4444", label: "Tool" },
    topup: { color: "#10B981", label: "Kauf" },
    voucher: { color: "#0EA5E9", label: "Voucher" },
    "admin-grant": { color: "#95BF47", label: "Admin+" },
    "admin-revoke": { color: "#F59E0B", label: "Admin−" },
  };
  const meta = typeMeta[entry.type] || { color: "#71717A", label: entry.type };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border"
        style={{ background: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color }}
      >
        {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-zinc-300 truncate">{entry.reason}</div>
        <div className="text-[9px] text-zinc-600 flex items-center gap-1.5">
          <Clock className="w-2.5 h-2.5" />
          {formatRelativeShort(entry.ts)}
          {entry.ref && <span className="font-mono truncate">· {entry.ref}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[12px] font-bold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? "+" : ""}{entry.delta}
        </div>
        <div className="text-[9px] text-zinc-600 tabular-nums">→ {entry.balanceAfter}</div>
      </div>
    </div>
  );
}

function ProfileRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04]">
      <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold shrink-0">{label}</span>
      <span className={`text-[11px] text-zinc-200 truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ─── Exact credits setter (overwrite balance) ──────────────────
// Single most-requested admin action: type a number, press Setzen,
// the customer's balance becomes exactly that number. The change is
// audited as admin-grant or admin-revoke depending on direction.

function ExactCreditsSetter({ currentBalance, saving, onSet }: {
  currentBalance: number;
  saving: boolean;
  onSet: (target: number) => void;
}) {
  const [value, setValue] = useState<string>(String(currentBalance));
  // Re-sync the field whenever the customer changes (currentBalance
  // changes as a side-effect of a different account being loaded)
  useEffect(() => { setValue(String(currentBalance)); }, [currentBalance]);

  const target = Number(value);
  const valid = Number.isFinite(target) && target >= 0 && target <= 10_000_000;
  const dirty = valid && target !== currentBalance;
  const delta = valid ? target - currentBalance : 0;

  return (
    <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-amber-500/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Coins className="w-3.5 h-3.5 text-amber-400" />
        <div className="text-[10px] uppercase tracking-widest font-semibold text-amber-300">
          Credit-Balance exakt setzen
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-1.5">
        <input
          type="number"
          min={0}
          max={10_000_000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 sm:max-w-[180px] bg-white/[0.04] border border-amber-500/20 rounded-lg px-2.5 py-2 text-sm font-mono tabular-nums outline-none focus:border-amber-500/40 transition"
          placeholder="z.B. 1500"
        />
        <button
          onClick={() => {
            if (!valid || !dirty) return;
            if (confirm(`Balance auf exakt ${target.toLocaleString("de-DE")} Credits setzen? (Aktuell: ${currentBalance.toLocaleString("de-DE")})`)) {
              onSet(target);
            }
          }}
          disabled={saving || !valid || !dirty}
          className="px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Setzen"}
        </button>
      </div>
      <div className="text-[10px] text-zinc-500 mt-1.5 leading-snug">
        Überschreibt die Balance KOMPLETT (kein +/−). Aktuell:{" "}
        <span className="font-mono font-semibold text-zinc-300">{currentBalance.toLocaleString("de-DE")}</span>
        {dirty && (
          <>
            {" "}→ <span className="font-mono font-semibold text-amber-300">{target.toLocaleString("de-DE")}</span>
            {" "}<span className={delta >= 0 ? "text-emerald-400" : "text-red-400"}>
              ({delta > 0 ? "+" : ""}{delta.toLocaleString("de-DE")})
            </span>
          </>
        )}
        . Wird im Activity-Log als admin-grant/revoke geführt.
      </div>
    </div>
  );
}

// ─── Admin note editor (inline save on blur) ───────────────────

function AdminNoteEditor({ initial, saving, onSave }: {
  initial: string;
  saving: boolean;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initial);
  const [dirty, setDirty] = useState(false);
  // Keep in-sync if a different customer is loaded
  useEffect(() => { setNote(initial); setDirty(false); }, [initial]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-semibold text-zinc-500 mb-1.5">Admin-Notiz (intern)</div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setDirty(true); }}
        placeholder="Interne Notiz zu diesem Kunden — nur Admins sehen das."
        rows={2}
        className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600 resize-y"
      />
      {dirty && (
        <div className="flex justify-end mt-1">
          <button
            onClick={() => { onSave(note); setDirty(false); }}
            disabled={saving}
            className="px-2.5 py-1 rounded-md bg-[#95BF47] text-black text-[10px] font-bold disabled:opacity-50"
          >
            {saving ? "…" : "Notiz speichern"}
          </button>
        </div>
      )}
    </div>
  );
}

function formatRelativeShort(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "gerade";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "2-digit" });
}

// ─── Admin sidebar nav ─────────────────────────────────────────

type SidebarTab = "dashboard" | "stats" | "activity" | "customers" | "licenses" | "credits" | "users" | "tiers" | "tickets" | "codes" | "products" | "themes" | "codeBlocks" | "coaching" | "news" | "knowledge" | "settings" | "system" | "logs" | "survey";

const SIDEBAR_GROUPS: {
  label: string;
  items: { key: SidebarTab; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }[];
}[] = [
  {
    label: "Analyse",
    items: [
      { key: "dashboard", label: "Dashboard", icon: BarChart3, color: "#10B981" },
      { key: "stats", label: "Statistiken", icon: TrendingUp, color: "#06B6D4" },
      { key: "activity", label: "Aktivität", icon: Zap, color: "#F59E0B" },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { key: "users", label: "User & Rollen", icon: UserCog, color: "#F472B6" },
      { key: "customers", label: "Kunden", icon: Users, color: "#3B82F6" },
      { key: "licenses", label: "Lizenzen", icon: Shield, color: "#06B6D4" },
      { key: "credits", label: "Credits", icon: Coins, color: "#95BF47" },
      { key: "tiers", label: "Abo-Modelle", icon: Crown, color: "#F59E0B" },
      { key: "tickets", label: "Tickets", icon: Shield, color: "#F59E0B" },
      { key: "codes", label: "Voucher-Codes", icon: Ticket, color: "#A855F7" },
    ],
  },
  {
    label: "Inhalte",
    items: [
      { key: "products", label: "Produkte", icon: Gem, color: "#95BF47" },
      { key: "themes", label: "Themes", icon: Palette, color: "#A855F7" },
      { key: "codeBlocks", label: "Code-Blöcke", icon: Code2, color: "#06B6D4" },
      { key: "coaching", label: "Coaching", icon: GraduationCap, color: "#FACC15" },
      { key: "news", label: "News", icon: ImageIcon, color: "#EC4899" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "system", label: "System-Status", icon: Power, color: "#10B981" },
      { key: "survey", label: "Umfragen", icon: MessageCircle, color: "#EC4899" },
      { key: "logs", label: "System-Logs", icon: ScrollText, color: "#FB7185" },
      { key: "knowledge", label: "KI-Wissen", icon: Sparkles, color: "#8B5CF6" },
      { key: "settings", label: "Settings", icon: Settings, color: "#71717A" },
    ],
  },
];

function AdminSidebarNav({ activeTab, setActiveTab, counters }: {
  activeTab: SidebarTab;
  setActiveTab: (t: SidebarTab) => void;
  counters: { customers: number; products: number; openTickets: number };
}) {
  return (
    <nav className="space-y-3">
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-2 pb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = activeTab === item.key;
              const counter =
                item.key === "customers" && counters.customers > 0 ? counters.customers :
                item.key === "products" && counters.products > 0 ? counters.products :
                item.key === "tickets" && counters.openTickets > 0 ? counters.openTickets :
                null;
              const counterIsBadge = item.key === "tickets" && counters.openTickets > 0;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full relative flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition ${
                    isActive
                      ? "bg-white/[0.06] text-white"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="admin-sidebar-bar"
                      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                      style={{ background: item.color }}
                    />
                  )}
                  <item.icon className="w-3.5 h-3.5" style={isActive ? { color: item.color } : undefined} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {counter !== null && (
                    <span
                      className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                        counterIsBadge
                          ? "bg-red-500 text-white badge-pulse"
                          : "bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      {counter}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ─── Dashboard view ────────────────────────────────────────────

function DashboardView({ stats, loading, onJumpToCustomer, autoRefresh, setAutoRefresh, onJumpTab, onRefresh, apiBalances, apiBalancesLoading, onRefreshBalances }: {
  stats: AdminStats | null;
  loading: boolean;
  onJumpToCustomer: (key: string) => void;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  onJumpTab: (t: SidebarTab) => void;
  onRefresh: () => void;
  apiBalances: ApiBalance[];
  apiBalancesLoading: boolean;
  onRefreshBalances: () => void;
}) {
  // The API-credit balances sit at the very top — even before stats
  // have loaded — so an empty provider is impossible to miss.
  const balancesTop = (
    <ApiBalancesCard
      balances={apiBalances}
      loading={apiBalancesLoading}
      onRefresh={onRefreshBalances}
    />
  );

  if (loading && !stats) {
    return (
      <div className="space-y-3">
        {balancesTop}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="space-y-3">
        {balancesTop}
        <div className="text-center py-10 text-sm text-zinc-500">Keine Daten verfügbar.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* API-Credit-Stände ganz oben */}
      {balancesTop}

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Aktualisieren
        </button>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            autoRefresh
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              : "bg-white/[0.04] border border-white/10 text-zinc-300"
          }`}
        >
          <Clock className="w-3 h-3" />
          Auto-Refresh {autoRefresh ? "AN (30s)" : "AUS"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onJumpTab("activity")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/15 transition"
        >
          <Zap className="w-3 h-3" /> Live-Aktivität
        </button>
        <button
          onClick={() => onJumpTab("customers")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-500/15 transition"
        >
          <Users className="w-3 h-3" /> Alle Kunden
        </button>
      </div>

      {/* God-Mode KPI strip — Apple-style glass cards */}
      <GodModeKpis stats={stats} onJumpTab={onJumpTab} />

      {/* Money — costs vs. revenue (this month) */}
      <MoneySection money={stats.money} />

      {/* KPI Grid */}
      <SectionTitle title="Kunden & Credits (Stand jetzt)" desc="Schnapsschuss aller Kunden im System. Balance = Credits, die noch in deren Konten liegen." />
      {/* ─── Credit-Verbrauch Panel (prominent) ─── */}
      {stats.creditsConsumed && (
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.05] to-red-500/[0.05] p-3">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownCircle className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-amber-200">
              Credit-Verbrauch deiner User
            </h3>
            <span className="text-[10px] text-zinc-500">live aggregiert</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
              <div className="text-[9px] uppercase tracking-widest text-amber-300/80 font-semibold">Heute</div>
              <div className="text-base font-bold text-amber-100 tabular-nums mt-0.5">
                {stats.creditsConsumed.today.toLocaleString("de-DE")}
              </div>
              <div className="text-[9px] text-amber-300/60 mt-0.5">
                ≈ {stats.creditsConsumed.costEurToday.toFixed(2)}€ Kosten
              </div>
            </div>
            <div className="rounded-lg border border-orange-500/20 bg-orange-500/[0.04] p-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[9px] uppercase tracking-widest text-orange-300/80 font-semibold">Letzte 7 Tage</div>
                {stats.creditsConsumed.trend7dPct !== 0 && (
                  <span className={`text-[9px] font-bold ${stats.creditsConsumed.trend7dPct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {stats.creditsConsumed.trend7dPct > 0 ? "+" : ""}{stats.creditsConsumed.trend7dPct}%
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-orange-100 tabular-nums mt-0.5">
                {stats.creditsConsumed.last7d.toLocaleString("de-DE")}
              </div>
              <div className="text-[9px] text-orange-300/60 mt-0.5">
                ≈ {stats.creditsConsumed.costEurLast7d.toFixed(2)}€ · vs. vorher {stats.creditsConsumed.prev7d.toLocaleString("de-DE")}
              </div>
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/[0.04] p-2.5">
              <div className="text-[9px] uppercase tracking-widest text-red-300/80 font-semibold">Letzte 30 Tage</div>
              <div className="text-base font-bold text-red-100 tabular-nums mt-0.5">
                {stats.creditsConsumed.last30d.toLocaleString("de-DE")}
              </div>
              <div className="text-[9px] text-red-300/60 mt-0.5">
                ≈ {stats.creditsConsumed.costEurLast30d.toFixed(2)}€ Kosten
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <BigKpi label="Kunden gesamt" value={stats.customers.total} icon={Users} color="#3B82F6" />
        <BigKpi label="Aktiv (7d)" value={stats.customers.activeLast7d} icon={Zap} color="#10B981" hint={`${stats.customers.activeLast30d} in 30d`} />
        <BigKpi label="Σ Balance" value={stats.credits.sumBalance} icon={Coins} color="#95BF47" hint={`Ø ${stats.credits.avgBalance}/Kunde`} />
        <BigKpi label="Σ Verbraucht" value={stats.credits.sumTotalUsed} icon={ArrowDownCircle} color="#EF4444" hint={`Ø ${stats.credits.avgUsed}/Kunde`} />
        <BigKpi label="Σ Eingenommen" value={stats.credits.sumTotalPurchased} icon={ArrowUpCircle} color="#A855F7" />
        <BigKpi label="Shop verbunden" value={stats.customers.withShopify} icon={Store} color="#F59E0B" hint={`von ${stats.customers.total}`} />
      </div>

      {/* Heatmap + Tool usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <DashboardCard title="Aktivität (24h × Wochentag)" icon={Clock} accent="#F59E0B">
          <ActivityHeatmap data={stats.heatmap} />
          <div className="text-[9px] text-zinc-500 mt-2">
            Wann sind deine Kunden aktiv? Heller = mehr Transaktionen. UTC-Stunden.
          </div>
        </DashboardCard>

        <DashboardCard title="Tool-Nutzung" icon={Sparkles} accent="#A855F7">
          {stats.toolUsage.length === 0 ? (
            <div className="text-xs text-zinc-500 mt-1">Noch keine Tool-Nutzung erfasst.</div>
          ) : (
            <div className="space-y-1.5">
              {stats.toolUsage.map((t) => {
                const max = Math.max(...stats.toolUsage.map((x) => x.count), 1);
                return (
                  <div key={t.reason} className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-300 truncate w-32 shrink-0">{t.reason}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#C084FC]"
                        style={{ width: `${(t.count / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-zinc-300 w-10 text-right">{t.count}×</span>
                    <span className="text-[10px] tabular-nums text-zinc-500 w-12 text-right">{t.totalCredits}c</span>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* Top users + recent feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <DashboardCard title="Top-Kunden (30d)" icon={TrendingUp} accent="#10B981">
          {stats.topUsers.length === 0 ? (
            <div className="text-xs text-zinc-500 mt-1">Noch keine aktiven Kunden.</div>
          ) : (
            <div className="space-y-1">
              {stats.topUsers.map((u, i) => (
                <button
                  key={u.lizenzschluessel}
                  onClick={() => onJumpToCustomer(u.lizenzschluessel)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition text-left"
                >
                  <span className="text-[10px] font-bold text-zinc-500 w-3 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate">{u.email || u.lizenzschluessel}</div>
                    <div className="text-[9px] text-zinc-500 truncate font-mono">{u.shopDomain || u.lizenzschluessel.slice(0, 14)}…</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[12px] font-bold text-emerald-400 tabular-nums">{u.used30d}c</div>
                    <div className="text-[9px] text-zinc-500">{u.txCount30d} TX · {u.balance}c bal</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="Letzte Transaktionen" icon={Clock} accent="#3B82F6">
          {stats.recentTx.length === 0 ? (
            <div className="text-xs text-zinc-500 mt-1">Keine Transaktionen.</div>
          ) : (
            <div className="space-y-1 max-h-[18rem] overflow-y-auto">
              {stats.recentTx.map((tx, i) => (
                <button
                  key={i}
                  onClick={() => onJumpToCustomer(tx.customer)}
                  className="w-full text-left"
                >
                  <LogRow entry={tx} />
                </button>
              ))}
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

// ─── Section title with description (used for grouping in Dashboard) ─

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="pt-1">
      <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest">{title}</div>
      {desc && <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{desc}</div>}
    </div>
  );
}

// ─── Money section (cost / revenue / profit this month) ───────────────

interface MoneyData {
  monthLabel: string;
  costThisMonthEur: number;
  costAllTimeEur: number;
  revenueThisMonthEur: number;
  revenueAllTimeEur: number;
  profitThisMonthEur: number;
  profitMarginPct: number;
  toolBreakdown: { reason: string; label: string; provider: string; calls: number; costEur: number; creditsCharged: number }[];
}

function MoneySection({ money }: { money: MoneyData }) {
  const profitGood = money.profitThisMonthEur >= 0;
  const maxCost = Math.max(...money.toolBreakdown.map((t) => t.costEur), 0.0001);

  return (
    <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.04] to-purple-500/[0.04] p-3 space-y-3">
      <div>
        <div className="text-[11px] font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
          💰 Geld dieser Monat ({money.monthLabel})
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5 leading-snug">
          Was du an AI-API-Calls bezahlst (geschätzt nach Provider-Preisen) vs. was Kunden für Credits gezahlt haben.
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-emerald-300/80 font-semibold">Umsatz</div>
          <div className="text-base font-bold tabular-nums text-emerald-300 mt-0.5">
            {money.revenueThisMonthEur.toFixed(2)} €
          </div>
          <div className="text-[9px] text-zinc-500 mt-0.5">All-Time {money.revenueAllTimeEur.toFixed(0)} €</div>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/[0.05] p-2.5">
          <div className="text-[9px] uppercase tracking-widest text-red-300/80 font-semibold">AI-Kosten</div>
          <div className="text-base font-bold tabular-nums text-red-300 mt-0.5">
            {money.costThisMonthEur.toFixed(2)} €
          </div>
          <div className="text-[9px] text-zinc-500 mt-0.5">All-Time {money.costAllTimeEur.toFixed(0)} €</div>
        </div>
        <div
          className="rounded-xl border p-2.5"
          style={{
            borderColor: profitGood ? "rgba(149,191,71,0.3)" : "rgba(239,68,68,0.3)",
            background: profitGood ? "rgba(149,191,71,0.05)" : "rgba(239,68,68,0.05)",
          }}
        >
          <div
            className="text-[9px] uppercase tracking-widest font-semibold"
            style={{ color: profitGood ? "#95BF47" : "#fca5a5" }}
          >
            Profit (geschätzt)
          </div>
          <div
            className="text-base font-bold tabular-nums mt-0.5"
            style={{ color: profitGood ? "#95BF47" : "#fca5a5" }}
          >
            {profitGood && money.profitThisMonthEur > 0 ? "+" : ""}
            {money.profitThisMonthEur.toFixed(2)} €
          </div>
          <div className="text-[9px] text-zinc-500 mt-0.5">{money.profitMarginPct}% Marge</div>
        </div>
      </div>

      {money.toolBreakdown.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
            Kosten pro Tool (diesen Monat)
          </div>
          <div className="space-y-1">
            {money.toolBreakdown.map((t) => (
              <div key={t.reason} className="flex items-center gap-2">
                <span className="text-[10px] truncate w-32 shrink-0 text-zinc-300">{t.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400"
                    style={{ width: `${(t.costEur / maxCost) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-zinc-400 w-14 text-right">{t.calls}× Calls</span>
                <span className="text-[10px] tabular-nums font-bold text-red-300 w-14 text-right">
                  {t.costEur < 0.01 ? "<0.01" : t.costEur.toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-zinc-600 mt-2 leading-snug">
            <strong>Schätzwerte</strong> — Replicate Real-ESRGAN ~€0,01/Call, Fal BiRefNet ~€0,037, Fal IC-Light ~€0,046, DeepSeek-Mails ~€0,004.
          </p>
        </div>
      )}
    </div>
  );
}

function BigKpi({ label, value, icon: Icon, color, hint }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border p-2.5 overflow-hidden relative" style={{ borderColor: `${color}25`, background: `${color}08` }}>
      <div className="absolute top-0 right-0 w-12 h-12 rounded-full opacity-15 blur-xl" style={{ background: color }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] uppercase tracking-widest font-semibold text-zinc-500 truncate">{label}</span>
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <div className="text-base font-bold tabular-nums" style={{ color }}>{typeof value === "number" ? value.toLocaleString("de-DE") : value}</div>
        {hint && <div className="text-[9px] text-zinc-500 mt-0.5 truncate">{hint}</div>}
      </div>
    </div>
  );
}

function DashboardCard({ title, icon: Icon, accent, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ActivityHeatmap({ data }: { data: number[][] }) {
  // data[dow][hour]; dow 0=Mon..6=Sun
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const max = Math.max(1, ...data.flat());
  return (
    <div>
      {/* Hour labels */}
      <div className="grid gap-px text-[8px] text-zinc-600 tabular-nums mb-1" style={{ gridTemplateColumns: "20px repeat(24, 1fr)" }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center">{h % 6 === 0 ? h : ""}</span>
        ))}
      </div>
      {data.map((row, dow) => (
        <div key={dow} className="grid gap-px mb-px" style={{ gridTemplateColumns: "20px repeat(24, 1fr)" }}>
          <span className="text-[9px] text-zinc-500 font-semibold flex items-center">{dayLabels[dow]}</span>
          {row.map((v, h) => {
            const intensity = v / max;
            return (
              <div
                key={h}
                title={`${dayLabels[dow]} ${h}:00 — ${v} TX`}
                className="aspect-square rounded-sm"
                style={{
                  background: v === 0
                    ? "rgba(255,255,255,0.02)"
                    : `rgba(245, 158, 11, ${0.15 + intensity * 0.85})`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Statistiken view ──────────────────────────────────────────

function StatsView({ stats, loading }: { stats: AdminStats | null; loading: boolean }) {
  if (loading && !stats) {
    return <div className="h-40 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />;
  }
  if (!stats) {
    return <div className="text-center py-10 text-sm text-zinc-500">Keine Daten verfügbar.</div>;
  }

  const maxDeduct = Math.max(...stats.daily14d.map((d) => d.deduct), 1);
  const maxTopup = Math.max(...stats.daily14d.map((d) => d.topup), 1);
  const totalGrowth = stats.customers.starterGranted;
  const conversionPct = stats.customers.total > 0
    ? Math.round((stats.customers.activeLast30d / stats.customers.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <SectionTitle title="Statistiken" desc="Wachstums- und Aktivitäts-Trends. Sieh wie Käufe (grün) vs. Verbrauch (rot) je Tag aussehen." />

      {/* Money block at top of stats */}
      <MoneySection money={stats.money} />

      {/* Activity over 14 days */}
      <DashboardCard title="Credit-Bewegungen (14 Tage)" icon={TrendingUp} accent="#10B981">
        <div className="flex items-end gap-px h-24 mb-1">
          {stats.daily14d.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-px min-w-0">
              <div className="w-full flex flex-col items-center gap-px">
                <div
                  className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm"
                  title={`${d.date} · Topups: ${d.topup}`}
                  style={{ height: `${(d.topup / maxTopup) * 40}px` }}
                />
                <div
                  className="w-full bg-gradient-to-t from-red-600 to-red-400 rounded-t-sm"
                  title={`${d.date} · Deducts: ${d.deduct}`}
                  style={{ height: `${(d.deduct / maxDeduct) * 40}px` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-1">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500" /> Topups</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-red-500" /> Verbrauch</span>
        </div>
      </DashboardCard>

      {/* Mini KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <BigKpi label="Mit Starter" value={totalGrowth} icon={Gem} color="#A855F7" hint={`${stats.customers.total - totalGrowth} ohne`} />
        <BigKpi label="Aktiv-Quote 30d" value={conversionPct} icon={TrendingUp} color="#10B981" hint="% der Kunden" />
        <BigKpi label="Mit Google" value={stats.customers.withGoogle} icon={Mail} color="#3B82F6" />
        <BigKpi label="Σ Käufe" value={stats.credits.sumTotalPurchased} icon={ArrowUpCircle} color="#10B981" />
      </div>

      {/* Tool ranking with usage */}
      <DashboardCard title="Tool-Ranking" icon={Sparkles} accent="#A855F7">
        {stats.toolUsage.length === 0 ? (
          <div className="text-xs text-zinc-500">Noch keine Tools genutzt.</div>
        ) : (
          <div className="space-y-2">
            {stats.toolUsage.map((t, i) => {
              const totalCount = stats.toolUsage.reduce((s, x) => s + x.count, 0);
              const pct = Math.round((t.count / totalCount) * 100);
              return (
                <div key={t.reason}>
                  <div className="flex items-center justify-between text-[11px] mb-0.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <span className="text-zinc-500 w-3 tabular-nums">{i + 1}.</span>
                      {t.reason}
                    </span>
                    <span className="text-zinc-400 tabular-nums">{t.count} Calls · {t.totalCredits} Credits · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#A855F7] to-[#EC4899]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>
    </div>
  );
}

// ─── Activity feed view ────────────────────────────────────────

// Add a heading + caption above the activity feed when the parent
// renders this view, so the admin knows exactly what each filter
// does and what a transaction row means.

function ActivityView({ entries, loading, filter, setFilter, onJumpToCustomer, onRefresh, onExportCsv }: {
  entries: ActivityEntry[];
  loading: boolean;
  filter: { type: string; q: string; sinceDays: number };
  setFilter: (f: { type: string; q: string; sinceDays: number }) => void;
  onJumpToCustomer: (key: string) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
}) {
  return (
    <div className="space-y-3">
      <SectionTitle
        title="Live-Aktivität (alle Credit-Bewegungen)"
        desc="Jede Transaktion in einer Liste — Tool-Verbrauch, Käufe, Voucher, Starter-Boni, Admin-Anpassungen. Klick auf eine Zeile springt zum Kunden."
      />

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2">
        <input
          type="text"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Kunde suchen (License, E-Mail, Shop)…"
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600"
        />
        <select
          value={filter.type}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none"
        >
          <option value="">Alle Typen</option>
          <option value="deduct">Tool-Verbrauch</option>
          <option value="topup">Käufe</option>
          <option value="starter">Starter-Bonus</option>
          <option value="voucher">Voucher</option>
          <option value="admin-grant,admin-revoke">Admin</option>
        </select>
        <select
          value={filter.sinceDays}
          onChange={(e) => setFilter({ ...filter, sinceDays: Number(e.target.value) })}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs outline-none"
        >
          <option value="0">Alle Zeit</option>
          <option value="1">Heute</option>
          <option value="7">7 Tage</option>
          <option value="30">30 Tage</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Aktualisieren
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-500">{entries.length} Einträge geladen</span>
        <button
          onClick={onExportCsv}
          disabled={entries.length === 0}
          className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-40 flex items-center gap-1.5"
        >
          <Save className="w-3 h-3" /> CSV-Export
        </button>
      </div>

      {/* Feed */}
      <div className="space-y-1">
        {loading && entries.length === 0 ? (
          <div className="space-y-1">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-white/[0.02] border border-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-sm text-zinc-500">Keine Transaktionen gefunden.</div>
        ) : (
          entries.map((entry, i) => (
            <button
              key={i}
              onClick={() => onJumpToCustomer(entry.customerKey)}
              className="w-full text-left"
            >
              <ActivityRow entry={entry} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const positive = entry.delta >= 0;
  const typeMeta: Record<string, { color: string; label: string }> = {
    starter: { color: "#A855F7", label: "Starter" },
    deduct: { color: "#EF4444", label: "Tool" },
    topup: { color: "#10B981", label: "Kauf" },
    voucher: { color: "#0EA5E9", label: "Voucher" },
    "admin-grant": { color: "#95BF47", label: "Admin+" },
    "admin-revoke": { color: "#F59E0B", label: "Admin−" },
  };
  const meta = typeMeta[entry.type] || { color: "#71717A", label: entry.type };

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-md bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition">
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0"
        style={{ background: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color }}
      >
        {meta.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-zinc-200 truncate">
          <span className="font-semibold">{entry.email || entry.customerKey}</span>
          <span className="text-zinc-500"> · {entry.reason}</span>
        </div>
        <div className="text-[9px] text-zinc-600 flex items-center gap-1.5">
          <Clock className="w-2.5 h-2.5" />
          {formatRelativeShort(entry.ts)}
          {entry.ref && <span className="font-mono truncate">· {entry.ref}</span>}
          {entry.shopDomain && <span className="truncate">· {entry.shopDomain}</span>}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-[12px] font-bold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? "+" : ""}{entry.delta}
        </div>
        <div className="text-[9px] text-zinc-600 tabular-nums">→ {entry.balanceAfter}</div>
      </div>
    </div>
  );
}

// ─── News admin view (lightweight CRUD) ────────────────────────

interface NewsPostT { rowIndex: number; id: string; type: "text" | "video"; title: string; body: string; imageUrl: string; youtubeUrl: string; previewImageUrl: string; active: boolean; createdAt: string }

// ─── System status view ────────────────────────────────────────

interface SystemStatusT {
  generatedAt: string;
  sheetTabs: { name: string; exists: boolean; rowCount: number; error?: string }[];
  blob: { count: number; bytesEstimate: number; mbEstimate: number };
  envChecks: { key: string; label: string; required: boolean; configured: boolean }[];
  timestamps: { latestKundeIso: string; latestTxIso: string; latestNewsIso: string };
}

function SystemStatusView({ status, loading, onRefresh, apiBalances, apiBalancesLoading, onRefreshBalances }: {
  status: SystemStatusT | null;
  loading: boolean;
  onRefresh: () => void;
  apiBalances: ApiBalance[];
  apiBalancesLoading: boolean;
  onRefreshBalances: () => void;
}) {
  if (loading && !status) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
        ))}
      </div>
    );
  }
  if (!status) return <div className="text-center py-10 text-sm text-zinc-500">Keine Daten.</div>;

  const requiredMissing = status.envChecks.filter((e) => e.required && !e.configured).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">
          Health-Check über Sheet-Tabs, Blob-Storage, Environment-Variablen und AI-API-Balances.
        </p>
        <button
          onClick={() => { onRefresh(); onRefreshBalances(); }}
          disabled={loading || apiBalancesLoading}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
        >
          {(loading || apiBalancesLoading) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Aktualisieren
        </button>
      </div>

      {/* ─── AI-API Balances (DeepSeek + Fal + Replicate) ─── */}
      <ApiBalancesCard balances={apiBalances} loading={apiBalancesLoading} onRefresh={onRefreshBalances} />

      {/* ─── Starter-Credit Backfill ─── */}
      <BackfillStarterCard />

      {/* ─── Video-Scout-Cache (gemeinsamer Pool + Link-Prune) ─── */}
      <ScoutCacheCard />

      {/* ─── License Sync API (Make.com → Hub → Sheet) ─── */}
      <LicenseSyncCard />

      {/* ─── Shopify Webhook + Resend Setup (replaces Make.com end-to-end) ─── */}
      <ShopifyWebhookSetupCard />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <BigKpi label="Sheet-Tabs OK" value={status.sheetTabs.filter((t) => t.exists).length} icon={Check} color="#10B981" hint={`${status.sheetTabs.filter((t) => !t.exists).length} fehlen`} />
        <BigKpi label="Blob-Items" value={status.blob.count} icon={ImageIcon} color="#3B82F6" hint={`${status.blob.mbEstimate.toFixed(1)} MB`} />
        <BigKpi label="ENV gesetzt" value={status.envChecks.filter((e) => e.configured).length} icon={Power} color={requiredMissing > 0 ? "#EF4444" : "#10B981"} hint={requiredMissing > 0 ? `${requiredMissing} Pflicht fehlt!` : "alle Pflicht ✓"} />
        <BigKpi label="Letzte TX" value={0} icon={Clock} color="#A855F7" hint={status.timestamps.latestTxIso ? formatRelativeShort(status.timestamps.latestTxIso) : "—"} />
      </div>

      {/* Sheet tabs */}
      <DashboardCard title="Google Sheets — Tab-Status" icon={BarChart3} accent="#10B981">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {status.sheetTabs.map((t) => (
            <div key={t.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                t.exists ? "bg-emerald-400" : "bg-red-400"
              }`} />
              <span className="text-[12px] font-mono flex-1 truncate">{t.name}</span>
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {t.exists ? `${t.rowCount} rows` : "fehlt"}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Env vars */}
      <DashboardCard title="Environment-Variablen" icon={Power} accent={requiredMissing > 0 ? "#EF4444" : "#10B981"}>
        <div className="space-y-1">
          {status.envChecks.map((e) => (
            <div key={e.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                e.configured ? "bg-emerald-400" : e.required ? "bg-red-400" : "bg-zinc-600"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate">{e.label}</div>
                <div className="text-[9px] text-zinc-500 font-mono truncate">{e.key}</div>
              </div>
              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                e.configured
                  ? "bg-emerald-500/10 text-emerald-300"
                  : e.required
                    ? "bg-red-500/10 text-red-300"
                    : "bg-zinc-500/10 text-zinc-400"
              }`}>
                {e.configured ? "✓ gesetzt" : e.required ? "Pflicht!" : "optional"}
              </span>
            </div>
          ))}
        </div>
      </DashboardCard>

      {/* Activity timestamps */}
      <DashboardCard title="Letzte Aktivität" icon={Clock} accent="#A855F7">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          <div className="px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Letzte Kunden-Mutation</div>
            <div className="text-[12px] text-zinc-200 mt-0.5">{status.timestamps.latestKundeIso ? formatRelativeShort(status.timestamps.latestKundeIso) : "—"}</div>
          </div>
          <div className="px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Letzte Transaktion</div>
            <div className="text-[12px] text-zinc-200 mt-0.5">{status.timestamps.latestTxIso ? formatRelativeShort(status.timestamps.latestTxIso) : "—"}</div>
          </div>
          <div className="px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Letzte News</div>
            <div className="text-[12px] text-zinc-200 mt-0.5">{status.timestamps.latestNewsIso ? formatRelativeShort(status.timestamps.latestNewsIso) : "—"}</div>
          </div>
        </div>
        <div className="text-[10px] text-zinc-600 mt-2 text-right">
          Snapshot von {new Date(status.generatedAt).toLocaleTimeString("de-DE")}
        </div>
      </DashboardCard>
    </div>
  );
}

// ─── API Balances card (System tab) ────────────────────────────

const BAL_COLOR: Record<string, string> = {
  ok: "#10B981",
  low: "#F59E0B",
  empty: "#EF4444",
  unknown: "#71717A",
  "not-configured": "#71717A",
};
const BAL_LABEL: Record<string, string> = {
  ok: "OK",
  low: "Niedrig",
  empty: "Leer!",
  unknown: "Unbekannt",
  "not-configured": "Nicht konfiguriert",
};

// Effektiver Stand pro Provider: lokales Ledger (geschätzt) hat Vorrang vor
// dem reinen API-Status; ein echtes API-"empty" (z. B. Anthropic 402) gewinnt.
function effectiveBalance(b: ApiBalance): {
  status: string;
  detail: string;
  color: string;
  badge: string;
  canReconcile: boolean;
} {
  if (b.ledgerKind === "usd" && b.ledgerUsd !== undefined) {
    const v = b.ledgerUsd;
    const st = b.status === "empty" ? "empty" : v < 0.5 ? "empty" : v < 2 ? "low" : "ok";
    return {
      status: st,
      detail: `${v.toFixed(2)} $ geschätzt übrig`,
      color: BAL_COLOR[st],
      badge: BAL_LABEL[st],
      canReconcile: true,
    };
  }
  if (b.ledgerKind === "count" && b.ledgerCount) {
    const c = b.ledgerCount;
    const monthLeft = Math.max(0, c.monthLimit - c.monthUsed);
    const dayLeft = Math.max(0, c.dayLimit - c.dayUsed);
    const st =
      monthLeft <= 0 || dayLeft <= 0
        ? "empty"
        : (c.monthLimit && monthLeft / c.monthLimit < 0.1) ||
            (c.dayLimit && dayLeft / c.dayLimit < 0.1)
          ? "low"
          : "ok";
    return {
      status: st,
      detail: `${c.monthUsed}/${c.monthLimit} Monat · ${c.dayUsed}/${c.dayLimit} Tag`,
      color: BAL_COLOR[st],
      badge: BAL_LABEL[st],
      canReconcile: true,
    };
  }
  // Kein Ledger → reine API-Sicht.
  const dashboardOnly = b.status === "ok" && !b.hasBalanceApi;
  const color = dashboardOnly ? "#71717A" : BAL_COLOR[b.status];
  const badge = dashboardOnly ? "Dashboard" : BAL_LABEL[b.status];
  const detail = dashboardOnly
    ? "Guthaben nur im Anbieter-Dashboard sichtbar →"
    : b.raw
      ? b.raw
      : b.balanceEur !== undefined
        ? `${b.balanceEur.toFixed(2)} € (${b.balanceUsd?.toFixed(2)} $) übrig`
        : b.error || "—";
  return { status: b.status, detail, color, badge, canReconcile: false };
}

function ApiBalancesCard({
  balances,
  loading,
  onRefresh,
}: {
  balances: ApiBalance[];
  loading: boolean;
  onRefresh?: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  async function reconcile(b: ApiBalance) {
    try {
      if (b.ledgerKind === "usd") {
        const input = window.prompt(
          `Aktuelles ${b.label}-Guthaben in $ eingeben (laut Anbieter-Dashboard):`,
          String(b.ledgerUsd ?? 0),
        );
        if (input == null) return;
        const balance = parseFloat(input.replace(",", "."));
        if (!Number.isFinite(balance)) return;
        await fetch("/api/admin/provider-ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: b.provider, balance }),
        });
      } else if (b.ledgerKind === "count") {
        const input = window.prompt(
          `Resend: bereits genutzte E-Mails diesen Monat (von ${b.ledgerCount?.monthLimit ?? 3000}):`,
          String(b.ledgerCount?.monthUsed ?? 0),
        );
        if (input == null) return;
        const monthUsed = parseInt(input, 10);
        if (!Number.isFinite(monthUsed)) return;
        await fetch("/api/admin/provider-ledger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "resend", monthUsed }),
        });
      }
      onRefresh?.();
    } catch {
      /* ignore */
    }
  }

  async function runTest() {
    setTesting(true);
    setTestMsg("");
    try {
      const res = await fetch("/api/cron/check-api-balances", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestMsg(data?.error || "Fehler beim Prüfen.");
      } else if (data.emailed) {
        setTestMsg(`✓ ${data.lows} knapp — Alert-Mail an brospify.info@gmail.com gesendet.`);
      } else if (data.lows > 0) {
        setTestMsg(`${data.lows} knapp, aber keine Mail (${data.skipped || "kürzlich schon gewarnt"}).`);
      } else {
        setTestMsg("✓ Alles im grünen Bereich — keine Mail nötig.");
      }
    } catch {
      setTestMsg("Verbindungsfehler.");
    } finally {
      setTesting(false);
    }
  }

  if (loading && balances.length === 0) {
    return <div className="h-32 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />;
  }
  if (balances.length === 0) {
    return null;
  }
  const lowOrEmpty = balances.filter((b) => {
    const s = effectiveBalance(b).status;
    return s === "low" || s === "empty";
  });

  return (
    <DashboardCard
      title="AI-API Balances (Provider-Konten)"
      icon={Coins}
      accent={lowOrEmpty.length > 0 ? "#EF4444" : "#10B981"}
    >
      <p className="text-[10px] text-zinc-500 mb-2 leading-snug">
        Apify/DeepSeek/Tavily zeigen echtes API-Guthaben; Anthropic/Fal/Replicate/Resend einen lokal
        mitgeführten Stand, der nach jeder Nutzung abgezogen wird — „Korrigieren", wenn du aufgeladen hast.
      </p>
      <div className="space-y-1.5">
        {balances.map((b) => {
          const eff = effectiveBalance(b);
          return (
            <div
              key={b.provider}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg border"
              style={{ background: `${eff.color}10`, borderColor: `${eff.color}30` }}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: eff.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate">{b.label}</div>
                <div className="text-[9.5px] text-zinc-400 truncate">{eff.detail}</div>
              </div>
              {eff.canReconcile && (
                <button
                  onClick={() => reconcile(b)}
                  className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-300 hover:bg-white/[0.10] hover:text-white transition"
                >
                  Korrigieren
                </button>
              )}
              {b.billingUrl && b.configured && (
                <a
                  href={b.billingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-zinc-300 hover:bg-white/[0.10] hover:text-white transition"
                >
                  Aufladen ↗
                </a>
              )}
              <span
                className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0"
                style={{ background: `${eff.color}20`, color: eff.color }}
              >
                {eff.badge}
              </span>
            </div>
          );
        })}
      </div>
      {lowOrEmpty.length > 0 && (
        <div className="mt-2 text-[10px] text-red-300 leading-snug">
          ⚠️ {lowOrEmpty.length} Provider {lowOrEmpty.length === 1 ? "ist" : "sind"} im niedrigen / leeren Bereich. Lade dort sofort auf, sonst fallen Tool-Calls aus.
        </div>
      )}

      <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2 flex-wrap">
        <button
          onClick={runTest}
          disabled={testing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.09] transition disabled:opacity-50"
        >
          {testing ? "Prüfe…" : "Jetzt prüfen & Alert-Mail testen"}
        </button>
        {testMsg && <span className="text-[10px] text-zinc-400">{testMsg}</span>}
      </div>
      <p className="mt-1.5 text-[9px] text-zinc-600 leading-snug">
        Automatisch: Wird ein Konto niedrig/leer, geht täglich eine Warn-Mail an brospify.info@gmail.com
        (entprellt — max. 1×/Tag pro Provider-Stand).
      </p>
    </DashboardCard>
  );
}

function NewsAdminView({ posts, loading, onRefresh }: {
  posts: NewsPostT[];
  loading: boolean;
  onRefresh: () => void;
}) {
  async function toggle(p: NewsPostT) {
    await fetch("/api/admin/news", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: p.rowIndex, active: !p.active }),
    });
    onRefresh();
  }
  async function remove(p: NewsPostT) {
    if (!confirm("News-Card löschen?")) return;
    await fetch("/api/admin/news", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowIndex: p.rowIndex }),
    });
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">
          News werden auf der Home-Seite jedes Kunden angezeigt. Erstellen + Bearbeiten geht direkt im Home über das „Verwalten"-Modal.
        </p>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Aktualisieren
        </button>
      </div>
      {posts.length === 0 ? (
        <div className="text-center py-10 text-sm text-zinc-500">Noch keine News.</div>
      ) : (
        <div className="space-y-1.5">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              {(p.imageUrl || p.previewImageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl || p.previewImageUrl} alt="" className="w-12 h-12 rounded-md object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4 text-zinc-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                    p.type === "video" ? "bg-rose-500/15 text-rose-300" : "bg-[#95BF47]/15 text-[#95BF47]"
                  }`}>{p.type}</span>
                  {!p.active && <span className="text-[8px] text-zinc-600 uppercase">inaktiv</span>}
                  <span className="text-[9px] text-zinc-600">· {formatRelativeShort(p.createdAt)}</span>
                </div>
                <div className="text-[12px] font-semibold truncate">{p.title}</div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => toggle(p)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.05] rounded-md transition" title={p.active ? "Verstecken" : "Aktivieren"}>
                  <Power className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(p)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── God-Mode KPI strip (top of Dashboard view) ───────────────────
// Apple-style glass cards with the four headline metrics: Active subs,
// MRR, Signups vs Churn, total credits in system. Tapping a card
// jumps to the most relevant detail view.

function GodModeKpis({ stats, onJumpTab }: {
  stats: AdminStats;
  onJumpTab: (t: SidebarTab) => void;
}) {
  // Defensive: an older /api/admin/stats response (cached by the
  // browser between deploys) may lack subscriptions/signups entirely.
  // Don't crash, just fall back to neutral zeros.
  const subs = stats.subscriptions ?? {
    activeTotal: 0,
    byTier: { pro: 0 },
    mrrEur: 0,
    pricing: [],
    newPaid30d: 0,
    churn30d: 0,
    churnRatePct: 0,
  };
  const signups = stats.signups ?? { last7d: 0, last30d: 0, daily30d: [] };
  const byTier = (subs.byTier ?? { pro: 0 }) as Record<string, number>;
  const pricing = Array.isArray(subs.pricing) ? subs.pricing : [];
  const tierLabelMap = new Map(pricing.map((p) => [p.key, p.label]));

  // Sparkline path for the 30d signup line — guarded against empty.
  const points = Array.isArray(signups.daily30d) ? signups.daily30d : [];
  const max = Math.max(...points.map((p) => p.count), 1);
  const w = 120, h = 28;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points.length === 0
    ? `M 0 ${h / 2} L ${w} ${h / 2}`
    : points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * stepX).toFixed(1)} ${(h - (p.count / max) * (h - 4) - 2).toFixed(1)}`)
        .join(" ");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {/* MRR card */}
      <button
        onClick={() => onJumpTab("users")}
        className="text-left p-3 rounded-2xl border border-white/[0.08] backdrop-blur-2xl transition hover:border-white/[0.16] hover:translate-y-[-1px]"
        style={{
          background: "linear-gradient(180deg, rgba(149,191,71,0.10) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-lg bg-[#95BF47]/15 border border-[#95BF47]/25 flex items-center justify-center">
            <Euro className="w-3 h-3 text-[#95BF47]" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400">MRR</span>
        </div>
        <div className="font-mono text-[26px] leading-none font-bold text-white tabular-nums">
          {subs.mrrEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          <span className="text-[14px] text-zinc-500 ml-1">€</span>
        </div>
        <div className="text-[10px] text-zinc-500 mt-1.5">
          aus {subs.activeTotal} aktiven Abos · {subs.newPaid30d} neu in 30d
        </div>
      </button>

      {/* Active subs by tier */}
      <button
        onClick={() => onJumpTab("users")}
        className="text-left p-3 rounded-2xl border border-white/[0.08] backdrop-blur-2xl transition hover:border-white/[0.16] hover:translate-y-[-1px]"
        style={{
          background: "linear-gradient(180deg, rgba(168,85,247,0.10) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <Crown className="w-3 h-3 text-purple-300" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400">Aktive Abos</span>
        </div>
        <div className="font-mono text-[26px] leading-none font-bold text-white tabular-nums">
          {subs.activeTotal}
        </div>
        <div className="text-[10px] text-zinc-500 mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5">
          {(["pro"] as const).map((k) => (
            <span key={k} className="tabular-nums">
              {tierLabelMap.get(k) || k}: <span className="text-zinc-300 font-semibold">{byTier[k] ?? 0}</span>
            </span>
          ))}
        </div>
      </button>

      {/* Signups vs Churn */}
      <button
        onClick={() => onJumpTab("logs")}
        className="text-left p-3 rounded-2xl border border-white/[0.08] backdrop-blur-2xl transition hover:border-white/[0.16] hover:translate-y-[-1px]"
        style={{
          background: "linear-gradient(180deg, rgba(59,130,246,0.10) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <TrendingUp className="w-3 h-3 text-blue-300" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400">Signups · Churn (30d)</span>
        </div>
        <div className="flex items-end gap-2">
          <div className="font-mono text-[26px] leading-none font-bold text-emerald-300 tabular-nums">
            +{signups.last30d}
          </div>
          <span className="text-zinc-600 text-sm">/</span>
          <div className="font-mono text-[20px] leading-none font-bold text-red-300 tabular-nums">
            −{subs.churn30d}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <svg width={w} height={h} className="overflow-visible shrink-0">
            <defs>
              <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#signupGrad)" />
            <path d={path} stroke="#34D399" strokeWidth="1.5" fill="none" />
          </svg>
          <div className="text-[10px] text-zinc-500 leading-tight">
            7d: <span className="text-zinc-300">+{signups.last7d}</span><br/>
            Churn: <span className="text-zinc-300">{subs.churnRatePct}%</span>
          </div>
        </div>
      </button>

      {/* Credits in system */}
      <button
        onClick={() => onJumpTab("activity")}
        className="text-left p-3 rounded-2xl border border-white/[0.08] backdrop-blur-2xl transition hover:border-white/[0.16] hover:translate-y-[-1px]"
        style={{
          background: "linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
            <Coins className="w-3 h-3 text-amber-300" />
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400">Credits im System</span>
        </div>
        <div className="font-mono text-[26px] leading-none font-bold text-white tabular-nums">
          {(stats.credits?.sumBalance ?? 0).toLocaleString("de-DE")}
        </div>
        <div className="text-[10px] text-zinc-500 mt-1.5">
          gekauft: <span className="text-zinc-300">{(stats.credits?.sumTotalPurchased ?? 0).toLocaleString("de-DE")}</span> · verbraucht: <span className="text-zinc-300">{(stats.credits?.sumTotalUsed ?? 0).toLocaleString("de-DE")}</span>
        </div>
      </button>
    </div>
  );
}

// ─── Users View (role + tier management) ──────────────────────────

function UsersView({
  users, loading, search, setSearch, busyKey, tierConfig,
  autoRefresh, setAutoRefresh,
  onRefresh, onSetRole, onSetTier, onCancelTier, onImpersonate, onAdjustCredits,
}: {
  users: AdminUserRow[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  busyKey: string | null;
  tierConfig: AdminTier[];
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
  onRefresh: () => void;
  onSetRole: (key: string, role: AdminUserRole) => void | Promise<void>;
  onSetTier: (key: string, tier: AdminTierKey) => void | Promise<void>;
  onCancelTier: (key: string) => void | Promise<void>;
  onImpersonate: (key: string, email: string) => void | Promise<void>;
  onAdjustCredits: (key: string) => void | Promise<void>;
}) {
  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      u.lizenzschluessel.toLowerCase().includes(q) ||
      u.shopDomain.toLowerCase().includes(q) ||
      u.sku.toLowerCase().includes(q)
    );
  });

  const tierLabelMap = new Map(tierConfig.map((t) => [t.key, t.label]));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: E-Mail, License, Shop, SKU…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600"
          />
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          title="24/7 Live-Tracking — pollt alle 30s wenn Tab sichtbar ist."
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition ${
            autoRefresh
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
              : "bg-white/[0.04] border border-white/10 text-zinc-300"
          }`}
        >
          <Clock className="w-3 h-3" />
          Live {autoRefresh ? "AN" : "AUS"}
        </button>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      {/* Counts row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="text-[9px] uppercase tracking-[0.16em] text-zinc-500 font-bold">Total</div>
          <div className="text-lg font-bold tabular-nums">{users.length}</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-2.5">
          <div className="text-[9px] uppercase tracking-[0.16em] text-amber-300/80 font-bold">Admins</div>
          <div className="text-lg font-bold tabular-nums text-amber-200">{users.filter((u) => u.role === "admin").length}</div>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-2.5">
          <div className="text-[9px] uppercase tracking-[0.16em] text-red-300/80 font-bold">Blockiert</div>
          <div className="text-lg font-bold tabular-nums text-red-200">{users.filter((u) => u.blocked).length}</div>
        </div>
      </div>

      {/* User list (cards on mobile, dense rows on desktop) */}
      <div className="rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{ background: "rgba(10,10,12,0.6)", backdropFilter: "blur(24px) saturate(180%)" }}
      >
        {/* Header row (desktop) */}
        <div className="hidden lg:grid grid-cols-[1.4fr_1fr_0.6fr_0.7fr_0.8fr_0.9fr_auto] gap-2 px-3 py-2 border-b border-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-zinc-500 font-bold">
          <div>User</div>
          <div>License / Shop</div>
          <div>Rolle</div>
          <div>Tier</div>
          <div>Credits</div>
          <div>Signup</div>
          <div className="text-right">Aktionen</div>
        </div>

        {loading && users.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Lade User…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">Keine User gefunden.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {filtered.map((u) => {
              const busy = busyKey === u.lizenzschluessel;
              const tierLabel = u.tier ? (tierLabelMap.get(u.tier as AdminTierKey) || u.tier) : "";
              const isAdmin = u.role === "admin";
              const subActive = !!u.tier && !u.tierCanceledAt;
              return (
                <div
                  key={u.lizenzschluessel}
                  className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.6fr_0.7fr_0.8fr_0.9fr_auto] gap-2 px-3 py-2.5 items-center hover:bg-white/[0.02] transition"
                >
                  {/* User */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isAdmin && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                      {u.vip && !isAdmin && <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />}
                      <div className="text-[12px] font-semibold text-white truncate">{u.email || "—"}</div>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate font-mono">{u.lizenzschluessel}</div>
                  </div>

                  {/* License / Shop */}
                  <div className="min-w-0 hidden lg:block">
                    <div className="text-[11px] text-zinc-300 truncate">{u.shopDomain || "—"}</div>
                    <div className="text-[10px] text-zinc-500 truncate">SKU {u.sku || "—"}{u.blocked ? " · BLOCKIERT" : ""}</div>
                  </div>

                  {/* Role badge */}
                  <div>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isAdmin ? "bg-amber-500/15 border border-amber-500/30 text-amber-200" : "bg-white/[0.04] border border-white/[0.08] text-zinc-400"
                    }`}>
                      {isAdmin ? "Admin" : "User"}
                    </span>
                  </div>

                  {/* Tier */}
                  <div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      u.tier === "pro"
                        ? "bg-amber-500/15 border border-amber-500/30 text-amber-200"
                        : "bg-white/[0.04] border border-white/[0.08] text-zinc-400"
                    }`}>
                      {u.tier ? tierLabel : "Kein Plan"}
                    </span>
                    {u.tierCanceledAt && (
                      <span className="block text-[9px] text-red-400 mt-0.5">gekündigt</span>
                    )}
                  </div>

                  {/* Credits */}
                  <div className="text-right lg:text-left">
                    <div className="text-[12px] font-bold text-emerald-300 tabular-nums">{u.credits.balance.toLocaleString("de-DE")}c</div>
                    <div className="text-[9px] text-zinc-500 tabular-nums">−{u.credits.totalUsed} · +{u.credits.totalPurchased}</div>
                  </div>

                  {/* Signup */}
                  <div className="text-[10px] text-zinc-500 hidden lg:block">
                    {u.signupAt ? new Date(u.signupAt).toLocaleDateString("de-DE") : "—"}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-1 lg:justify-end">
                    {/* Tier dropdown */}
                    <select
                      disabled={busy || tierConfig.length === 0}
                      value={u.tier || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) onCancelTier(u.lizenzschluessel);
                        else onSetTier(u.lizenzschluessel, v as AdminTierKey);
                      }}
                      className="bg-white/[0.04] border border-white/[0.08] rounded text-[10px] px-1.5 py-1 outline-none focus:border-white/25"
                    >
                      <option value="">Kein Plan</option>
                      {tierConfig.length === 0 ? (
                        u.tier ? <option value={u.tier}>{u.tier}</option> : null
                      ) : (
                        tierConfig.map((t) => (
                          <option key={t.key} value={t.key}>{t.label} {t.priceMonthlyEur > 0 ? `· ${t.priceMonthlyEur}€` : ""}</option>
                        ))
                      )}
                    </select>
                    {subActive && (
                      <button
                        onClick={() => onCancelTier(u.lizenzschluessel)}
                        disabled={busy}
                        title="Tier kündigen"
                        className="p-1 rounded hover:bg-red-500/10 text-red-400 transition disabled:opacity-40"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {/* Role toggle */}
                    <button
                      onClick={() => onSetRole(u.lizenzschluessel, isAdmin ? "user" : "admin")}
                      disabled={busy}
                      title={isAdmin ? "Zum User zurückstufen" : "Zum Admin befördern"}
                      className={`p-1 rounded transition disabled:opacity-40 ${
                        isAdmin
                          ? "hover:bg-zinc-500/10 text-zinc-400"
                          : "hover:bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {isAdmin ? <UserCog className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                    </button>
                    {/* Adjust credits */}
                    <button
                      onClick={() => onAdjustCredits(u.lizenzschluessel)}
                      disabled={busy}
                      title="Credits manuell setzen"
                      className="p-1 rounded hover:bg-emerald-500/10 text-emerald-300 transition disabled:opacity-40"
                    >
                      <Coins className="w-3 h-3" />
                    </button>
                    {/* Impersonate */}
                    <button
                      onClick={() => onImpersonate(u.lizenzschluessel, u.email)}
                      disabled={busy}
                      title="In diesen Account einloggen"
                      className="p-1 rounded hover:bg-blue-500/10 text-blue-300 transition disabled:opacity-40"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    {busy && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-1" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── System-Logs view ────────────────────────────────────────────

function LogsView({
  entries, loading, filter, setFilter, onRefresh,
}: {
  entries: AdminLogEntry[];
  loading: boolean;
  filter: { level: "" | "info" | "warn" | "error" | "audit"; sinceDays: number; q: string };
  setFilter: (f: { level: "" | "info" | "warn" | "error" | "audit"; sinceDays: number; q: string }) => void;
  onRefresh: () => void;
}) {
  const colorFor = (lvl: string) => {
    if (lvl === "error") return { bg: "bg-red-500/10", border: "border-red-500/25", text: "text-red-300" };
    if (lvl === "warn") return { bg: "bg-amber-500/10", border: "border-amber-500/25", text: "text-amber-300" };
    if (lvl === "audit") return { bg: "bg-purple-500/10", border: "border-purple-500/25", text: "text-purple-300" };
    return { bg: "bg-blue-500/10", border: "border-blue-500/25", text: "text-blue-300" };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filter.level}
          onChange={(e) => setFilter({ ...filter, level: e.target.value as typeof filter.level })}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-white/25"
        >
          <option value="">Alle Level</option>
          <option value="audit">Audit</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <select
          value={filter.sinceDays}
          onChange={(e) => setFilter({ ...filter, sinceDays: Number(e.target.value) })}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-white/25"
        >
          <option value={1}>Letzte 24h</option>
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={0}>Alles</option>
        </select>
        <input
          type="text"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Filter Actor (E-Mail/Key)"
          className="flex-1 min-w-[160px] bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-white/25 placeholder:text-zinc-600"
        />
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
          Refresh
        </button>
      </div>

      {/* Entry list */}
      <div
        className="rounded-2xl border border-white/[0.08] overflow-hidden"
        style={{ background: "rgba(10,10,12,0.6)", backdropFilter: "blur(24px) saturate(180%)" }}
      >
        {loading && entries.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
            Lade Logs…
          </div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-xs text-zinc-500">Keine Einträge.</div>
        ) : (
          <div className="divide-y divide-white/[0.04] max-h-[70vh] overflow-y-auto">
            {entries.map((e) => {
              const c = colorFor(e.level);
              const detailKeys = Object.keys(e.details || {});
              return (
                <div key={e.id} className="px-3 py-2 hover:bg-white/[0.02] transition">
                  <div className="flex items-start gap-2">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${c.bg} ${c.border} ${c.text} border shrink-0`}>
                      {e.level}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold text-zinc-200 font-mono">{e.action}</span>
                        {e.target && (
                          <span className="text-[10px] text-zinc-500 font-mono truncate">→ {e.target}</span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{new Date(e.ts).toLocaleString("de-DE")}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="font-mono">{e.actor}</span>
                      </div>
                      {detailKeys.length > 0 && (
                        <div className="text-[10px] text-zinc-400 mt-1 font-mono break-all">
                          {detailKeys.slice(0, 4).map((k) => (
                            <span key={k} className="mr-2">
                              <span className="text-zinc-500">{k}=</span>
                              {String((e.details as Record<string, unknown>)[k]).slice(0, 60)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Tier-Settings editor — full schema (Tiers tab) ───────────────

const TIER_COLORS: Record<AdminTierKey, string> = {
  pro: "#F59E0B",
};

function TiersFullEditor({
  tiers, loading, saving, onSave,
}: {
  tiers: AdminTier[];
  loading: boolean;
  saving: boolean;
  onSave: (next: AdminTier[]) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<AdminTier[]>(tiers);
  const [openKey, setOpenKey] = useState<AdminTierKey | null>(null);
  const [imageBusyKey, setImageBusyKey] = useState<AdminTierKey | null>(null);
  const [imageError, setImageError] = useState<string>("");

  useEffect(() => {
    setDraft(tiers);
    if (!openKey && tiers.length) setOpenKey(tiers[0].key);
  }, [tiers, openKey]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(tiers);

  function patch(idx: number, patch: Partial<AdminTier>) {
    const next = [...draft];
    next[idx] = { ...next[idx], ...patch };
    setDraft(next);
  }

  async function uploadTierImage(idx: number, file: File) {
    setImageError("");
    setImageBusyKey(draft[idx].key);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setImageError(d.error || "Bild-Upload fehlgeschlagen.");
        return;
      }
      const data = await res.json();
      if (typeof data.url !== "string" || !data.url.startsWith("http")) {
        setImageError("Upload-Antwort ohne URL.");
        return;
      }
      patch(idx, { imageUrl: data.url });
    } catch {
      setImageError("Bild-Upload fehlgeschlagen.");
    } finally {
      setImageBusyKey(null);
    }
  }

  function patchFeature(idx: number, flag: FeatureFlag, value: boolean) {
    const next = [...draft];
    next[idx] = { ...next[idx], features: { ...next[idx].features, [flag]: value } };
    setDraft(next);
  }

  function patchLimit(idx: number, key: LimitKey, value: number) {
    const next = [...draft];
    next[idx] = { ...next[idx], limits: { ...next[idx].limits, [key]: value } };
    setDraft(next);
  }

  function patchBullet(idx: number, line: number, value: string) {
    const next = [...draft];
    const bullets = [...next[idx].bullets];
    bullets[line] = value;
    next[idx] = { ...next[idx], bullets };
    setDraft(next);
  }

  function addBullet(idx: number) {
    const next = [...draft];
    next[idx] = { ...next[idx], bullets: [...next[idx].bullets, ""] };
    setDraft(next);
  }

  function removeBullet(idx: number, line: number) {
    const next = [...draft];
    next[idx] = { ...next[idx], bullets: next[idx].bullets.filter((_, i) => i !== line) };
    setDraft(next);
  }

  if (loading && draft.length === 0) {
    return (
      <div className="text-xs text-zinc-500 flex items-center gap-2 p-6">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />Lade Abo-Konfiguration…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            Abo-Modelle &amp; Berechtigungen
          </h2>
          <p className="text-zinc-400 text-xs mt-1 max-w-2xl">
            Vollkontrolle pro Tier: Name, Preis, Credits, Limits und Feature-Berechtigungen.
            Änderungen wirken auf alle Kunden mit dem entsprechenden Tier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && !saving && (
            <button
              onClick={() => setDraft(tiers)}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
            >
              Zurücksetzen
            </button>
          )}
          <button
            onClick={() => onSave(draft)}
            disabled={!dirty || saving}
            className="btn-accent px-4 py-2 rounded-xl font-semibold flex items-center gap-2 text-xs disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Speichern
          </button>
        </div>
      </div>

      {/* Compact tier picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {draft.map((t) => {
          const isOpen = openKey === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setOpenKey(t.key)}
              className={`relative rounded-xl px-3 py-2.5 text-left border transition ${
                isOpen
                  ? "bg-white/[0.06] border-white/20"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
              }`}
              style={isOpen ? { boxShadow: `inset 3px 0 0 ${TIER_COLORS[t.key]}` } : undefined}
            >
              <div className="text-[9px] uppercase tracking-[0.16em] font-bold" style={{ color: TIER_COLORS[t.key] }}>
                {t.key}
              </div>
              <div className="text-sm font-bold mt-0.5 truncate">{t.label}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5 tabular-nums">
                {t.priceMonthlyEur > 0 ? `${t.priceMonthlyEur} €/Mo` : "kostenlos"}
              </div>
              {t.highlighted && (
                <span className="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  ★
                </span>
              )}
              {t.hidden && (
                <span className="absolute top-1 right-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                  hidden
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail editor for active tier */}
      {draft.map((t, idx) => {
        if (t.key !== openKey) return null;
        return (
          <motion.div
            key={t.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Identity & Marketing */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Identität &amp; Marketing</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Anzeigename</label>
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => patch(idx, { label: e.target.value })}
                    placeholder="Brospify Membership"
                    maxLength={40}
                    className="input-glass w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">CTA-Text</label>
                  <input
                    type="text"
                    value={t.ctaLabel}
                    onChange={(e) => patch(idx, { ctaLabel: e.target.value })}
                    placeholder="Jetzt buchen"
                    maxLength={40}
                    className="input-glass w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">
                  Button-Link (CTA-URL)
                </label>
                <input
                  type="text"
                  value={t.ctaUrl || ""}
                  onChange={(e) => patch(idx, { ctaUrl: e.target.value })}
                  placeholder="https://shop.beispiel.de/checkout/abo  ODER  /credits?plan=pro"
                  maxLength={600}
                  className="input-glass w-full text-xs font-mono"
                />
                <p className="text-[9px] text-zinc-600 mt-1">
                  Wohin der Button auf der Abo-Seite führt. Externe Links (https://…) öffnen in neuem Tab.
                  Leer = Fallback auf <span className="font-mono">/credits</span>.
                </p>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Tagline (1 Zeile)</label>
                <input
                  type="text"
                  value={t.tagline}
                  onChange={(e) => patch(idx, { tagline: e.target.value })}
                  placeholder="Für ambitionierte Stores"
                  maxLength={80}
                  className="input-glass w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Beschreibung</label>
                <textarea
                  value={t.description}
                  onChange={(e) => patch(idx, { description: e.target.value })}
                  rows={2}
                  placeholder="Längere Beschreibung für die Pricing-Seite"
                  maxLength={500}
                  className="input-glass w-full resize-none text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={t.highlighted}
                    onChange={(e) => patch(idx, { highlighted: e.target.checked })}
                    className="w-4 h-4 accent-amber-500"
                  />
                  „Most popular"-Badge
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={t.hidden}
                    onChange={(e) => patch(idx, { hidden: e.target.checked })}
                    className="w-4 h-4 accent-red-500"
                  />
                  Auf Pricing-Seite verstecken (intern)
                </label>
              </div>
            </div>

            {/* Plan-Bild */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5" />
                Plan-Bild
              </h3>
              <p className="text-[10px] text-zinc-500 leading-snug">
                Wird auf der öffentlichen Abo-Seite als Karten-Hero angezeigt. Quer-Format empfohlen (16:9).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3 items-start">
                <div
                  className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-white/10"
                  style={{
                    background: t.imageUrl
                      ? "transparent"
                      : `linear-gradient(135deg, ${TIER_COLORS[t.key]}30 0%, ${TIER_COLORS[t.key]}08 100%)`,
                  }}
                >
                  {t.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={t.imageUrl} alt={t.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-1">
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-[9px] uppercase tracking-wider">Kein Bild</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block cursor-pointer">
                    <span className="flex items-center justify-center gap-2 px-3 py-2 glass hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium transition">
                      {imageBusyKey === t.key
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Upload className="w-3.5 h-3.5" />}
                      {t.imageUrl ? "Bild ersetzen" : "Bild hochladen"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadTierImage(idx, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <input
                    type="text"
                    value={t.imageUrl || ""}
                    onChange={(e) => patch(idx, { imageUrl: e.target.value })}
                    placeholder="Oder direkte Bild-URL"
                    className="input-glass w-full text-[10px] font-mono"
                  />
                  {t.imageUrl && (
                    <button
                      onClick={() => patch(idx, { imageUrl: "" })}
                      className="text-[10px] text-red-400 hover:text-red-300 transition"
                    >
                      Bild entfernen
                    </button>
                  )}
                  {imageError && imageBusyKey === null && (
                    <p className="text-[10px] text-red-400">{imageError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                <Euro className="w-3.5 h-3.5" />
                Preise &amp; Trial
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Monatlich (€)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={t.priceMonthlyEur}
                    onChange={(e) => patch(idx, { priceMonthlyEur: Number(e.target.value) || 0 })}
                    className="input-glass w-full text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Jährlich (€)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={t.priceYearlyEur}
                    onChange={(e) => patch(idx, { priceYearlyEur: Number(e.target.value) || 0 })}
                    className="input-glass w-full text-sm tabular-nums"
                  />
                  <p className="text-[9px] text-zinc-600 mt-0.5">0 = keine jährliche Option</p>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Trial (Tage)</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={t.trialDays}
                    onChange={(e) => patch(idx, { trialDays: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="input-glass w-full text-sm tabular-nums"
                  />
                  <p className="text-[9px] text-zinc-600 mt-0.5">0 = kein Trial</p>
                </div>
              </div>
            </div>

            {/* Credits */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                <Coins className="w-3.5 h-3.5" />
                Credits
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Start-Credits (einmalig)</label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={t.startingCredits}
                    onChange={(e) => patch(idx, { startingCredits: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="input-glass w-full text-sm tabular-nums"
                  />
                  <p className="text-[9px] text-zinc-600 mt-0.5">Bei erster Tier-Aktivierung</p>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Monatliches Allowance</label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={t.monthlyCreditAllowance}
                    onChange={(e) => patch(idx, { monthlyCreditAllowance: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                    className="input-glass w-full text-sm tabular-nums"
                  />
                  <p className="text-[9px] text-zinc-600 mt-0.5">Wiederkehrend pro Abrechnung</p>
                </div>
              </div>
            </div>

            {/* Limits */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Limits
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  <code className="bg-white/[0.04] px-1 py-0.5 rounded">-1</code> = unbegrenzt
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                {LIMIT_KEYS.map((lk) => (
                  <div key={lk} className="flex items-center justify-between gap-2">
                    <label className="text-[11px] text-zinc-300 flex-1 truncate">{LIMIT_LABELS[lk]}</label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => patchLimit(idx, lk, t.limits[lk] === -1 ? 0 : -1)}
                        className={`text-[9px] px-1.5 py-1 rounded uppercase tracking-wider font-bold transition ${
                          t.limits[lk] === -1
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/[0.04] border border-white/10 text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        ∞
                      </button>
                      <input
                        type="number"
                        min={-1}
                        step="1"
                        value={t.limits[lk]}
                        onChange={(e) => patchLimit(idx, lk, Math.round(Number(e.target.value) || 0))}
                        disabled={t.limits[lk] === -1}
                        className="input-glass w-20 text-xs tabular-nums text-right disabled:opacity-40"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Berechtigungen / Features
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                {FEATURE_FLAGS.map((flag) => {
                  const enabled = t.features[flag];
                  return (
                    <label
                      key={flag}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition ${
                        enabled
                          ? "bg-emerald-500/[0.08] border border-emerald-500/15"
                          : "bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className={`text-[11px] truncate ${enabled ? "text-emerald-200" : "text-zinc-400"}`}>
                        {FEATURE_LABELS[flag]}
                      </span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => patchFeature(idx, flag, e.target.checked)}
                        className="w-4 h-4 accent-emerald-500 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bullets */}
            <div className="glass-strong rounded-2xl border border-white/10 p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    Pricing-Bullets
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Stichpunkte unter dem Preis auf der Pricing-Seite</p>
                </div>
                <button
                  onClick={() => addBullet(idx)}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Hinzufügen
                </button>
              </div>

              <div className="space-y-1.5">
                {t.bullets.map((b, line) => (
                  <div key={line} className="flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => patchBullet(idx, line, e.target.value)}
                      placeholder={`Bullet #${line + 1}`}
                      maxLength={120}
                      className="input-glass flex-1 text-xs"
                    />
                    <button
                      onClick={() => removeBullet(idx, line)}
                      className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-red-400 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {t.bullets.length === 0 && (
                  <p className="text-[10px] text-zinc-600 italic">Noch keine Bullets — klicke „Hinzufügen".</p>
                )}
              </div>
            </div>

            {/* Sticky save bar */}
            {dirty && (
              <div className="sticky bottom-3 flex items-center justify-end gap-2 glass-strong border border-amber-500/20 rounded-xl px-3 py-2.5 backdrop-blur-md">
                <span className="text-[11px] text-amber-300">Ungespeicherte Änderungen</span>
                <button
                  onClick={() => setDraft(tiers)}
                  className="text-[11px] text-zinc-400 hover:text-zinc-200 px-3 py-1.5"
                >
                  Verwerfen
                </button>
                <button
                  onClick={() => onSave(draft)}
                  disabled={saving}
                  className="btn-accent px-4 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Speichern
                </button>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Backfill 500-Starter-Credits card (System tab) ───────────────
// Manueller Trigger für den gleichen Endpoint, den der stündliche
// Vercel-Cron pingt. Zeigt Ergebnis (gescannt / vergeben / errors).
// Bestehende Balances bleiben unangetastet — der Grant ist additiv.

// ─── Umfragen-Auswertung (Tab "survey") ─────────────────────────
interface AdminSurveyItem {
  id: string;
  title: string;
  creditReward: number;
  unlockAfterDays: number;
  questions: SurveyQuestion[];
  aggregate: SurveyAggregate;
  responses: SurveyResponseRecord[];
}

function SurveyAdminView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<AdminSurveyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/survey", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Konnte nicht laden.");
      } else {
        const list: AdminSurveyItem[] = Array.isArray(data.surveys) ? data.surveys : [];
        setItems(list);
        setTotal(data.totalResponses || 0);
        setSelectedId((cur) => cur || (list[0]?.id ?? ""));
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && items.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-white/[0.06] bg-white/[0.02] animate-pulse" />
        ))}
      </div>
    );
  }

  const selected = items.find((s) => s.id === selectedId) || null;
  const fmtUser = (u: string) => (u.includes("@") ? u : `${u.slice(0, 4)}…${u.slice(-4)}`);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500">
          Gestaffelte Umfragen · {total} Antworten gesamt · pro Umfrage Gesamtergebnis &amp; einzelne Abgaben.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Aktualisieren
        </button>
      </div>

      {error && <div className="text-[12px] text-red-300">{error}</div>}

      {/* Umfrage-Auswahl */}
      <div className="flex flex-wrap gap-1.5">
        {items.map((s) => {
          const active = s.id === selectedId;
          return (
            <button
              key={s.id}
              onClick={() => { setSelectedId(s.id); setShowAll(false); }}
              className={`px-2.5 py-1.5 rounded-lg border text-[11.5px] transition ${
                active ? "border-pink-500/50 bg-pink-500/15 text-white" : "border-white/10 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]"
              }`}
            >
              {s.title} <span className="text-zinc-500 tabular-nums">· {s.aggregate.total}</span>
            </button>
          );
        })}
      </div>

      {!selected ? (
        <div className="text-center py-10 text-sm text-zinc-500">Keine Umfragen.</div>
      ) : selected.aggregate.total === 0 ? (
        <div className="text-center py-10 text-sm text-zinc-500">Noch keine Antworten für „{selected.title}".</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <BigKpi label="Antworten" value={selected.aggregate.total} icon={MessageCircle} color="#EC4899" />
            <BigKpi label="Belohnung" value={`${selected.creditReward}`} icon={Coins} color="#FACC15" hint="Credits / Abgabe" />
            {selected.questions.filter((q) => q.type === "rating").slice(0, 2).map((q) => (
              <BigKpi
                key={q.id}
                label={`Ø ${q.label.replace(/\?$/, "").slice(0, 22)}`}
                value={selected.aggregate.ratingAvg[q.id] != null ? `${selected.aggregate.ratingAvg[q.id]}/5` : "—"}
                icon={Star}
                color="#10B981"
              />
            ))}
          </div>

          {/* Aggregat je Frage */}
          {selected.questions.map((q) => {
            if (q.type === "rating") {
              const avg = selected.aggregate.ratingAvg[q.id];
              return (
                <DashboardCard key={q.id} title={q.label} icon={Star} accent="#10B981">
                  <div className="text-[13px] text-zinc-200">
                    Ø <span className="font-bold text-white">{avg != null ? `${avg} / 5` : "—"}</span>
                  </div>
                </DashboardCard>
              );
            }
            if (q.type === "text") {
              const texts = selected.aggregate.texts[q.id] || [];
              return (
                <DashboardCard key={q.id} title={q.label} icon={MessageCircle} accent="#EC4899">
                  {texts.length === 0 ? (
                    <p className="text-[12px] text-zinc-500">Keine Freitext-Antworten.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                      {texts.map((t, i) => (
                        <div key={i} className="text-[12px] text-zinc-300 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05] leading-snug">
                          „{t}"
                        </div>
                      ))}
                    </div>
                  )}
                </DashboardCard>
              );
            }
            const counts = selected.aggregate.optionCounts[q.id] || {};
            const max = Math.max(1, ...Object.values(counts));
            return (
              <DashboardCard key={q.id} title={q.label} icon={BarChart3} accent="#A855F7">
                <div className="space-y-1.5">
                  {(q.options || []).map((o) => {
                    const c = counts[o] || 0;
                    const pct = selected.aggregate.total > 0 ? Math.round((c / selected.aggregate.total) * 100) : 0;
                    return (
                      <div key={o} className="flex items-center gap-2">
                        <span className="text-[11.5px] text-zinc-300 w-44 shrink-0 truncate">{o}</span>
                        <div className="flex-1 h-4 rounded bg-white/[0.04] overflow-hidden">
                          <div className="h-full rounded bg-purple-500/50" style={{ width: `${Math.round((c / max) * 100)}%` }} />
                        </div>
                        <span className="text-[11px] text-zinc-400 tabular-nums w-16 text-right shrink-0">{c} · {pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </DashboardCard>
            );
          })}

          {/* Einzelne Abgaben */}
          <DashboardCard title={`Einzelne Abgaben (${selected.responses.length})`} icon={Users} accent="#06B6D4">
            <div className="space-y-2">
              {(showAll ? selected.responses : selected.responses.slice(0, 10)).map((r) => (
                <div key={r.id} className="px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-mono text-zinc-400 truncate">{fmtUser(r.user)}</span>
                    <span className="text-[10px] text-zinc-600 shrink-0">{r.submittedAt ? formatRelativeShort(r.submittedAt) : "—"}</span>
                  </div>
                  <div className="space-y-0.5">
                    {selected.questions.map((q) => {
                      const v = r.answers[q.id];
                      if (v === undefined) return null;
                      const display = Array.isArray(v) ? v.join(", ") : q.type === "rating" ? `${v}/5` : String(v);
                      return (
                        <div key={q.id} className="text-[11px] text-zinc-400 leading-snug">
                          <span className="text-zinc-600">{q.label.replace(/\?$/, "")}: </span>
                          <span className="text-zinc-200">{display}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {selected.responses.length > 10 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="mt-2 text-[11px] text-zinc-400 hover:text-white transition"
              >
                {showAll ? "Weniger zeigen" : `Alle ${selected.responses.length} zeigen`}
              </button>
            )}
          </DashboardCard>
        </>
      )}
    </div>
  );
}

function BackfillStarterCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    scanned: number;
    granted: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function run() {
    if (running) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/credits/backfill-starter", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Backfill fehlgeschlagen.");
      } else {
        setResult({
          scanned: data.scanned,
          granted: data.granted,
          skipped: data.skipped,
          errors: data.errors,
        });
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-emerald-500/15 p-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(149,191,71,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
          <Coins className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">Starter-Credits Sync (500c)</h3>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/25 rounded px-1.5 py-0.5">
              Cron · täglich 03:00 UTC
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
            Vergibt jedem Profil ohne `starterGranted=true` die 500
            Willkommens-Credits. Bestehende Balances werden nie
            überschrieben — der Bonus wird draufgerechnet. Läuft 1×
            täglich via Vercel Cron (Hobby-Limit), zusätzlich bei jedem
            Login automatisch und hier per Klick auf Knopfdruck.
          </p>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Setze <span className="font-mono text-zinc-400">CRON_SECRET</span> in den
            Vercel-Env-Vars, damit der Cron-Job zugreifen darf. Für
            häufigeres Syncen: externer Uptime-Monitor (UptimeRobot,
            cron-job.org) der diese URL pingt — oder Vercel Pro.
          </p>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button
              onClick={run}
              disabled={running}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
              Jetzt syncen
            </button>
            {result && (
              <div className="text-[11px] text-zinc-300 flex items-center gap-2 flex-wrap">
                <span><span className="text-zinc-500">Gescannt:</span> <span className="font-bold tabular-nums">{result.scanned}</span></span>
                <span><span className="text-zinc-500">Vergeben:</span> <span className="font-bold tabular-nums text-emerald-300">{result.granted}</span></span>
                <span><span className="text-zinc-500">Übersprungen:</span> <span className="font-bold tabular-nums">{result.skipped}</span></span>
                {result.errors > 0 && (
                  <span><span className="text-zinc-500">Fehler:</span> <span className="font-bold tabular-nums text-red-300">{result.errors}</span></span>
                )}
              </div>
            )}
            {error && (
              <span className="text-[11px] text-red-300">{error}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Video-Scout-Cache card (System tab) ────────────────────────
// Zeigt den gemeinsamen Produkt-Video-Cache + den wöchentlichen Link-
// Prune (tote Videos raus). Lädt Status beim Öffnen, "Jetzt prüfen"
// erzwingt einen Lauf.
interface ScoutCacheStatusT {
  products: number;
  videos: number;
  lastFullRunAt: string | null;
  lastRunAt: string | null;
  lastChecked: number;
  lastRemoved: number;
  totalRemoved: number;
  inProgress: boolean;
  nextDueAt: string | null;
}

function ScoutCacheCard() {
  const [status, setStatus] = useState<ScoutCacheStatusT | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/scout-cache", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Konnte nicht laden.");
      else setStatus(data.status);
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    if (running) return;
    setRunning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/scout-cache", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Prüfung fehlgeschlagen.");
      else setStatus(data.status);
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-pink-500/15 p-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(236,72,153,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center shrink-0">
          <Video className="w-4 h-4 text-pink-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">Video-Scout-Cache</h3>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-pink-300/80 bg-pink-500/10 border border-pink-500/25 rounded px-1.5 py-0.5">
              Link-Prune · wöchentlich
            </span>
            {status?.inProgress && (
              <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-amber-300/80 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5">
                Durchlauf läuft
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
            Gemeinsamer Pool gefundener Videos pro Produkt — spart Apify-Kosten,
            weil der nächste Kunde mit demselben Produkt daraus bedient wird. Tote
            Links werden 1×/Woche geprüft und aus dem Cache entfernt; bereits beim
            Kunden gespeicherte Videos bleiben (nur der Link geht dann ins Leere).
          </p>

          {status && (
            <div className="grid grid-cols-3 gap-2 mt-2.5">
              <div className="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Produkte</div>
                <div className="text-[15px] font-bold tabular-nums text-white">{status.products}</div>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Videos im Cache</div>
                <div className="text-[15px] font-bold tabular-nums text-white">{status.videos}</div>
              </div>
              <div className="px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Tote entfernt (ges.)</div>
                <div className="text-[15px] font-bold tabular-nums text-pink-300">{status.totalRemoved}</div>
              </div>
            </div>
          )}

          {status && (
            <div className="text-[10.5px] text-zinc-500 mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                Zuletzt geprüft:{" "}
                <span className="text-zinc-300">
                  {status.lastRunAt ? formatRelativeShort(status.lastRunAt) : "noch nie"}
                </span>
              </span>
              {status.lastRunAt && (
                <span>
                  dabei entfernt: <span className="text-zinc-300 tabular-nums">{status.lastRemoved}</span> /{" "}
                  <span className="tabular-nums">{status.lastChecked}</span> geprüft
                </span>
              )}
              <span>
                Nächster Voll-Lauf:{" "}
                <span className="text-zinc-300">
                  {status.inProgress
                    ? "läuft (setzt täglich fort)"
                    : status.nextDueAt
                      ? formatRelativeShort(status.nextDueAt)
                      : "beim nächsten Cron"}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button
              onClick={runNow}
              disabled={running || loading}
              className="px-3 py-1.5 rounded-lg bg-pink-500/15 border border-pink-500/30 text-pink-200 text-xs font-semibold hover:bg-pink-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
              Jetzt prüfen
            </button>
            <button
              onClick={load}
              disabled={loading || running}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
              Status
            </button>
            {error && <span className="text-[11px] text-red-300">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── License Sync API card (System tab) ─────────────────────────
// Renders the Make.com integration surface: endpoint URLs,
// reveal-on-click WRITE key, copyable JSON body, and a manual
// trigger for the expire-overdue cron. Keys are pulled from
// /api/admin/license/info on demand — never SSR'd — so they don't
// sit in the page HTML during normal admin navigation.

function LicenseSyncCard() {
  const [info, setInfo] = useState<{
    baseUrl: string;
    apiKey: string;
    writeKey: string;
    endpoints: { validate: string; sync: string; issue: string; cancel: string; expireOverdue: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [revealedWrite, setRevealedWrite] = useState(false);
  const [revealedRead, setRevealedRead] = useState(false);
  const [copied, setCopied] = useState<string>("");
  const [expireRunning, setExpireRunning] = useState(false);
  const [expireResult, setExpireResult] = useState<{
    checked: number;
    expired: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState("");

  async function loadInfo() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/license/info");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Konnte License-Info nicht laden.");
      } else {
        setInfo(data);
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // best-effort; some browsers block in non-https contexts
    }
  }

  async function runExpire() {
    if (expireRunning) return;
    setExpireRunning(true);
    setExpireResult(null);
    setError("");
    try {
      const res = await fetch("/api/admin/license/expire-overdue", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Expire-Pass fehlgeschlagen.");
      } else {
        setExpireResult({ checked: data.checked, expired: data.expired, errors: data.errors });
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setExpireRunning(false);
    }
  }

  const writeKey = info?.writeKey || "";
  const readKey = info?.apiKey || "";
  const maskedWriteKey = writeKey
    ? writeKey.slice(0, 4) + "•".repeat(Math.max(0, writeKey.length - 8)) + writeKey.slice(-4)
    : "";
  const maskedReadKey = readKey
    ? readKey.slice(0, 4) + "•".repeat(Math.max(0, readKey.length - 8)) + readKey.slice(-4)
    : "";

  const sampleBody = JSON.stringify(
    {
      lizenzschluessel: "ABC-123-XYZ",
      kundenEmail: "kunde@shop.de",
      shopDomain: "kunde.myshopify.com",
      bestellnummer: "1024",
      sku: "BROSPIFY-SILBER",
      charge: "29.00",
      status: "aktiv",
      subscriptionEndsAt: "2026-12-31",
    },
    null,
    2,
  );

  return (
    <div
      className="rounded-2xl border border-blue-500/15 p-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
          <Power className="w-4 h-4 text-blue-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">License Sync API (Make.com)</h3>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-blue-300/80 bg-blue-500/10 border border-blue-500/25 rounded px-1.5 py-0.5">
              Cron · täglich 03:30 UTC
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
            Statt direkt ins Google Sheet schreibt Make.com hier per HTTP-Modul rein.
            Hub validiert, mergt das Profil (Credits/Rolle/Tier bleiben unangetastet)
            und stempelt <span className="font-mono text-zinc-300">subscriptionEndsAt</span>.
            Die Theme-Seite fragt 24/7 via <span className="font-mono text-zinc-300">/validate</span>
            den aktuellen Stand ab — abgelaufene Abos werden live abgelehnt und nachts
            zusätzlich im Sheet auf <span className="font-mono text-zinc-300">abgelaufen</span> geflippt.
          </p>

          {/* ── Endpoint URLs ── */}
          {info && (
            <div className="mt-3 space-y-1.5">
              {[
                { label: "Issue (Flow → Hub)", url: info.endpoints.issue, method: "POST" },
                { label: "Sync (Upsert)", url: info.endpoints.sync, method: "POST" },
                { label: "Cancel", url: info.endpoints.cancel, method: "POST" },
                { label: "Validate (Theme)", url: info.endpoints.validate, method: "GET" },
              ].map((ep) => (
                <div
                  key={ep.label}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500 w-12 shrink-0">
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-zinc-500">{ep.label}</div>
                    <div className="text-[11px] font-mono text-zinc-200 truncate">{ep.url || "—"}</div>
                  </div>
                  <button
                    onClick={() => copy(ep.url, ep.label)}
                    disabled={!ep.url}
                    className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-30 shrink-0"
                  >
                    {copied === ep.label ? "✓ Kopiert" : "Kopieren"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── WRITE Key (Make.com / Shopify Flow) ── */}
          {info && (
            <div className="mt-3 px-2 py-2 rounded-md bg-amber-500/[0.04] border border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-300/80 shrink-0">
                  WRITE · X-Api-Key
                </span>
                <code className="flex-1 text-[11px] font-mono text-zinc-200 truncate">
                  {writeKey
                    ? revealedWrite
                      ? writeKey
                      : maskedWriteKey
                    : <span className="text-red-300">nicht konfiguriert</span>}
                </code>
                <button
                  onClick={() => setRevealedWrite((v) => !v)}
                  disabled={!writeKey}
                  className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-30 shrink-0 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {revealedWrite ? "Verstecken" : "Anzeigen"}
                </button>
                <button
                  onClick={() => copy(writeKey, "writeKey")}
                  disabled={!writeKey}
                  className="px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-200 font-semibold hover:bg-amber-500/25 transition disabled:opacity-30 shrink-0"
                >
                  {copied === "writeKey" ? "✓" : "Key kopieren"}
                </button>
              </div>
              <p className="text-[9px] text-zinc-500 mt-1.5 leading-snug">
                Für Make.com (HTTP-Modul) und Shopify Flow (HTTP-Request) als
                <span className="font-mono"> X-Api-Key</span> Header.
                NIE in einem Storefront-Theme oder öffentlichen Code verwenden.
              </p>
            </div>
          )}

          {/* ── READ Key (Shopify Theme license-check.liquid) ── */}
          {info && (
            <div className="mt-2 px-2 py-2 rounded-md bg-cyan-500/[0.04] border border-cyan-500/20">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-300/80 shrink-0">
                  READ · ?apikey=
                </span>
                <code className="flex-1 text-[11px] font-mono text-zinc-200 truncate">
                  {readKey
                    ? revealedRead
                      ? readKey
                      : maskedReadKey
                    : <span className="text-red-300">nicht konfiguriert</span>}
                </code>
                <button
                  onClick={() => setRevealedRead((v) => !v)}
                  disabled={!readKey}
                  className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-[10px] text-zinc-300 hover:bg-white/[0.08] transition disabled:opacity-30 shrink-0 flex items-center gap-1"
                >
                  <Eye className="w-3 h-3" />
                  {revealedRead ? "Verstecken" : "Anzeigen"}
                </button>
                <button
                  onClick={() => copy(readKey, "readKey")}
                  disabled={!readKey}
                  className="px-2 py-1 rounded bg-cyan-500/15 border border-cyan-500/30 text-[10px] text-cyan-200 font-semibold hover:bg-cyan-500/25 transition disabled:opacity-30 shrink-0"
                >
                  {copied === "readKey" ? "✓" : "Key kopieren"}
                </button>
              </div>
              <p className="text-[9px] text-zinc-500 mt-1.5 leading-snug">
                Wird in <span className="font-mono">snippets/license-check.liquid</span> des Shopify-Themes
                als Query-Param <span className="font-mono">?apikey=…</span> an
                <span className="font-mono"> /validate</span> gehängt. Steht im Storefront-HTML —
                schützt nur gegen zufälliges Scraping, nicht gegen gezielte Angriffe.
              </p>
            </div>
          )}

          {/* ── Sample Make.com body ── */}
          {info && (
            <details className="mt-3 group">
              <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 group-open:rotate-90 transition" />
                Make.com Beispiel-Body (JSON)
              </summary>
              <div className="mt-2 relative">
                <pre className="text-[10px] font-mono text-zinc-300 bg-black/30 border border-white/[0.06] rounded-lg p-2.5 overflow-x-auto leading-relaxed">
                  {sampleBody}
                </pre>
                <button
                  onClick={() => copy(sampleBody, "body")}
                  className="absolute top-1.5 right-1.5 px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-[9px] text-zinc-300 hover:bg-white/[0.12] transition"
                >
                  {copied === "body" ? "✓ Kopiert" : "Kopieren"}
                </button>
              </div>
              <p className="text-[9px] text-zinc-500 mt-1.5 leading-snug">
                Nur <span className="font-mono">lizenzschluessel</span> ist Pflicht.
                Felder die du weglässt werden bei Update nicht überschrieben.
                <span className="font-mono">subscriptionEndsAt</span> akzeptiert <span className="font-mono">YYYY-MM-DD</span> oder ISO-Timestamp.
              </p>
            </details>
          )}

          {/* ── Manual cron trigger ── */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button
              onClick={runExpire}
              disabled={expireRunning}
              className="px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-200 text-xs font-semibold hover:bg-blue-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {expireRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
              Abgelaufene Abos jetzt prüfen
            </button>
            {expireResult && (
              <div className="text-[11px] text-zinc-300 flex items-center gap-2 flex-wrap">
                <span>
                  <span className="text-zinc-500">Geprüft:</span>{" "}
                  <span className="font-bold tabular-nums">{expireResult.checked}</span>
                </span>
                <span>
                  <span className="text-zinc-500">Abgelaufen:</span>{" "}
                  <span className="font-bold tabular-nums text-amber-300">{expireResult.expired}</span>
                </span>
                {expireResult.errors > 0 && (
                  <span>
                    <span className="text-zinc-500">Fehler:</span>{" "}
                    <span className="font-bold tabular-nums text-red-300">{expireResult.errors}</span>
                  </span>
                )}
              </div>
            )}
            {error && <span className="text-[11px] text-red-300">{error}</span>}
            {loading && !info && (
              <span className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Lade Endpoint-Info…
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shopify Webhook + Resend setup card (System tab) ──────────
// Step-by-step UI for the direct webhook integration: Shopify
// posts orders/paid directly to the Hub, the Hub generates the
// licence and sends the email via Resend. No Make, no Flow.
//
// The card surfaces:
//   • Resend env-var status (key + from-address)
//   • Shopify webhook URL to paste
//   • Webhook signing-secret env-var status
//   • Step-by-step what the merchant clicks in Shopify Admin

function ShopifyWebhookSetupCard() {
  const [info, setInfo] = useState<{
    baseUrl: string;
    writeKey: string;
    shopifyWebhookSecretConfigured: boolean;
    resendConfigured: boolean;
    resendFromEmail: string;
    endpoints: { issue: string; shopifyWebhook: string };
  } | null>(null);
  const [copied, setCopied] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/license/info");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setInfo(data);
      } catch {
        // best-effort; card stays in skeleton state on failure
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked in non-https; ignore */
    }
  }

  const webhookUrl = info?.endpoints.shopifyWebhook || "";
  const resendOk = info?.resendConfigured === true;
  const secretOk = info?.shopifyWebhookSecretConfigured === true;
  const ready = resendOk && secretOk;

  return (
    <div
      className="rounded-2xl border border-purple-500/15 p-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(168,85,247,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
          <Wand2 className="w-4 h-4 text-purple-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">Shopify Direct Webhook + Resend</h3>
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold text-purple-300/80 bg-purple-500/10 border border-purple-500/25 rounded px-1.5 py-0.5">
              Vollautomatik · ersetzt Make
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
            Shopify postet bei jedem Order-Paid Event direkt an den Hub.
            Hub validiert HMAC, generiert Lizenz, schreibt Sheet-Zeile,
            sendet automatisch die E-Mail mit dem Key via Resend.
            Kein Make, kein Flow, kein zweites Tool zum kaputtgehen.
          </p>

          {/* Status strip */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div
              className={`px-2.5 py-1.5 rounded-lg border ${
                secretOk
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${secretOk ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Shopify Secret
                </span>
              </div>
              <div className={`text-[10px] mt-0.5 ${secretOk ? "text-emerald-300" : "text-red-300"}`}>
                {secretOk ? "✓ konfiguriert" : "SHOPIFY_WEBHOOK_SECRET fehlt"}
              </div>
            </div>
            <div
              className={`px-2.5 py-1.5 rounded-lg border ${
                resendOk
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${resendOk ? "bg-emerald-400" : "bg-red-400"}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Resend</span>
              </div>
              <div className={`text-[10px] mt-0.5 ${resendOk ? "text-emerald-300" : "text-red-300"}`}>
                {resendOk
                  ? `✓ ${info?.resendFromEmail}`
                  : "RESEND_API_KEY + FROM_EMAIL fehlen"}
              </div>
            </div>
          </div>

          {ready && (
            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5">
              <Check className="w-3 h-3" />
              Setup vollständig — Hub ist bereit für Shopify-Webhooks.
            </div>
          )}

          {/* Step 1 — Resend */}
          <div className="mt-3 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-300/80 bg-purple-500/10 border border-purple-500/25 rounded px-1.5 py-0.5">
                Schritt 1
              </span>
              <span className="text-[11px] font-semibold">Resend einrichten (einmalig, ~5 Min)</span>
              {resendOk && <Check className="w-3 h-3 text-emerald-400" />}
            </div>
            <ol className="text-[10px] text-zinc-500 leading-snug list-decimal pl-4 space-y-0.5">
              <li>
                Auf <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-purple-300 underline">resend.com</a> kostenlos registrieren.
              </li>
              <li>
                Domain hinzufügen: <span className="font-mono text-zinc-400">brospify.com</span> — Resend zeigt
                3 DNS-Records (SPF, DKIM, MX), die du im DNS-Provider hinterlegst.
              </li>
              <li>Verifizierung abwarten (meist 1-2 Min).</li>
              <li>
                API Keys → Create API Key → kopieren → in <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-purple-300 underline">Vercel</a>
                {" "}als <span className="font-mono text-zinc-300">RESEND_API_KEY</span> setzen.
              </li>
              <li>
                Zusätzlich in Vercel setzen: <span className="font-mono text-zinc-300">RESEND_FROM_EMAIL</span>
                {" "}= <span className="font-mono text-zinc-300">noreply@brospify.com</span> (oder eine andere
                Adresse auf der verifizierten Domain).
              </li>
            </ol>
          </div>

          {/* Step 2 — Shopify Webhook */}
          <div className="mt-2 px-2.5 py-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-purple-300/80 bg-purple-500/10 border border-purple-500/25 rounded px-1.5 py-0.5">
                Schritt 2
              </span>
              <span className="text-[11px] font-semibold">Shopify Webhook anlegen</span>
              {secretOk && <Check className="w-3 h-3 text-emerald-400" />}
            </div>
            <ol className="text-[10px] text-zinc-500 leading-snug list-decimal pl-4 space-y-0.5">
              <li>
                Shopify Admin (brospify.com) → <span className="font-mono text-zinc-300">Settings</span>
                {" "}→ <span className="font-mono text-zinc-300">Notifications</span> → ganz unten
                <span className="font-mono text-zinc-300"> Webhooks</span> Section.
              </li>
              <li>Klick <span className="font-mono text-zinc-300">Create webhook</span>.</li>
              <li>
                Event: <span className="font-mono text-zinc-300">Order payment</span>{" "}
                (manchmal auch <span className="font-mono text-zinc-300">Order paid</span> genannt) ·
                Format: <span className="font-mono text-zinc-300">JSON</span>
              </li>
              <li>
                URL: untenstehende Webhook-URL kopieren und einfügen.
              </li>
              <li>
                Webhook speichern. Shopify zeigt einmalig einen <b>Signing Secret</b> an —
                kopieren und in Vercel als <span className="font-mono text-zinc-300">SHOPIFY_WEBHOOK_SECRET</span> setzen.
              </li>
            </ol>

            {/* Webhook URL */}
            <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-amber-500/[0.04] border border-amber-500/20">
              <span className="text-[9px] uppercase tracking-widest font-bold text-amber-300/80 w-20 shrink-0">
                Webhook URL
              </span>
              <code className="flex-1 text-[10px] font-mono text-zinc-200 truncate">
                {webhookUrl || "—"}
              </code>
              <button
                onClick={() => copy(webhookUrl, "webhookUrl")}
                disabled={!webhookUrl}
                className="px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-200 font-semibold hover:bg-amber-500/25 disabled:opacity-30 shrink-0"
              >
                {copied === "webhookUrl" ? "✓ Kopiert" : "URL kopieren"}
              </button>
            </div>
          </div>

          {/* Step 3 — Test */}
          <div className="mt-2 px-2.5 py-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/25 rounded px-1.5 py-0.5">
                Schritt 3
              </span>
              <span className="text-[11px] font-semibold">Testen &amp; Make abschalten</span>
            </div>
            <ol className="text-[10px] text-zinc-500 leading-snug list-decimal pl-4 space-y-0.5">
              <li>
                Im Shopify Webhook-Editor: <span className="font-mono text-zinc-300">Send test notification</span> klicken —
                der Hub sollte HTTP 200 antworten.
              </li>
              <li>
                Echte Test-Bestellung (Bogus Gateway erlaubt) durchschicken.
              </li>
              <li>
                Hub → Lizenzen-Tab refresh → die Zeile sollte da sein, Mail im Postfach.
              </li>
              <li>
                Wenn alles passt: Make-Szenario in Make.com auf <span className="font-mono text-zinc-300">Off</span> stellen.
                Hub ist jetzt 100% standalone.
              </li>
            </ol>
            <p className="text-[9px] text-zinc-500 mt-2 leading-snug">
              Falls etwas schiefläuft: Hub → System-Logs Tab filtert auf
              {" "}<span className="font-mono">shopify.webhook</span> — jede eingehende Anfrage
              wird dort geloggt (egal ob success oder reject).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Lizenzen Tab ────────────────────────────────────────────────
// Flat, sortable view of every customer row focused on licence
// state (status column + profile.subscriptionEndsAt). Inline-edit
// per row, KPI bar at top, status-filter chips. Optimistic refresh
// after each save.

interface LicensesCustomer {
  rowIndex: number;
  lizenzschluessel: string;
  status: string;
  shopDomain: string;
  kundenEmail: string;
  bestellnummer: string;
  sku: string;
  subscriptionEndsAt: string;
  blocked: boolean;
}

type LicenseStatusFilter = "all" | "active" | "expiring" | "expired" | "blocked";
type LicenseSortKey = "expiry" | "status" | "email" | "sku";

const STATUS_OPTIONS = ["aktiv", "abgelaufen", "gekündigt", "gesperrt", "pausiert"];

// Bucket a customer into a coarse health state so the KPI tiles
// and the filter chips can share the same logic.
function licenseHealth(
  c: LicensesCustomer,
  now = Date.now(),
): "blocked" | "expired" | "expiring" | "active" {
  if (c.blocked) return "blocked";
  const statusLow = (c.status || "").trim().toLowerCase();
  if (["gesperrt", "blocked", "deaktiviert", "disabled"].includes(statusLow)) return "blocked";
  if (["abgelaufen", "expired", "gekündigt", "gekuendigt", "cancelled", "canceled"].includes(statusLow)) {
    return "expired";
  }
  const endsAt = c.subscriptionEndsAt;
  if (endsAt) {
    const t = Date.parse(endsAt);
    if (Number.isFinite(t)) {
      if (t < now) return "expired";
      if (t - now < 7 * 24 * 60 * 60 * 1000) return "expiring";
    }
  }
  return "active";
}

// ─── Credits admin (Preise · Icon · Gewinn pro Nutzung) ─────────
// One place to (1) set the credit packages sold in the shop, (2) set
// the credit icon shown across the app, (3) re-price every AI/tool,
// and see the profit per use (Credit-Umsatz − geschätzte API-Kosten).

interface CreditForm {
  icon: string;
  costs: Record<string, string>;
  apiCostsEur: Record<string, string>;
  packages: { id: string; credits: string; priceEur: string; priceLabel: string }[];
}

function formFromConfig(cfg: CreditConfig): CreditForm {
  const costs: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.costs)) costs[k] = String(v);
  const apiCostsEur: Record<string, string> = {};
  for (const [k, v] of Object.entries(cfg.apiCostsEur)) apiCostsEur[k] = String(v);
  return {
    icon: cfg.icon,
    costs,
    apiCostsEur,
    packages: cfg.packages.map((p) => ({
      id: p.id,
      credits: String(p.credits),
      priceEur: (p.priceCents / 100).toFixed(2),
      priceLabel: p.priceLabel,
    })),
  };
}

function configFromForm(form: CreditForm): CreditConfig {
  const costs: Record<string, number> = {};
  for (const [k, v] of Object.entries(form.costs)) costs[k] = Math.max(0, Math.round(Number(v) || 0));
  const apiCostsEur: Record<string, number> = {};
  for (const [k, v] of Object.entries(form.apiCostsEur)) apiCostsEur[k] = Math.max(0, Number(v) || 0);
  return mergeCreditConfig({
    icon: form.icon,
    costs,
    apiCostsEur,
    packages: form.packages.map((p) => {
      const priceCents = Math.max(0, Math.round((Number(p.priceEur) || 0) * 100));
      return {
        id: p.id,
        credits: Math.max(0, Math.round(Number(p.credits) || 0)),
        priceCents,
        priceLabel: p.priceLabel.trim() || formatEuro(priceCents),
      };
    }),
  });
}

function CreditsAdminView({
  config,
  loading,
  saving,
  onSave,
  onRefresh,
}: {
  config: CreditConfig;
  loading: boolean;
  saving: boolean;
  onSave: (next: CreditConfig) => Promise<boolean>;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState<CreditForm>(() => formFromConfig(config));
  const [savedFlash, setSavedFlash] = useState(false);
  const [errFlash, setErrFlash] = useState(false);

  // Re-seed the form whenever a fresh config arrives from the server.
  useEffect(() => {
    setForm(formFromConfig(config));
  }, [config]);

  const draft = configFromForm(form);
  const ppc = pricePerCreditEur(draft);

  function setIcon(v: string) {
    setForm((f) => ({ ...f, icon: v }));
  }
  function setCost(key: string, v: string) {
    setForm((f) => ({ ...f, costs: { ...f.costs, [key]: v } }));
  }
  function setApiCost(key: string, v: string) {
    setForm((f) => ({ ...f, apiCostsEur: { ...f.apiCostsEur, [key]: v } }));
  }
  function setPkg(idx: number, field: "credits" | "priceEur" | "priceLabel", v: string) {
    setForm((f) => ({
      ...f,
      packages: f.packages.map((p, i) => (i === idx ? { ...p, [field]: v } : p)),
    }));
  }

  async function handleSave() {
    const ok = await onSave(configFromForm(form));
    setSavedFlash(ok);
    setErrFlash(!ok);
    setTimeout(() => { setSavedFlash(false); setErrFlash(false); }, 2500);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Header / actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-[#95BF47]" /> Credits & Preise
          </h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Shop-Preise, Credit-Icon und alle Tool-Preise — inkl. Gewinn pro Nutzung.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />}
          Neu laden
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50"
          style={{ background: "#95BF47", color: "#0a1604" }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Speichern
        </button>
      </div>
      {savedFlash && (
        <div className="flex items-center gap-2 text-emerald-400 text-xs glass border border-emerald-500/20 px-3 py-2 rounded-lg">
          <Check className="w-3.5 h-3.5" /> Gespeichert — wirkt sofort in Shop & allen Tools.
        </div>
      )}
      {errFlash && (
        <div className="flex items-center gap-2 text-red-400 text-xs glass border border-red-500/20 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5" /> Speichern fehlgeschlagen.
        </div>
      )}

      {/* Credit icon */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">Credit-Icon</h3>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={form.icon}
            onChange={(e) => setIcon(e.target.value.slice(0, 8))}
            className="w-24 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-center text-lg outline-none focus:border-white/25 transition"
            placeholder="🪙"
          />
          <div className="text-xs text-zinc-400">
            Vorschau:{" "}
            <span className="font-bold text-white tabular-nums">1.234 {form.icon || "🪙"}</span>
          </div>
          <div className="text-[10px] text-zinc-600">Emoji oder kurzer Text — erscheint überall neben dem Guthaben.</div>
        </div>
      </div>

      {/* Shop packages */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Store className="w-3.5 h-3.5 text-purple-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">Credit-Pakete im Shop</h3>
        </div>
        <p className="text-[10px] text-zinc-600 mb-2.5">
          Preis &amp; Label je Paket anpassbar. Die Credit-Menge pro Paket und die Shopify-Variant-IDs sind fix im Code (die Gutschrift beim Kauf richtet sich danach) — daher hier nur zur Info.
        </p>
        <div className="space-y-2">
          {form.packages.map((p, idx) => {
            const perCredit = Number(p.credits) > 0 ? (Number(p.priceEur) || 0) / Number(p.credits) : 0;
            return (
              <div key={p.id} className="grid grid-cols-2 sm:grid-cols-[80px_1fr_1fr_1fr_auto] gap-2 items-center rounded-lg bg-white/[0.02] border border-white/[0.06] p-2">
                <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">{p.id}</div>
                <div className="block">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500">Credits (fix)</span>
                  <div className="w-full px-2 py-1 text-xs tabular-nums text-zinc-300">{p.credits}</div>
                </div>
                <label className="block">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500">Preis €</span>
                  <input type="number" min={0} step="0.01" value={p.priceEur} onChange={(e) => setPkg(idx, "priceEur", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs tabular-nums outline-none focus:border-white/25" />
                </label>
                <label className="block">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-500">Label</span>
                  <input value={p.priceLabel} onChange={(e) => setPkg(idx, "priceLabel", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:border-white/25" />
                </label>
                <div className="text-[10px] text-zinc-500 tabular-nums text-right">
                  {perCredit > 0 ? `${(perCredit * 100).toFixed(3)} ct/Credit` : "—"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-zinc-500">
          Ø Preis pro Credit (für die Gewinn-Rechnung): <strong className="text-zinc-300 tabular-nums">{(ppc * 100).toFixed(3)} ct</strong>
        </div>
      </div>

      {/* Tool prices + profit */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Percent className="w-3.5 h-3.5 text-emerald-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">Tool-Preise &amp; Gewinn pro Nutzung</h3>
        </div>
        <p className="text-[10px] text-zinc-600 mb-2.5">
          Gewinn = Credit-Preis × Ø-Cent/Credit − geschätzte API-Kosten. API-Kosten frei justierbar.
        </p>

        {/* Header row (desktop) */}
        <div className="hidden md:grid grid-cols-[1.6fr_0.8fr_1fr_0.9fr_0.9fr_0.7fr] gap-2 px-2 pb-1 text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">
          <span>Tool</span><span>Credits</span><span>API-Kosten €</span><span>Umsatz €</span><span>Gewinn €</span><span>Marge</span>
        </div>
        <div className="space-y-1.5">
          {TOOL_PRICING_META.map((t) => {
            const prof = toolProfit(draft, t.key);
            const good = prof.profitEur >= 0;
            return (
              <div key={t.key} className="grid grid-cols-2 md:grid-cols-[1.6fr_0.8fr_1fr_0.9fr_0.9fr_0.7fr] gap-2 items-center rounded-lg bg-white/[0.02] border border-white/[0.06] p-2">
                <div className="col-span-2 md:col-span-1 min-w-0">
                  <div className="text-[12px] font-semibold text-zinc-200 truncate flex items-center gap-1.5">
                    {t.label}
                    {t.hidden && <span className="text-[8px] uppercase tracking-widest text-zinc-600 border border-white/10 rounded px-1">versteckt</span>}
                  </div>
                  <div className="text-[9.5px] text-zinc-600 truncate">{t.hint}</div>
                </div>
                <label className="block">
                  <span className="md:hidden text-[9px] uppercase tracking-widest text-zinc-500">Credits</span>
                  <input type="number" min={0} value={form.costs[t.key] ?? ""} onChange={(e) => setCost(t.key, e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs tabular-nums outline-none focus:border-white/25" />
                </label>
                <label className="block">
                  <span className="md:hidden text-[9px] uppercase tracking-widest text-zinc-500">API €</span>
                  <input type="number" min={0} step="0.001" value={form.apiCostsEur[t.key] ?? ""} onChange={(e) => setApiCost(t.key, e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs tabular-nums outline-none focus:border-white/25" />
                </label>
                <div className="text-[11px] tabular-nums text-zinc-300">
                  <span className="md:hidden text-[9px] uppercase tracking-widest text-zinc-500 mr-1">Umsatz</span>
                  {prof.revenueEur.toFixed(3)}
                </div>
                <div className="text-[11px] font-bold tabular-nums" style={{ color: good ? "#95BF47" : "#fca5a5" }}>
                  <span className="md:hidden text-[9px] uppercase tracking-widest text-zinc-500 mr-1 font-normal">Gewinn</span>
                  {good && prof.profitEur > 0 ? "+" : ""}{prof.profitEur.toFixed(3)}
                </div>
                <div className="text-[10px] tabular-nums" style={{ color: good ? "#95BF47" : "#fca5a5" }}>
                  {prof.marginPct}%
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-zinc-600 mt-2 leading-snug">
          Beträge sind Schätzungen pro Einzelnutzung. Bei AI Studio gilt der Preis pro Bild (×1–3 bei Mehrfach-Generierung).
        </p>
      </div>
    </motion.div>
  );
}

// ─── Lizenz manuell ausstellen ──────────────────────────────────
// Echte Lizenz (Key → Sheet-Zeile → Mail) ohne Shopify — zum sauberen
// Nachtragen von Kunden, deren Bestell-Webhook nicht durchkam.
function ManualResultRow({ ok, label, error }: { ok: boolean; label: string; error?: string }) {
  return (
    <div className="flex items-start gap-1.5 text-xs">
      <span className={ok ? "text-[#95BF47]" : "text-red-400"}>{ok ? "✓" : "✗"}</span>
      <span className="text-zinc-300">
        {label}
        {error ? <span className="text-red-400/90"> — {error}</span> : null}
      </span>
    </div>
  );
}

function ManualLicensePanel({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [sku, setSku] = useState("abo");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean; key?: string; action?: string;
    sheetWritten?: boolean; sheetError?: string;
    emailSent?: boolean; emailError?: string; error?: string;
  } | null>(null);

  async function issue() {
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/license/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), orderNumber: orderNumber.trim(), sku: sku.trim() || "abo" }),
      });
      const data = await res.json();
      setResult(data);
      if (data?.sheetWritten) onDone();
    } catch {
      setResult({ error: "Verbindungsfehler." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="group rounded-xl border border-[#95BF47]/25 bg-[#95BF47]/[0.04] overflow-hidden">
      <summary className="cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-center gap-2 hover:bg-[#95BF47]/[0.06] transition">
        <Plus className="w-4 h-4 text-[#95BF47] shrink-0" />
        <span className="text-sm font-semibold text-zinc-200">Lizenz manuell ausstellen</span>
        <span className="ml-auto text-[10px] text-zinc-500 hidden sm:inline">Key + Sheet + Mail · ohne Shopify</span>
        <ChevronDown className="ml-2 w-4 h-4 text-zinc-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-3">
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          Trägt eine echte Lizenz ins Sheet ein und schickt die Mail mit dem Key — z. B. um Kunden nachzutragen,
          deren Bestell-Webhook nicht durchkam. Existiert die E-Mail schon, wird die bestehende Lizenz reaktiviert
          (kein Duplikat).
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">E-Mail *</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kunde@example.com"
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/25 transition" />
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">Bestellnummer (optional)</span>
            <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="#1234 — leer = automatisch"
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/25 transition" />
          </label>
        </div>
        <div className="flex items-end gap-2">
          <label className="block w-24 shrink-0">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-semibold">SKU</span>
            <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="abo"
              className="mt-1 w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/25 transition" />
          </label>
          <button onClick={issue} disabled={busy || !email.includes("@")}
            className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            style={{ background: "#95BF47", color: "#0a1604" }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Lizenz ausstellen + Mail
          </button>
        </div>

        {result && (
          <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-1.5">
            {result.error ? (
              <div className="text-xs text-red-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {result.error}</div>
            ) : (
              <>
                {result.key && (
                  <div className="text-xs text-zinc-200">
                    Key: <code className="font-mono text-[#95BF47] bg-black/40 px-2 py-0.5 rounded">{result.key}</code>
                    {result.action ? <span className="text-zinc-500"> · {result.action === "renewed" ? "reaktiviert" : "neu angelegt"}</span> : null}
                  </div>
                )}
                <ManualResultRow ok={!!result.sheetWritten} label="In Sheets eingetragen" error={result.sheetError} />
                <ManualResultRow ok={!!result.emailSent} label="Mail gesendet" error={result.emailError} />
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function LicensesView({
  customers,
  loading,
  onRefresh,
  onOpenCustomer,
}: {
  customers: LicensesCustomer[];
  loading: boolean;
  onRefresh: () => void;
  onOpenCustomer: (key: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LicenseStatusFilter>("all");
  const [sortKey, setSortKey] = useState<LicenseSortKey>("expiry");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const now = Date.now();

  // Pre-compute health per row once so filter + sort + KPIs agree.
  const enriched = customers.map((c) => ({ ...c, health: licenseHealth(c, now) }));

  const kpis = {
    total: enriched.length,
    active: enriched.filter((c) => c.health === "active").length,
    expiring: enriched.filter((c) => c.health === "expiring").length,
    expired: enriched.filter((c) => c.health === "expired").length,
    blocked: enriched.filter((c) => c.health === "blocked").length,
  };

  const filtered = enriched.filter((c) => {
    if (filter === "active" && c.health !== "active") return false;
    if (filter === "expiring" && c.health !== "expiring") return false;
    if (filter === "expired" && c.health !== "expired") return false;
    if (filter === "blocked" && c.health !== "blocked") return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.lizenzschluessel.toLowerCase().includes(q) ||
      c.kundenEmail.toLowerCase().includes(q) ||
      c.shopDomain.toLowerCase().includes(q) ||
      c.bestellnummer.toLowerCase().includes(q) ||
      c.sku.toLowerCase().includes(q)
    );
  });

  // Sort. For expiry, empty dates go to the bottom so the rows
  // that actually expire (and need attention) stay on top.
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "expiry") {
      const ta = a.subscriptionEndsAt ? Date.parse(a.subscriptionEndsAt) : Infinity;
      const tb = b.subscriptionEndsAt ? Date.parse(b.subscriptionEndsAt) : Infinity;
      return ta - tb;
    }
    if (sortKey === "status") return (a.status || "").localeCompare(b.status || "");
    if (sortKey === "email") return (a.kundenEmail || "").localeCompare(b.kundenEmail || "");
    if (sortKey === "sku") return (a.sku || "").localeCompare(b.sku || "");
    return 0;
  });

  function startEdit(c: LicensesCustomer) {
    setEditingKey(c.lizenzschluessel);
    setEditStatus(c.status || "aktiv");
    // <input type="date"> expects YYYY-MM-DD; slice the ISO timestamp.
    setEditEndsAt(c.subscriptionEndsAt ? c.subscriptionEndsAt.slice(0, 10) : "");
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditStatus("");
    setEditEndsAt("");
  }

  async function saveEdit(key: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/license/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          status: editStatus,
          subscriptionEndsAt: editEndsAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Speichern fehlgeschlagen.");
      } else {
        setSuccess(`${key} gespeichert.`);
        setTimeout(() => setSuccess(""), 2000);
        cancelEdit();
        onRefresh();
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function quickCancel(key: string) {
    if (saving) return;
    if (!confirm(`Lizenz "${key}" wirklich kündigen?\n\nStatus → "gekündigt", blocked → true.`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/license/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          status: "gekündigt",
          blocked: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kündigen fehlgeschlagen.");
      } else {
        setSuccess(`${key} gekündigt.`);
        setTimeout(() => setSuccess(""), 2000);
        onRefresh();
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  async function quickReactivate(key: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/license/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, status: "aktiv", blocked: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Reaktivieren fehlgeschlagen.");
      } else {
        setSuccess(`${key} reaktiviert.`);
        setTimeout(() => setSuccess(""), 2000);
        onRefresh();
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Lizenz manuell ausstellen / Kunden nachtragen */}
      <ManualLicensePanel onDone={onRefresh} />

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: License, E-Mail, Shop, Bestellnr, SKU…"
            className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs outline-none focus:border-white/25 transition placeholder:text-zinc-600"
          />
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as LicenseSortKey)}
          className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-zinc-300 outline-none focus:border-white/25 transition"
        >
          <option value="expiry">Sortieren: Ablaufdatum ↑</option>
          <option value="status">Sortieren: Status</option>
          <option value="email">Sortieren: E-Mail</option>
          <option value="sku">Sortieren: SKU</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-zinc-300 hover:bg-white/[0.08] transition flex items-center gap-1.5"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Aktualisieren</span>
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-2 rounded-lg border text-left transition ${
            filter === "all" ? "bg-white/[0.06] border-white/25" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">Alle</div>
          <div className="text-lg font-bold tabular-nums">{kpis.total}</div>
        </button>
        <button
          onClick={() => setFilter("active")}
          className={`px-3 py-2 rounded-lg border text-left transition ${
            filter === "active" ? "bg-emerald-500/15 border-emerald-500/40" : "bg-emerald-500/[0.04] border-emerald-500/15 hover:bg-emerald-500/10"
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-bold text-emerald-300/80">Aktiv</div>
          <div className="text-lg font-bold tabular-nums text-emerald-300">{kpis.active}</div>
        </button>
        <button
          onClick={() => setFilter("expiring")}
          className={`px-3 py-2 rounded-lg border text-left transition ${
            filter === "expiring" ? "bg-amber-500/15 border-amber-500/40" : "bg-amber-500/[0.04] border-amber-500/15 hover:bg-amber-500/10"
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-bold text-amber-300/80">≤ 7 Tage</div>
          <div className="text-lg font-bold tabular-nums text-amber-300">{kpis.expiring}</div>
        </button>
        <button
          onClick={() => setFilter("expired")}
          className={`px-3 py-2 rounded-lg border text-left transition ${
            filter === "expired" ? "bg-red-500/15 border-red-500/40" : "bg-red-500/[0.04] border-red-500/15 hover:bg-red-500/10"
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-bold text-red-300/80">Abgelaufen</div>
          <div className="text-lg font-bold tabular-nums text-red-300">{kpis.expired}</div>
        </button>
        <button
          onClick={() => setFilter("blocked")}
          className={`px-3 py-2 rounded-lg border text-left transition ${
            filter === "blocked" ? "bg-zinc-500/20 border-zinc-500/50" : "bg-zinc-500/[0.04] border-zinc-500/15 hover:bg-zinc-500/10"
          }`}
        >
          <div className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Gesperrt</div>
          <div className="text-lg font-bold tabular-nums text-zinc-300">{kpis.blocked}</div>
        </button>
      </div>

      {/* Status messages */}
      {(error || success) && (
        <div
          className={`text-[11px] px-3 py-2 rounded-lg border ${
            error
              ? "bg-red-500/10 border-red-500/25 text-red-300"
              : "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
          }`}
        >
          {error || success}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* Header — desktop only */}
        <div className="hidden md:grid grid-cols-[1.6fr_1.6fr_1fr_1fr_1.2fr_1.4fr_auto] gap-2 px-3 py-2 bg-white/[0.03] border-b border-white/[0.06] text-[9px] uppercase tracking-widest font-bold text-zinc-500">
          <div>License / E-Mail</div>
          <div>Shop / Bestellnr</div>
          <div>SKU</div>
          <div>Status</div>
          <div>Läuft bis</div>
          <div>Health</div>
          <div className="text-right">Aktionen</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {sorted.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-zinc-500">
              {loading ? "Lade…" : "Keine Treffer."}
            </div>
          )}
          {sorted.map((c) => {
            const isEditing = editingKey === c.lizenzschluessel;
            const healthMeta = {
              active: { color: "#10B981", label: "Aktiv" },
              expiring: { color: "#F59E0B", label: "Läuft bald ab" },
              expired: { color: "#EF4444", label: "Abgelaufen" },
              blocked: { color: "#71717A", label: "Gesperrt" },
            }[c.health];
            const endsAtPretty = c.subscriptionEndsAt
              ? new Date(c.subscriptionEndsAt).toLocaleDateString("de-DE")
              : "—";
            return (
              <div
                key={c.lizenzschluessel}
                className="md:grid md:grid-cols-[1.6fr_1.6fr_1fr_1fr_1.2fr_1.4fr_auto] md:gap-2 md:items-center px-3 py-2.5 hover:bg-white/[0.02] transition"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold truncate">
                    {c.kundenEmail || "—"}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate">
                    {c.lizenzschluessel}
                  </div>
                </div>
                <div className="min-w-0 md:block hidden">
                  <div className="text-[11px] text-zinc-300 truncate">
                    {c.shopDomain || "—"}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate">
                    {c.bestellnummer || "—"}
                  </div>
                </div>
                <div className="md:block hidden text-[11px] text-zinc-300 truncate">
                  {c.sku || "—"}
                </div>
                <div>
                  {isEditing ? (
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/15 rounded px-1.5 py-1 text-[11px] outline-none focus:border-white/30"
                    >
                      {STATUS_OPTIONS.includes((c.status || "").trim().toLowerCase())
                        ? null
                        : c.status && (
                            <option value={c.status}>{c.status} (current)</option>
                          )}
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[11px] text-zinc-300 truncate inline-block max-w-full">
                      {c.status || "—"}
                    </span>
                  )}
                </div>
                <div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editEndsAt}
                      onChange={(e) => setEditEndsAt(e.target.value)}
                      className="w-full bg-white/[0.06] border border-white/15 rounded px-1.5 py-1 text-[11px] outline-none focus:border-white/30"
                    />
                  ) : (
                    <span className="text-[11px] text-zinc-300 tabular-nums">{endsAtPretty}</span>
                  )}
                </div>
                <div className="md:flex hidden items-center gap-1.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: healthMeta.color }}
                  />
                  <span className="text-[10px]" style={{ color: healthMeta.color }}>
                    {healthMeta.label}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-2 md:mt-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(c.lizenzschluessel)}
                        disabled={saving}
                        className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-[10px] font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Speichern"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={saving}
                        className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-zinc-300 text-[10px] hover:bg-white/[0.08] transition disabled:opacity-50"
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(c)}
                        className="px-2 py-1 rounded bg-white/[0.04] border border-white/10 text-zinc-300 text-[10px] hover:bg-white/[0.08] transition flex items-center gap-1"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                        Edit
                      </button>
                      {c.health === "blocked" || c.health === "expired" ? (
                        <button
                          onClick={() => quickReactivate(c.lizenzschluessel)}
                          disabled={saving}
                          className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-200 text-[10px] hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                          Reaktivieren
                        </button>
                      ) : (
                        <button
                          onClick={() => quickCancel(c.lizenzschluessel)}
                          disabled={saving}
                          className="px-2 py-1 rounded bg-red-500/10 border border-red-500/25 text-red-300 text-[10px] hover:bg-red-500/20 transition disabled:opacity-50"
                        >
                          Kündigen
                        </button>
                      )}
                      <button
                        onClick={() => onOpenCustomer(c.lizenzschluessel)}
                        className="p-1 rounded bg-white/[0.04] border border-white/10 text-zinc-400 hover:bg-white/[0.08] transition"
                        title="Kundendetails öffnen"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Code-Blöcke admin view ─────────────────────────────────────

type CodeBlockEditorOption = AdminCodeBlockOption & { _included: boolean };

interface CodeBlockEditorState {
  rowIndex?: number;
  id?: string;
  title: string;
  description: string;
  code: string;
  previewImageUrl: string;
  options: CodeBlockEditorOption[];
  active: boolean;
}

const EMPTY_CODE_BLOCK: CodeBlockEditorState = {
  title: "", description: "", code: "", previewImageUrl: "", options: [], active: true,
};

function CodeBlocksAdminView({ blocks, loading, onRefresh, onNotify }: {
  blocks: AdminCodeBlock[];
  loading: boolean;
  onRefresh: () => void;
  onNotify: (type: "success" | "error", msg: string) => void;
}) {
  const [editor, setEditor] = useState<CodeBlockEditorState | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  function openNew() { setEditor({ ...EMPTY_CODE_BLOCK, options: [] }); }
  function openEdit(b: AdminCodeBlock) {
    setEditor({
      rowIndex: b.rowIndex,
      id: b.id,
      title: b.title,
      description: b.description,
      code: b.code,
      previewImageUrl: b.previewImageUrl,
      options: b.options.map((o) => ({ ...o, _included: true })),
      active: b.active,
    });
  }

  async function analyze() {
    if (!editor || !editor.code.trim()) {
      onNotify("error", "Bitte zuerst Code einfügen.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/admin/code-blocks/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editor.code }),
      });
      const data = await res.json();
      if (!res.ok) { onNotify("error", data.error || "Analyse fehlgeschlagen."); return; }
      const detected: CodeBlockEditorOption[] = (data.options || []).map((o: AdminCodeBlockOption) => ({
        ...o,
        _included: true,
      }));
      // Merge with any options the admin already had — keep theirs,
      // append only newly-detected ones (dedup by `original`).
      setEditor((e) => {
        if (!e) return e;
        const existing = e.options;
        const known = new Set(existing.map((o) => o.original));
        const fresh = detected.filter((o) => !known.has(o.original));
        return { ...e, options: [...existing, ...fresh] };
      });
      onNotify("success", `${detected.length} Einstellmöglichkeit(en) gefunden${data.source === "heuristic" ? " (Heuristik)" : ""}. Bitte prüfen.`);
    } catch {
      onNotify("error", "Analyse fehlgeschlagen.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadPreview(file: File) {
    setImgUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setEditor((e) => e ? { ...e, previewImageUrl: data.url } : e);
      } else {
        onNotify("error", "Bild-Upload fehlgeschlagen.");
      }
    } catch { onNotify("error", "Bild-Upload fehlgeschlagen."); }
    finally { setImgUploading(false); }
  }

  function patchOption(idx: number, patch: Partial<CodeBlockEditorOption>) {
    setEditor((e) => {
      if (!e) return e;
      const opts = [...e.options];
      opts[idx] = { ...opts[idx], ...patch };
      return { ...e, options: opts };
    });
  }
  function addManualOption() {
    setEditor((e) => e ? {
      ...e,
      options: [...e.options, { id: `opt_m_${Date.now()}`, label: "", type: "text", original: "", _included: true }],
    } : e);
  }
  function removeOption(idx: number) {
    setEditor((e) => e ? { ...e, options: e.options.filter((_, i) => i !== idx) } : e);
  }

  async function save() {
    if (!editor) return;
    if (!editor.title.trim()) { onNotify("error", "Titel fehlt."); return; }
    if (!editor.code.trim()) { onNotify("error", "Code fehlt."); return; }
    // Only confirmed options with a non-empty `original` get persisted.
    const options = editor.options
      .filter((o) => o._included && o.original.trim())
      .map(({ _included, ...o }) => ({ ...o, label: o.label.trim() || "Option" }));
    // Validate: every option's `original` must exist in the code.
    const missing = options.find((o) => !editor.code.includes(o.original));
    if (missing) {
      onNotify("error", `Option "${missing.label}": der Original-Text kommt im Code nicht vor.`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        rowIndex: editor.rowIndex,
        title: editor.title,
        description: editor.description,
        code: editor.code,
        previewImageUrl: editor.previewImageUrl,
        options,
        active: editor.active,
      };
      const res = await fetch("/api/admin/code-blocks", {
        method: editor.rowIndex ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { onNotify("error", data.error || "Speichern fehlgeschlagen."); return; }
      onNotify("success", editor.rowIndex ? "Code-Block aktualisiert." : "Code-Block erstellt.");
      setEditor(null);
      onRefresh();
    } catch { onNotify("error", "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function toggleActive(b: AdminCodeBlock) {
    setBusyRow(b.rowIndex);
    try {
      await fetch("/api/admin/code-blocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: b.rowIndex, active: !b.active }),
      });
      onRefresh();
    } catch { onNotify("error", "Status-Update fehlgeschlagen."); }
    finally { setBusyRow(null); }
  }

  async function remove(b: AdminCodeBlock) {
    if (!confirm(`Code-Block "${b.title}" wirklich löschen?`)) return;
    setBusyRow(b.rowIndex);
    try {
      await fetch("/api/admin/code-blocks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: b.rowIndex }),
      });
      onNotify("success", "Code-Block gelöscht.");
      onRefresh();
    } catch { onNotify("error", "Löschen fehlgeschlagen."); }
    finally { setBusyRow(null); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            Code-Blöcke
          </h2>
          <p className="text-zinc-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Shopify-Custom-Liquid-Snippets für Membership-Kunden. Code einfügen →
            KI findet anpassbare Texte &amp; Farben → du bestätigst sie → Kunden passen an &amp; kopieren mit einem Klick.
          </p>
        </div>
        <button onClick={openNew} className="btn-accent px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Plus className="w-3.5 h-3.5" /> Neuer Block
        </button>
      </div>

      {/* List */}
      {loading && blocks.length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />Lade Code-Blöcke…</div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-10 text-zinc-500 text-sm border border-dashed border-white/10 rounded-xl">
          Noch keine Code-Blöcke. Klick auf <span className="text-cyan-300 font-semibold">Neuer Block</span>.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {blocks.map((b) => (
            <div key={b.id} className={`rounded-xl border p-3 space-y-2 ${b.active ? "border-white/10 bg-white/[0.02]" : "border-red-500/20 bg-white/[0.01] opacity-70"}`}>
              <div className="aspect-video rounded-lg overflow-hidden bg-white border border-white/10">
                {b.previewImageUrl ? (
                  <img src={b.previewImageUrl} alt={b.title} className="w-full h-full object-cover" />
                ) : b.code ? (
                  <CodeBlockPreview code={b.code} className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900"><Code2 className="w-7 h-7" /></div>
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-bold truncate">{b.title || "—"}</h3>
                  <p className="text-[10px] text-zinc-500 truncate">{b.description || "Keine Beschreibung"}</p>
                </div>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 shrink-0">
                  {b.options.length} Opt.
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(b)} className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] font-semibold hover:bg-white/10 transition flex items-center justify-center gap-1">
                  <Pencil className="w-3 h-3" /> Bearbeiten
                </button>
                <button onClick={() => toggleActive(b)} disabled={busyRow === b.rowIndex} title={b.active ? "Deaktivieren" : "Aktivieren"} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 transition">
                  {busyRow === b.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className={`w-3 h-3 ${b.active ? "text-emerald-400" : "text-zinc-500"}`} />}
                </button>
                <button onClick={() => remove(b)} disabled={busyRow === b.rowIndex} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition">
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <AnimatePresence>
        {editor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={() => setEditor(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl border border-white/10 w-full max-w-3xl my-2"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-bold">{editor.rowIndex ? "Code-Block bearbeiten" : "Neuer Code-Block"}</h3>
                <button onClick={() => setEditor(null)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-3 max-h-[78vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Titel</label>
                    <input type="text" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} placeholder="z.B. Trust-Badges Banner" className="input-glass w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Beschreibung</label>
                    <input type="text" value={editor.description} onChange={(e) => setEditor({ ...editor, description: e.target.value })} placeholder="Kurzbeschreibung für Kunden" className="input-glass w-full text-sm" />
                  </div>
                </div>

                {/* Code + live preview side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Liquid / HTML / CSS Code</label>
                    <textarea
                      value={editor.code}
                      onChange={(e) => setEditor({ ...editor, code: e.target.value })}
                      rows={12}
                      placeholder="<div class=&quot;promo&quot;> … </div>"
                      className="input-glass w-full text-[11px] font-mono resize-y h-full min-h-[220px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Live-Vorschau
                    </label>
                    <div className="rounded-lg overflow-hidden bg-white border border-white/10 h-[220px]">
                      {editor.code.trim() ? (
                        <CodeBlockPreview code={editor.code} interactive className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 text-[11px] gap-1 bg-zinc-900">
                          <Code2 className="w-7 h-7" />
                          <span>Code einfügen für Vorschau</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-1">
                      Wird automatisch aus dem Code gerendert — genau das sehen die Kunden.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={analyze}
                    disabled={analyzing || !editor.code.trim()}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px] font-bold hover:bg-purple-500/25 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    KI-Analyse: Einstellmöglichkeiten finden
                  </button>
                  <span className="text-[10px] text-zinc-500">Findet anpassbare Texte &amp; Farben.</span>
                </div>

                {/* Optional cover image — overrides the live preview as a
                    polished thumbnail in the customer grid. */}
                <details className="group">
                  <summary className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold cursor-pointer hover:text-zinc-300 select-none">
                    Cover-Bild (optional) — ersetzt die Live-Vorschau in der Galerie
                  </summary>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-28 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                      {editor.previewImageUrl ? (
                        <img src={editor.previewImageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600"><ImageIcon className="w-5 h-5" /></div>
                      )}
                    </div>
                    <label className="cursor-pointer px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] font-semibold hover:bg-white/10 transition flex items-center gap-1.5">
                      {imgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                      Bild hochladen
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPreview(e.target.files[0])} />
                    </label>
                    {editor.previewImageUrl && (
                      <button onClick={() => setEditor({ ...editor, previewImageUrl: "" })} className="text-[10px] text-zinc-500 hover:text-red-400 transition">entfernen</button>
                    )}
                  </div>
                </details>

                {/* Options review */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      Einstellmöglichkeiten ({editor.options.filter((o) => o._included).length} aktiv)
                    </label>
                    <button onClick={addManualOption} className="text-[10px] text-cyan-300 hover:text-cyan-200 transition flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Manuell hinzufügen
                    </button>
                  </div>
                  {editor.options.length === 0 ? (
                    <p className="text-[11px] text-zinc-600 border border-dashed border-white/10 rounded-lg p-3 text-center">
                      Noch keine Optionen. Klick oben auf <span className="text-purple-300">KI-Analyse</span> oder füge manuell welche hinzu.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {editor.options.map((opt, idx) => (
                        <div key={opt.id} className={`rounded-lg border p-2 flex items-start gap-2 ${opt._included ? "border-white/10 bg-white/[0.02]" : "border-white/5 bg-white/[0.01] opacity-50"}`}>
                          <button
                            onClick={() => patchOption(idx, { _included: !opt._included })}
                            title={opt._included ? "Diese Option NICHT verwenden" : "Option verwenden"}
                            className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center ${opt._included ? "bg-cyan-500 border-cyan-400" : "bg-transparent border-white/20"}`}
                          >
                            {opt._included && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1.2fr_0.7fr_1.4fr] gap-1.5">
                            <input
                              type="text" value={opt.label}
                              onChange={(e) => patchOption(idx, { label: e.target.value })}
                              placeholder="Label (z.B. Button-Text)"
                              className="input-glass w-full text-[11px]"
                            />
                            <select
                              value={opt.type}
                              onChange={(e) => patchOption(idx, { type: e.target.value === "color" ? "color" : "text" })}
                              className="input-glass w-full text-[11px]"
                            >
                              <option value="text">Text</option>
                              <option value="color">Farbe</option>
                            </select>
                            <input
                              type="text" value={opt.original}
                              onChange={(e) => patchOption(idx, { original: e.target.value })}
                              placeholder="Original-Wert im Code"
                              className={`input-glass w-full text-[11px] font-mono ${opt.original && !editor.code.includes(opt.original) ? "border-red-500/40" : ""}`}
                            />
                          </div>
                          <button onClick={() => removeOption(idx)} className="mt-0.5 p-1 rounded hover:bg-red-500/10 transition shrink-0">
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      ))}
                      <p className="text-[9px] text-zinc-600">
                        Der „Original-Wert" muss exakt so im Code vorkommen — Kunden ersetzen ihn dann mit ihrem eigenen Wert.
                      </p>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} className="accent-cyan-500" />
                  Für Kunden sichtbar (aktiv)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
                <button onClick={() => setEditor(null)} className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/5 transition">
                  Abbrechen
                </button>
                <button onClick={save} disabled={saving} className="btn-accent px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editor.rowIndex ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Coaching admin view ────────────────────────────────────────

interface CoachingEditorState {
  rowIndex?: number;
  title: string;
  body: string;
  mediaUrl: string;
  author: string;
  active: boolean;
}

const EMPTY_COACHING_TIP: CoachingEditorState = {
  title: "", body: "", mediaUrl: "", author: "admin", active: true,
};

function CoachingAdminView({ tips, whatsapp, loading, onRefresh, onNotify }: {
  tips: AdminCoachingTip[];
  whatsapp: string;
  loading: boolean;
  onRefresh: () => void;
  onNotify: (type: "success" | "error", msg: string) => void;
}) {
  const [waInput, setWaInput] = useState(whatsapp);
  const [waSaving, setWaSaving] = useState(false);
  const [editor, setEditor] = useState<CoachingEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => { setWaInput(whatsapp); }, [whatsapp]);

  async function saveWhatsapp() {
    setWaSaving(true);
    try {
      const res = await fetch("/api/admin/coaching", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: waInput }),
      });
      if (res.ok) { onNotify("success", "WhatsApp-Nummer gespeichert."); onRefresh(); }
      else { onNotify("error", "Speichern fehlgeschlagen."); }
    } catch { onNotify("error", "Speichern fehlgeschlagen."); }
    finally { setWaSaving(false); }
  }

  async function generateWithAi() {
    if (!aiTopic.trim()) { onNotify("error", "Bitte ein Thema eingeben."); return; }
    setAiBusy(true);
    try {
      const res = await fetch("/api/admin/coaching/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic }),
      });
      const data = await res.json();
      if (!res.ok) { onNotify("error", data.error || "KI-Generierung fehlgeschlagen."); return; }
      setEditor({ title: data.title || aiTopic, body: data.body || "", mediaUrl: "", author: "ai", active: true });
      setAiTopic("");
    } catch { onNotify("error", "KI-Generierung fehlgeschlagen."); }
    finally { setAiBusy(false); }
  }

  async function uploadMedia(file: File) {
    setImgUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setEditor((e) => e ? { ...e, mediaUrl: data.url } : e);
      } else { onNotify("error", "Bild-Upload fehlgeschlagen."); }
    } catch { onNotify("error", "Bild-Upload fehlgeschlagen."); }
    finally { setImgUploading(false); }
  }

  async function save() {
    if (!editor) return;
    if (!editor.title.trim()) { onNotify("error", "Titel fehlt."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/coaching", {
        method: editor.rowIndex ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowIndex: editor.rowIndex,
          title: editor.title, body: editor.body, mediaUrl: editor.mediaUrl,
          author: editor.author, active: editor.active,
        }),
      });
      const data = await res.json();
      if (!res.ok) { onNotify("error", data.error || "Speichern fehlgeschlagen."); return; }
      onNotify("success", editor.rowIndex ? "Tipp aktualisiert." : "Tipp erstellt.");
      setEditor(null);
      onRefresh();
    } catch { onNotify("error", "Speichern fehlgeschlagen."); }
    finally { setSaving(false); }
  }

  async function toggleActive(t: AdminCoachingTip) {
    setBusyRow(t.rowIndex);
    try {
      await fetch("/api/admin/coaching", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: t.rowIndex, active: !t.active }),
      });
      onRefresh();
    } catch { onNotify("error", "Status-Update fehlgeschlagen."); }
    finally { setBusyRow(null); }
  }

  async function remove(t: AdminCoachingTip) {
    if (!confirm(`Tipp "${t.title}" wirklich löschen?`)) return;
    setBusyRow(t.rowIndex);
    try {
      await fetch("/api/admin/coaching", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIndex: t.rowIndex }),
      });
      onNotify("success", "Tipp gelöscht.");
      onRefresh();
    } catch { onNotify("error", "Löschen fehlgeschlagen."); }
    finally { setBusyRow(null); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-yellow-400" />
          Privates Coaching <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/15 border border-yellow-400/35 text-yellow-300">Membership</span>
        </h2>
        <p className="text-zinc-400 text-xs mt-1 max-w-2xl leading-relaxed">
          Tipps für Membership-Kunden — selbst schreiben oder von der KI entwerfen lassen. Plus die WhatsApp-Nummer,
          über die Membership-Kunden dich direkt erreichen.
        </p>
      </div>

      {/* WhatsApp setting */}
      <div className="glass-strong rounded-2xl border border-emerald-500/20 p-4 space-y-2">
        <h3 className="text-xs font-bold flex items-center gap-1.5"><MessageCircle className="w-4 h-4 text-emerald-400" />WhatsApp-Kontaktnummer</h3>
        <p className="text-[10px] text-zinc-500">Membership-Kunden sehen einen „WhatsApp schreiben"-Button, der hierher führt. Mit Ländervorwahl, z.B. +49170…</p>
        <div className="flex items-center gap-2">
          <input
            type="text" value={waInput}
            onChange={(e) => setWaInput(e.target.value)}
            placeholder="+49 170 1234567"
            className="input-glass flex-1 text-sm"
          />
          <button onClick={saveWhatsapp} disabled={waSaving} className="btn-accent px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
            {waSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Speichern
          </button>
        </div>
      </div>

      {/* Add tip + AI generator */}
      <div className="glass-strong rounded-2xl border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-bold flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-amber-400" />Coaching-Tipps</h3>
          <button onClick={() => setEditor({ ...EMPTY_COACHING_TIP })} className="btn-accent px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
            <Plus className="w-3 h-3" /> Tipp manuell schreiben
          </button>
        </div>
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider">KI-Tipp entwerfen</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text" value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") generateWithAi(); }}
              placeholder="Thema, z.B. „Conversion-Optimierung der Produktseite“"
              className="input-glass flex-1 text-sm"
            />
            <button onClick={generateWithAi} disabled={aiBusy} className="px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[11px] font-bold hover:bg-purple-500/25 transition disabled:opacity-50 flex items-center gap-1.5">
              {aiBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Entwerfen
            </button>
          </div>
          <p className="text-[9px] text-zinc-600 mt-1.5">Die KI erstellt einen Entwurf — du prüfst &amp; speicherst ihn anschließend.</p>
        </div>
      </div>

      {/* Tips list */}
      {loading && tips.length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500"><Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />Lade Tipps…</div>
      ) : tips.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-white/10 rounded-xl">Noch keine Coaching-Tipps.</div>
      ) : (
        <div className="space-y-2">
          {tips.map((t) => (
            <div key={t.id} className={`rounded-xl border p-3 ${t.active ? "border-white/10 bg-white/[0.02]" : "border-red-500/20 bg-white/[0.01] opacity-70"}`}>
              <div className="flex items-start gap-3">
                {t.mediaUrl && (
                  <div className="w-20 h-14 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                    <img src={t.mediaUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold truncate">{t.title}</h3>
                    <span className={`text-[8px] uppercase font-bold tracking-wider px-1 py-0.5 rounded shrink-0 ${t.author === "ai" ? "bg-purple-500/15 text-purple-300" : "bg-amber-500/15 text-amber-300"}`}>
                      {t.author === "ai" ? "KI" : "Team"}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 whitespace-pre-wrap">{t.body}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditor({ rowIndex: t.rowIndex, title: t.title, body: t.body, mediaUrl: t.mediaUrl, author: t.author, active: t.active })} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 transition">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => toggleActive(t)} disabled={busyRow === t.rowIndex} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/10 transition">
                    {busyRow === t.rowIndex ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className={`w-3 h-3 ${t.active ? "text-emerald-400" : "text-zinc-500"}`} />}
                  </button>
                  <button onClick={() => remove(t)} disabled={busyRow === t.rowIndex} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-red-500/10 hover:border-red-500/20 transition">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <AnimatePresence>
        {editor && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={() => setEditor(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl border border-white/10 w-full max-w-xl my-2"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  {editor.rowIndex ? "Tipp bearbeiten" : "Neuer Tipp"}
                  {editor.author === "ai" && <span className="text-[8px] uppercase font-bold tracking-wider px-1 py-0.5 rounded bg-purple-500/15 text-purple-300">KI-Entwurf</span>}
                </h3>
                <button onClick={() => setEditor(null)} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[78vh] overflow-y-auto">
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Titel</label>
                  <input type="text" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} className="input-glass w-full text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Inhalt</label>
                  <textarea value={editor.body} onChange={(e) => setEditor({ ...editor, body: e.target.value })} rows={8} className="input-glass w-full text-xs resize-y" placeholder="Der Coaching-Tipp…" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Bild (optional)</label>
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-16 rounded-lg overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                      {editor.mediaUrl ? <img src={editor.mediaUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><ImageIcon className="w-5 h-5" /></div>}
                    </div>
                    <label className="cursor-pointer px-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[11px] font-semibold hover:bg-white/10 transition flex items-center gap-1.5">
                      {imgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                      Bild hochladen
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadMedia(e.target.files[0])} />
                    </label>
                    {editor.mediaUrl && <button onClick={() => setEditor({ ...editor, mediaUrl: "" })} className="text-[10px] text-zinc-500 hover:text-red-400 transition">entfernen</button>}
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <label className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Autor</label>
                    <select value={editor.author} onChange={(e) => setEditor({ ...editor, author: e.target.value })} className="input-glass text-xs">
                      <option value="admin">Team</option>
                      <option value="ai">KI</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs mt-4">
                    <input type="checkbox" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} className="accent-yellow-500" />
                    Für Membership-Kunden sichtbar
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10">
                <button onClick={() => setEditor(null)} className="px-3 py-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 border border-white/10 hover:bg-white/5 transition">Abbrechen</button>
                <button onClick={save} disabled={saving} className="btn-accent px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editor.rowIndex ? "Speichern" : "Erstellen"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
