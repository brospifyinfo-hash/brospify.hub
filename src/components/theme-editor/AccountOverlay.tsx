"use client";

// ─── Konto-/Abo-/Paywall-Overlay der Standalone-Editor-Website ──────────
// EIN Overlay, zwei Modi:
//  - "account": Profil öffnen (Klick auf die Credits-Anzeige) → zeigt Plan,
//    Credits, aktive Designs, Logout + die 3 Pläne zum Upgraden.
//  - "paywall": beim Download ohne Abo → dieselben 3 Pläne, anderer Kopf.
// Feste helle Inline-Farben (Landing-Look), damit White-Mode nichts kippt.

import { useEffect, useState } from "react";

const INK = "#14121a";
const INK_SOFT = "#5b5766";
const INK_FAINT = "#8c8896";
const LINE = "rgba(20,18,26,0.12)";
const ACCENT = "#7c3aed";

interface PlanSummary {
  key: string;
  label: string;
  priceEur: number;
  credits: number;
  activeDesigns: number;
  ctaUrl: string;
  highlighted: boolean;
  tagline: string;
}
interface AccountData {
  loggedIn: boolean;
  isAdmin?: boolean;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  plan?: { active: boolean; key: string | null; label: string | null; priceEur: number };
  credits?: { balance: number | null; unlimited?: boolean };
  designs?: { used: number; limit: number };
  plans: PlanSummary[];
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE");
}
function checkoutReady(url: string): boolean {
  return !!url && !url.includes("REPLACE_");
}

export default function AccountOverlay({
  open,
  onClose,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  mode: "account" | "paywall";
}) {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/editor/account", { cache: "no-store" });
        const d = await r.json();
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const active = data?.plan?.active === true;
  const isAdmin = data?.isAdmin === true;
  const designs = data?.designs;
  const balance = data?.credits?.balance;
  const plans = data?.plans || [];

  const logout = () => { window.location.href = "/api/auth/logout"; };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0"
        style={{ background: "rgba(20,18,26,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", border: 0, cursor: "pointer" }}
        aria-label="Schließen"
        onClick={onClose}
      />
      <div
        className="relative"
        style={{
          width: "min(680px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#ffffff",
          border: "1px solid rgba(20,18,26,0.10)",
          borderRadius: 26,
          boxShadow: "0 40px 120px -20px rgba(20,18,26,0.45)",
          padding: "30px 28px",
          color: INK,
          fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
        }}
      >
        {/* Kopf */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {mode === "paywall" ? "Wähle deinen Plan" : "Dein Konto"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: INK_SOFT }}>
              {mode === "paywall"
                ? "Zum Herunterladen deines Themes brauchst du ein aktives Abo. Jederzeit kündbar."
                : data?.email || data?.username || (isAdmin ? "Admin" : "")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Schließen" style={{ border: 0, background: "rgba(20,18,26,0.06)", width: 34, height: 34, borderRadius: 10, cursor: "pointer", color: INK_SOFT, fontSize: 18, lineHeight: "34px", flexShrink: 0 }}>×</button>
        </div>

        {/* Status-Zeile (nur account) */}
        {mode === "account" && (
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <StatCard label="Plan" value={loading ? "…" : isAdmin ? "Admin" : active ? (data?.plan?.label || "Abo") : "Gratis-Vorschau"} accent={active || isAdmin} />
            <StatCard label="Credits" value={loading ? "…" : isAdmin ? "∞" : balance == null ? "–" : fmt(balance)} />
            <StatCard label="Aktive Designs" value={loading ? "…" : designs ? (designs.limit === -1 ? `${designs.used} / ∞` : `${designs.used} / ${designs.limit}`) : "–"} />
          </div>
        )}

        {/* Plan-Karten — auch für aktive Abonnenten (Upgrade/Wechsel) */}
        {!isAdmin && (
          <>
            <div style={{ marginTop: 22, marginBottom: 12, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: INK_FAINT, textTransform: "uppercase" }}>
              {active ? "Plan wechseln" : "Pläne"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {plans.map((p) => (
                <PlanCard key={p.key} plan={p} current={data?.plan?.key === p.key} />
              ))}
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 11.5, color: INK_FAINT, textAlign: "center" }}>
              Preise pro Monat. Kündbar jederzeit. Credits werden monatlich gutgeschrieben.
            </p>
          </>
        )}

        {/* Aktiver Plan: Hinweis + Wechsel-Link */}
        {mode === "account" && active && !isAdmin && (
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.20)" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK }}>
              Aktiver Plan: {data?.plan?.label} · {data?.plan?.priceEur} €/Monat
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: INK_SOFT }}>
              Download + Live-Updates sind freigeschaltet. Abo verwalten/kündigen über deinen Shopify-Kaufbeleg.
            </p>
          </div>
        )}

        {/* Fußzeile (nur account): Logout */}
        {mode === "account" && (
          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            <span style={{ fontSize: 12, color: INK_FAINT }}>
              {data?.name ? `Angemeldet als ${data.name}` : ""}
            </span>
            <button onClick={logout} style={{ border: `1.5px solid ${LINE}`, background: "#fff", color: INK, padding: "9px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
              Abmelden
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 120, padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${accent ? "rgba(124,58,237,0.30)" : LINE}`, background: accent ? "rgba(124,58,237,0.05)" : "#fff" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.06em", color: INK_FAINT, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 17, fontWeight: 800, color: INK }}>{value}</div>
    </div>
  );
}

function PlanCard({ plan, current }: { plan: PlanSummary; current: boolean }) {
  const ready = checkoutReady(plan.ctaUrl);
  const go = () => { if (ready) window.location.href = plan.ctaUrl; };
  return (
    <div style={{
      position: "relative",
      padding: "18px 16px",
      borderRadius: 18,
      border: `1.5px solid ${plan.highlighted ? ACCENT : LINE}`,
      background: plan.highlighted ? "rgba(124,58,237,0.04)" : "#fff",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      {plan.highlighted && (
        <span style={{ position: "absolute", top: -10, right: 14, background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, letterSpacing: "0.04em" }}>BELIEBT</span>
      )}
      <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{plan.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: INK }}>{plan.priceEur} €</span>
        <span style={{ fontSize: 12, color: INK_FAINT }}>/ Monat</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        <Li>{fmt(plan.credits)} Credits / Monat</Li>
        <Li>{plan.activeDesigns} aktive{plan.activeDesigns === 1 ? "s" : ""} Design{plan.activeDesigns === 1 ? "" : "s"}</Li>
        <Li>Download + Live-Updates</Li>
      </ul>
      <button
        onClick={go}
        disabled={!ready || current}
        title={ready ? "" : "Checkout-Link noch nicht hinterlegt"}
        style={{
          marginTop: 4, width: "100%", padding: "11px 14px", borderRadius: 999, border: 0,
          cursor: ready && !current ? "pointer" : "default",
          background: current ? "rgba(20,18,26,0.08)" : plan.highlighted ? ACCENT : INK,
          color: current ? INK_SOFT : "#fff",
          fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
          opacity: ready || current ? 1 : 0.55,
        }}
      >
        {current ? "Aktueller Plan" : ready ? "Buchen →" : "Bald verfügbar"}
      </button>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 12.5, color: INK_SOFT, display: "flex", gap: 7, alignItems: "flex-start" }}>
      <span style={{ color: ACCENT, fontWeight: 800 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}
