"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Cog,
  Gauge,
  Loader2,
  PauseCircle,
  Play,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import Navigation from "@/components/Navigation";

// ─── Types mirrored from the API responses ─────────────────────

type Mode = "subsecond" | "secondly" | "burst" | "mixed";
type Status = "running" | "completed" | "stopped" | "failed";

interface DevStoreProduct {
  productId: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  price: string;
  available: number | null;
}

interface LoadTestSession {
  id: string;
  productId: string;
  productTitle: string;
  variantId: string;
  unitPrice: string;
  durationMinutes: number;
  mode: Mode;
  devStoreDomain: string;
  tag: string;
  startedAt: string;
  endsAt: string;
  stoppedAt: string;
  status: Status;
  ordersAttempted: number;
  ordersSucceeded: number;
  ordersFailed: number;
  rateLimited: number;
  avgLatencyMs: number;
  lastError: string;
  createdBy: string;
}

interface FireResponse {
  ok: boolean;
  orderId?: string;
  latencyMs: number;
  throttled: boolean;
  cost?: {
    requested: number;
    actual: number;
    currentlyAvailable: number;
    maximumAvailable: number;
    restoreRate: number;
  };
  error?: string;
}

// ─── Chaos Engine (browser side) ──────────────────────────────
// Deterministic timing rules driven by the chosen mode. We schedule
// the *next* fire — we don't await the current one — so the browser
// holds multiple in-flight requests at once, exposing the actual
// throughput wall of the dev store.
//
// SAFETY: a cost-aware floor caps the engine when Shopify's
// throttleStatus drops below 15. Below that we wait for refill rather
// than guarantee a 429 — the test still measures the wall, but we
// don't bombard the API past the point where the data stops being
// useful.

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: "subsecond", label: "Sub-sekündlich", sub: "200–800ms zufällig" },
  { key: "secondly", label: "Sekündlich", sub: "Exakt 1 / Sek" },
  { key: "burst", label: "Burst", sub: "3–8 dicht, dann Pause" },
  { key: "mixed", label: "Mixed (Chaos)", sub: "Zufällige Übergänge" },
];

interface EngineState {
  // Active sub-mode when running in "mixed".
  activeSubMode: Exclude<Mode, "mixed">;
  modeUntil: number;
  // Remaining shots in the current burst (used by burst / mixed-burst).
  burstRemaining: number;
}

function newEngineState(now: number, mode: Mode): EngineState {
  if (mode === "burst") {
    return { activeSubMode: "burst", modeUntil: Infinity, burstRemaining: 3 + Math.floor(Math.random() * 6) };
  }
  if (mode === "mixed") {
    const subModes: Exclude<Mode, "mixed">[] = ["subsecond", "secondly", "burst"];
    const pick = subModes[Math.floor(Math.random() * subModes.length)];
    return {
      activeSubMode: pick,
      modeUntil: now + 5000 + Math.floor(Math.random() * 15_000),
      burstRemaining: pick === "burst" ? 3 + Math.floor(Math.random() * 6) : 0,
    };
  }
  return { activeSubMode: mode as Exclude<Mode, "mixed">, modeUntil: Infinity, burstRemaining: 0 };
}

function nextDelay(
  mode: Mode,
  state: EngineState,
  now: number,
  availableCost: number,
): { delayMs: number; nextState: EngineState } {
  // Cost-aware floor — if we're close to the bucket bottom, wait for
  // a meaningful refill (orderCreate ≈ 10 points, restoreRate ≈ 50/s).
  // We measure rather than bypass.
  if (availableCost < 15 && availableCost > 0) {
    return { delayMs: Math.max(400, ((15 - availableCost) / Math.max(10, 50)) * 1000), nextState: state };
  }

  // 1-in-100 exception pause, capped at exactly 2s as the spec demands.
  if (Math.random() < 0.01) {
    return { delayMs: 2000, nextState: state };
  }

  // Mixed mode: rotate the active sub-mode on its timer.
  let s = state;
  if (mode === "mixed" && now >= s.modeUntil) {
    const subModes: Exclude<Mode, "mixed">[] = ["subsecond", "secondly", "burst"];
    const pick = subModes[Math.floor(Math.random() * subModes.length)];
    s = {
      activeSubMode: pick,
      modeUntil: now + 5000 + Math.floor(Math.random() * 15_000),
      burstRemaining: pick === "burst" ? 3 + Math.floor(Math.random() * 6) : 0,
    };
  }

  const effective = s.activeSubMode;
  if (effective === "subsecond") {
    return { delayMs: 200 + Math.floor(Math.random() * 600), nextState: s };
  }
  if (effective === "secondly") {
    return { delayMs: 1000, nextState: s };
  }
  // burst — fire fast while we have remaining shots, then a normal gap
  if (s.burstRemaining > 0) {
    return {
      delayMs: 30 + Math.floor(Math.random() * 50), // 30–80ms apart (HTTP minimum)
      nextState: { ...s, burstRemaining: s.burstRemaining - 1 },
    };
  }
  // Burst exhausted — short normal gap, then refill counter for the
  // next burst. Caps total at the 2s-pause rule above.
  return {
    delayMs: 400 + Math.floor(Math.random() * 400),
    nextState: { ...s, burstRemaining: 3 + Math.floor(Math.random() * 6) },
  };
}

// ─── Page ─────────────────────────────────────────────────────

export default function LoadTestPage() {
  const [config, setConfig] = useState<{ domain: string; tokenSet: boolean; tokenSuffix: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [products, setProducts] = useState<DevStoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [history, setHistory] = useState<LoadTestSession[]>([]);
  const [activeSession, setActiveSession] = useState<LoadTestSession | null>(null);
  const [topBanner, setTopBanner] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);

  // ── Bootstrap ──
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/loadtest/config", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setConfig(data);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/admin/loadtest/sessions", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const sessions = (data.sessions || []) as LoadTestSession[];
    setHistory(sessions);
    const running = sessions.find((s) => s.status === "running");
    if (running) setActiveSession(running);
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError("");
    try {
      const res = await fetch("/api/admin/loadtest/products", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setProductsError(data.error || "Konnte Produkte nicht laden.");
        return;
      }
      setProducts(data.products || []);
    } catch (e) {
      setProductsError(e instanceof Error ? e.message : "Network error");
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadHistory();
  }, [loadConfig, loadHistory]);

  useEffect(() => {
    if (config?.tokenSet && config.domain) {
      void loadProducts();
    }
  }, [config, loadProducts]);

  return (
    <>
      <Navigation />
      <main className="bg-mesh min-h-screen pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          <PageHeader />

          <DevStoreWarning />

          <AnimatePresence>
            {topBanner && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-xl px-4 py-3 text-sm border ${
                  topBanner.kind === "ok"
                    ? "border-[#95BF47]/30 bg-[#95BF47]/10 text-[#bbe07a]"
                    : topBanner.kind === "error"
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : "border-white/10 bg-white/[0.04] text-zinc-200"
                }`}
              >
                {topBanner.text}
              </motion.div>
            )}
          </AnimatePresence>

          <ConfigSection
            config={config}
            loading={configLoading}
            onSaved={async () => {
              await loadConfig();
              await loadProducts();
              setTopBanner({ kind: "ok", text: "Dev-Store-Credentials gespeichert." });
              setTimeout(() => setTopBanner(null), 4000);
            }}
          />

          <NewRunSection
            disabled={!config?.tokenSet}
            products={products}
            productsLoading={productsLoading}
            productsError={productsError}
            onReloadProducts={loadProducts}
            onStarted={(s) => {
              setActiveSession(s);
              void loadHistory();
            }}
          />

          <LiveMonitorSection
            session={activeSession}
            onEnded={async () => {
              setActiveSession(null);
              await loadHistory();
            }}
            onError={(msg) => setTopBanner({ kind: "error", text: msg })}
          />

          <HistorySection sessions={history} onReload={loadHistory} />

          <CleanupHint />
        </div>
      </main>
    </>
  );
}

// ─── Page Header ──────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-bold">
          Admin · Load Test
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 flex items-center gap-2">
          <Gauge className="w-6 h-6 text-[#95BF47]" />
          Shopify Order Load-Tester
        </h1>
        <p className="text-[12.5px] text-zinc-400 mt-1.5 max-w-2xl">
          Misst die Standhaftigkeit deines Shopify <span className="text-[#95BF47] font-semibold">Development-Stores</span>{" "}
          unter realistischer Order-Frequenz. Strikt auf <code className="text-zinc-300 bg-white/5 px-1 py-0.5 rounded">*.myshopify.com</code> begrenzt.
        </p>
      </div>
    </div>
  );
}

function DevStoreWarning() {
  return (
    <div
      className="rounded-2xl border border-amber-500/25 px-4 py-3 flex items-start gap-3"
      style={{
        background: "linear-gradient(90deg, rgba(245,158,11,0.08), rgba(217,119,6,0.04))",
      }}
    >
      <ShieldCheck className="w-4.5 h-4.5 text-amber-300 shrink-0 mt-0.5" />
      <div className="text-[12px] text-amber-100/90 leading-relaxed">
        <span className="font-bold">Nur für Development-Stores.</span> Jeder Domain-Eintrag wird gegen{" "}
        <code className="text-amber-200 bg-amber-500/15 px-1 py-0.5 rounded">*.myshopify.com</code> validiert.
        Custom-Domains und Produktiv-Shops werden hart abgelehnt — bevor irgendetwas an Shopify rausgeht.
      </div>
    </div>
  );
}

// ─── Config / Setup ───────────────────────────────────────────

function ConfigSection({
  config,
  loading,
  onSaved,
}: {
  config: { domain: string; tokenSet: boolean; tokenSuffix: string } | null;
  loading: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [domain, setDomain] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (config) setDomain(config.domain || "");
  }, [config]);

  // First-load: auto-expand if no token is configured yet.
  useEffect(() => {
    if (config && !config.tokenSet) setExpanded(true);
  }, [config]);

  const handleSave = async () => {
    setErr("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/loadtest/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Speichern fehlgeschlagen.");
      setToken("");
      setExpanded(false);
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Konfiguration"
      icon={<Cog className="w-4 h-4 text-zinc-300" />}
      sub="Dev-Store-Handle + Admin Access Token"
      headerRight={
        config?.tokenSet ? (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#95BF47] bg-[#95BF47]/10 border border-[#95BF47]/25 rounded-full px-2 py-0.5">
            <Check className="w-3 h-3" /> Konfiguriert
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
            <AlertTriangle className="w-3 h-3" /> Setup nötig
          </span>
        )
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lade Konfiguration…
        </div>
      ) : (
        <>
          {config?.tokenSet && !expanded && (
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] text-zinc-300">
                Aktuell:{" "}
                <code className="bg-white/5 px-1.5 py-0.5 rounded text-white">{config.domain}</code>
                <span className="text-zinc-500"> · Token endet auf </span>
                <code className="bg-white/5 px-1.5 py-0.5 rounded text-zinc-400">…{config.tokenSuffix}</code>
              </div>
              <button
                onClick={() => setExpanded(true)}
                className="text-[12px] text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition"
              >
                Ändern
              </button>
            </div>
          )}

          {(!config?.tokenSet || expanded) && (
            <div className="space-y-3">
              <Field label="Dev-Store Handle">
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="my-dev-store.myshopify.com"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#95BF47]/50 focus:bg-white/[0.05] outline-none transition"
                />
                <Hint>
                  Genau die <code>*.myshopify.com</code>-Adresse — keine Custom-Domain.
                </Hint>
              </Field>
              <Field label="Admin Access Token">
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="shpat_… (Custom App im Dev-Store mit write_orders + read_products Scope)"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#95BF47]/50 focus:bg-white/[0.05] outline-none transition font-mono"
                />
                <Hint>
                  Generieren: Shopify Admin → Settings → Apps and sales channels → Develop apps → App erstellen → API credentials.
                  Erforderliche Scopes: <code>write_orders</code>, <code>read_products</code>.
                </Hint>
              </Field>

              {err && (
                <div className="flex items-start gap-2 text-[12px] text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !domain.trim() || !token.trim()}
                  className="inline-flex items-center gap-1.5 bg-[#95BF47] hover:bg-[#86ad3f] text-black font-bold text-[13px] px-4 py-2 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Speichern
                </button>
                {config?.tokenSet && (
                  <button
                    onClick={() => {
                      setExpanded(false);
                      setToken("");
                      setErr("");
                    }}
                    className="text-[12px] text-zinc-400 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:bg-white/[0.04] transition"
                  >
                    Abbrechen
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

// ─── Section A: New Run ───────────────────────────────────────

function NewRunSection({
  disabled,
  products,
  productsLoading,
  productsError,
  onReloadProducts,
  onStarted,
}: {
  disabled: boolean;
  products: DevStoreProduct[];
  productsLoading: boolean;
  productsError: string;
  onReloadProducts: () => void;
  onStarted: (s: LoadTestSession) => void;
}) {
  const [productIdx, setProductIdx] = useState(0);
  const [duration, setDuration] = useState(2);
  const [mode, setMode] = useState<Mode>("mixed");
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState("");

  const selected = products[productIdx];

  const handleStart = async () => {
    if (!selected) return;
    setErr("");
    setStarting(true);
    try {
      const res = await fetch("/api/admin/loadtest/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selected.productId,
          productTitle: selected.productTitle,
          variantId: selected.variantId,
          unitPrice: selected.price,
          durationMinutes: duration,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Start fehlgeschlagen.");
      onStarted(data.session as LoadTestSession);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setStarting(false);
    }
  };

  return (
    <Section
      title="Neuer Run"
      icon={<Play className="w-4 h-4 text-[#95BF47]" />}
      sub="Produkt, Modus, Dauer"
    >
      {disabled ? (
        <div className="text-[12.5px] text-zinc-400 bg-white/[0.02] border border-dashed border-white/10 rounded-lg px-3 py-2">
          Erst Dev-Store-Credentials oben konfigurieren.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Produkt">
            {productsLoading ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Lade Produkte aus Dev-Store…
              </div>
            ) : productsError ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-[12px] text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{productsError}</span>
                </div>
                <button
                  onClick={onReloadProducts}
                  className="text-[12px] text-zinc-300 hover:text-white inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/[0.04]"
                >
                  <RefreshCw className="w-3 h-3" /> Erneut laden
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-[12.5px] text-zinc-400">
                Keine aktiven Produkte im Dev-Store. Erst ein Produkt anlegen.
              </div>
            ) : (
              <>
                <select
                  value={productIdx}
                  onChange={(e) => setProductIdx(Number(e.target.value))}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#95BF47]/50 outline-none"
                >
                  {products.map((p, i) => (
                    <option key={p.variantId} value={i} className="bg-zinc-900">
                      {p.productTitle} · {p.variantTitle} · €{p.price}
                    </option>
                  ))}
                </select>
                {selected && (
                  <Hint>
                    Variant-GID: <code className="text-zinc-300">{selected.variantId.replace("gid://shopify/ProductVariant/", "")}</code>
                  </Hint>
                )}
              </>
            )}
          </Field>

          <Field label="Dauer (Minuten)">
            <input
              type="number"
              min={1}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
              className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[#95BF47]/50 outline-none"
            />
            <Hint>1–120 Minuten. Tabs müssen offen bleiben — die Engine läuft im Browser.</Hint>
          </Field>

          <div className="md:col-span-2">
            <FieldLabel>Frequenz-Modus</FieldLabel>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {MODES.map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`text-left rounded-xl border px-3 py-2.5 transition ${
                      active
                        ? "border-[#95BF47]/40 bg-[#95BF47]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`text-[12.5px] font-bold ${active ? "text-[#95BF47]" : "text-white"}`}>
                      {m.label}
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5">{m.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {err && (
            <div className="md:col-span-2 flex items-start gap-2 text-[12px] text-red-200 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
            <button
              onClick={handleStart}
              disabled={starting || !selected}
              className="inline-flex items-center gap-2 bg-[#95BF47] hover:bg-[#86ad3f] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-[13px] px-5 py-2.5 rounded-lg transition shadow-[0_4px_20px_-6px_rgba(149,191,71,0.6)]"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Run starten
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ─── Section B: Live Monitor ──────────────────────────────────

function LiveMonitorSection({
  session,
  onEnded,
  onError,
}: {
  session: LoadTestSession | null;
  onEnded: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  // ── Live counters (browser state only — Sheets gets a digest /5s) ──
  const [attempted, setAttempted] = useState(0);
  const [succeeded, setSucceeded] = useState(0);
  const [failed, setFailed] = useState(0);
  const [rateLimited, setRateLimited] = useState(0);
  const [availableCost, setAvailableCost] = useState<number>(100);
  const [bucketMax, setBucketMax] = useState<number>(100);
  const [latency, setLatency] = useState<number>(0);
  const [lastError, setLastError] = useState("");
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [now, setNow] = useState(Date.now());

  const abortRef = useRef<AbortController | null>(null);
  const counters = useRef({ attempted: 0, succeeded: 0, failed: 0, rateLimited: 0, latSum: 0, latN: 0 });
  const inFlight = useRef(0);
  // Mirror availableCost into a ref so the long-lived engine loop
  // sees fresh values without us having to tear it down on every
  // throttle-status update.
  const availableCostRef = useRef(100);
  useEffect(() => {
    availableCostRef.current = availableCost;
  }, [availableCost]);

  // Reset counters when a new session begins.
  useEffect(() => {
    if (!session) return;
    counters.current = { attempted: 0, succeeded: 0, failed: 0, rateLimited: 0, latSum: 0, latN: 0 };
    setAttempted(0);
    setSucceeded(0);
    setFailed(0);
    setRateLimited(0);
    setLatency(0);
    setAvailableCost(100);
    setBucketMax(100);
    setLastError("");
  }, [session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 1s countdown ticker.
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [session]);

  // Engine loop.
  const startEngine = useCallback(() => {
    if (!session) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);

    const endsAt = Date.parse(session.endsAt);
    const MAX_IN_FLIGHT = 30;

    const fireOne = async () => {
      inFlight.current += 1;
      counters.current.attempted += 1;
      setAttempted(counters.current.attempted);
      try {
        const res = await fetch(`/api/admin/loadtest/sessions/${session.id}/fire`, {
          method: "POST",
          signal: ctrl.signal,
        });
        const data = (await res.json()) as FireResponse;
        if (res.status === 409) {
          // Session is no longer running on the server side — stop the loop.
          ctrl.abort();
          return;
        }
        if (data.ok) {
          counters.current.succeeded += 1;
          setSucceeded(counters.current.succeeded);
        } else {
          counters.current.failed += 1;
          setFailed(counters.current.failed);
          if (data.throttled) {
            counters.current.rateLimited += 1;
            setRateLimited(counters.current.rateLimited);
          }
          if (data.error) setLastError(data.error);
        }
        if (data.cost) {
          setAvailableCost(data.cost.currentlyAvailable);
          setBucketMax(data.cost.maximumAvailable || 100);
        }
        if (typeof data.latencyMs === "number") {
          counters.current.latSum += data.latencyMs;
          counters.current.latN += 1;
          setLatency(counters.current.latSum / counters.current.latN);
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        counters.current.failed += 1;
        setFailed(counters.current.failed);
        setLastError(e instanceof Error ? e.message : "Network error");
      } finally {
        inFlight.current -= 1;
      }
    };

    const loop = async () => {
      let state = newEngineState(Date.now(), session.mode);
      while (!ctrl.signal.aborted && Date.now() < endsAt) {
        if (inFlight.current < MAX_IN_FLIGHT) {
          void fireOne();
        }
        const { delayMs, nextState } = nextDelay(session.mode, state, Date.now(), availableCostRef.current);
        state = nextState;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      ctrl.abort();
    };

    void loop();
  }, [session]);

  // Auto-start when a session arrives.
  useEffect(() => {
    if (!session || session.status !== "running") return;
    if (Date.parse(session.endsAt) <= Date.now()) return;
    startEngine();
    return () => {
      abortRef.current?.abort();
      setRunning(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  // Metrics ping → Sheets every 5s while running.
  useEffect(() => {
    if (!session || !running) return;
    const t = setInterval(() => {
      void fetch(`/api/admin/loadtest/sessions/${session.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordersAttempted: counters.current.attempted,
          ordersSucceeded: counters.current.succeeded,
          ordersFailed: counters.current.failed,
          rateLimited: counters.current.rateLimited,
          avgLatencyMs: counters.current.latN > 0 ? counters.current.latSum / counters.current.latN : 0,
          lastError,
        }),
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [session, running, lastError]);

  // Countdown-end: flip status + final metrics push.
  useEffect(() => {
    if (!session || !running) return;
    if (Date.now() < Date.parse(session.endsAt)) return;
    // Time is up.
    abortRef.current?.abort();
    setRunning(false);
    void (async () => {
      await fetch(`/api/admin/loadtest/sessions/${session.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordersAttempted: counters.current.attempted,
          ordersSucceeded: counters.current.succeeded,
          ordersFailed: counters.current.failed,
          rateLimited: counters.current.rateLimited,
          avgLatencyMs: counters.current.latN > 0 ? counters.current.latSum / counters.current.latN : 0,
          finalStatus: "completed",
        }),
      }).catch(() => {});
      await onEnded();
    })();
  }, [session, running, now, onEnded]);

  if (!session) {
    return (
      <Section title="Live-Monitor" icon={<Activity className="w-4 h-4 text-zinc-300" />} sub="Aktive Sessions">
        <div className="text-[12.5px] text-zinc-500 italic">
          Keine Session aktiv. Starte einen Run oben.
        </div>
      </Section>
    );
  }

  const endsAt = Date.parse(session.endsAt);
  const remainingMs = Math.max(0, endsAt - now);
  const totalMs = endsAt - Date.parse(session.startedAt);
  const elapsed = totalMs - remainingMs;
  const progress = Math.min(100, Math.max(0, (elapsed / totalMs) * 100));
  const opsPerSec = elapsed > 1000 ? (counters.current.attempted / (elapsed / 1000)) : 0;

  const handleStop = async () => {
    setStopping(true);
    abortRef.current?.abort();
    setRunning(false);
    try {
      await fetch(`/api/admin/loadtest/sessions/${session.id}/stop`, { method: "POST" });
      await fetch(`/api/admin/loadtest/sessions/${session.id}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordersAttempted: counters.current.attempted,
          ordersSucceeded: counters.current.succeeded,
          ordersFailed: counters.current.failed,
          rateLimited: counters.current.rateLimited,
          avgLatencyMs: counters.current.latN > 0 ? counters.current.latSum / counters.current.latN : 0,
          finalStatus: "stopped",
        }),
      });
      await onEnded();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Stop fehlgeschlagen");
    } finally {
      setStopping(false);
    }
  };

  return (
    <Section
      title="Live-Monitor"
      icon={<Activity className="w-4 h-4 text-[#95BF47]" />}
      sub={session.productTitle}
      headerRight={
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#95BF47] bg-[#95BF47]/10 border border-[#95BF47]/25 rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#95BF47] animate-pulse" />
          {running ? "Läuft" : "Stopping…"}
        </span>
      }
    >
      <div className="space-y-4">
        {/* Countdown bar */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Restzeit
            </span>
            <span className="font-mono text-white">{formatHMS(remainingMs)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#95BF47] to-[#bce078]"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.25 }}
            />
          </div>
        </div>

        {/* Counter grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <Metric label="Attempted" value={attempted} accent="text-white" />
          <Metric label="Succeeded" value={succeeded} accent="text-[#95BF47]" />
          <Metric label="Failed" value={failed} accent="text-rose-300" />
          <Metric label="429 Rate-Limited" value={rateLimited} accent="text-amber-300" />
          <Metric label="Ø Latenz (ms)" value={Math.round(latency)} accent="text-zinc-200" mono />
        </div>

        {/* Throughput + bucket */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <Metric label="Aktueller Durchsatz" value={`${opsPerSec.toFixed(1)} / Sek`} accent="text-white" mono />
          <BucketGauge available={availableCost} max={bucketMax} />
        </div>

        {lastError && (
          <div className="text-[11.5px] text-rose-200 bg-rose-500/8 border border-rose-500/15 rounded-lg px-3 py-2">
            <span className="font-bold">Last error:</span> {lastError}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-zinc-500">
            Modus: <span className="text-zinc-300 font-bold">{MODES.find((m) => m.key === session.mode)?.label}</span>
            <span className="mx-2 text-zinc-700">·</span>
            Tag:{" "}
            <code className="text-zinc-300 bg-white/5 px-1 py-0.5 rounded text-[10.5px]">{session.tag}</code>
          </div>
          <button
            onClick={handleStop}
            disabled={stopping}
            className="inline-flex items-center gap-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-200 hover:text-white font-bold text-[12.5px] px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            {stopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
            Killswitch
          </button>
        </div>
      </div>
    </Section>
  );
}

function BucketGauge({ available, max }: { available: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (available / max) * 100)) : 0;
  const tone = pct > 50 ? "#95BF47" : pct > 20 ? "#f59e0b" : "#ef4444";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center justify-between text-[10.5px] uppercase tracking-wider text-zinc-500 font-bold mb-1">
        <span>Shopify Cost-Bucket</span>
        <span className="font-mono text-zinc-400 tabular-nums">
          {Math.round(available)} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="h-full transition-all duration-200"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </div>
    </div>
  );
}

function Metric({
  label, value, accent, mono,
}: {
  label: string;
  value: number | string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-zinc-500 font-bold">{label}</div>
      <div className={`mt-0.5 text-lg ${mono ? "font-mono" : "font-bold"} tabular-nums ${accent || "text-white"}`}>
        {typeof value === "number" ? value.toLocaleString("de-DE") : value}
      </div>
    </div>
  );
}

// ─── Section C: History ──────────────────────────────────────

function HistorySection({
  sessions,
  onReload,
}: {
  sessions: LoadTestSession[];
  onReload: () => void;
}) {
  const past = useMemo(() => sessions.filter((s) => s.status !== "running"), [sessions]);

  return (
    <Section
      title="History"
      icon={<Server className="w-4 h-4 text-zinc-300" />}
      sub={`${past.length} vergangene Runs`}
      headerRight={
        <button
          onClick={onReload}
          className="text-[11.5px] text-zinc-400 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.04] transition"
        >
          <RefreshCw className="w-3 h-3" /> Reload
        </button>
      }
    >
      {past.length === 0 ? (
        <div className="text-[12.5px] text-zinc-500 italic">Noch keine abgeschlossenen Runs.</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500 font-bold border-b border-white/[0.06]">
                <th className="py-2 pr-3">Start</th>
                <th className="py-2 pr-3">Produkt</th>
                <th className="py-2 pr-3">Modus</th>
                <th className="py-2 pr-3 text-right">Attempted</th>
                <th className="py-2 pr-3 text-right">Succ.</th>
                <th className="py-2 pr-3 text-right">429</th>
                <th className="py-2 pr-3 text-right">Ø ms</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {past.map((s) => (
                <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                  <td className="py-2 pr-3 text-zinc-300 font-mono whitespace-nowrap">
                    {formatDate(s.startedAt)}
                  </td>
                  <td className="py-2 pr-3 text-white truncate max-w-[200px]">{s.productTitle}</td>
                  <td className="py-2 pr-3 text-zinc-300">
                    {MODES.find((m) => m.key === s.mode)?.label || s.mode}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-white">{s.ordersAttempted}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[#95BF47]">{s.ordersSucceeded}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-amber-300">{s.rateLimited}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">{Math.round(s.avgLatencyMs)}</td>
                  <td className="py-2 pr-3">
                    <StatusPill status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function StatusPill({ status }: { status: Status }) {
  const style =
    status === "completed"
      ? { bg: "bg-[#95BF47]/10", border: "border-[#95BF47]/30", text: "text-[#95BF47]" }
      : status === "stopped"
      ? { bg: "bg-zinc-500/10", border: "border-zinc-500/25", text: "text-zinc-300" }
      : status === "failed"
      ? { bg: "bg-rose-500/10", border: "border-rose-500/25", text: "text-rose-300" }
      : { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-300" };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.border} ${style.text} border`}>
      {status}
    </span>
  );
}

function CleanupHint() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-start gap-3">
      <Trash2 className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
      <div className="text-[12px] text-zinc-400 leading-relaxed">
        <span className="text-zinc-200 font-bold">Cleanup im Dev-Store:</span>{" "}
        Alle Test-Orders sind mit{" "}
        <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">loadtest</code> +{" "}
        <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">loadtest-&lt;sessionId&gt;</code> getagged.
        Im Shopify Admin → Orders → Filter: <code className="text-zinc-200 bg-white/5 px-1 py-0.5 rounded">tag:loadtest</code> →
        Select all → Cancel & Archive. Auf einem Dev-Store kannst du den Shop alternativ direkt komplett löschen.
      </div>
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────

function Section({
  title, icon, sub, headerRight, children,
}: {
  title: string;
  icon?: ReactNode;
  sub?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-xl overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-white">{title}</div>
            {sub && <div className="text-[10.5px] text-zinc-500 truncate">{sub}</div>}
          </div>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-wider text-zinc-400 font-bold mb-1.5">
      {children}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] text-zinc-500 leading-relaxed">{children}</div>;
}

// ─── Format helpers ──────────────────────────────────────────

function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
