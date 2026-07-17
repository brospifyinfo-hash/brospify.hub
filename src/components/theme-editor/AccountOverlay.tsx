"use client";

// ─── Konto & Einstellungen der Standalone-Editor-Website ────────────────
// EIN Overlay, zwei Modi:
//  - "account": Einstellungen öffnen (Klick auf Konto/Credits in der
//    Toolbar) → Abo/Credits/Designs, E-Mail ändern, Passwort setzen/ändern,
//    App-Sprache, Abmelden.
//  - "paywall": beim Download ohne Abo → die 3 Pläne, anderer Kopf.
// Feste helle Inline-Farben (Landing-Look), damit White-Mode nichts kippt.

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

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
  hasPassword?: boolean;
  plan?: { active: boolean; key: string | null; label: string | null; priceEur: number };
  credits?: { balance: number | null; unlimited?: boolean };
  designs?: { used: number; limit: number };
  plans: PlanSummary[];
}
type Msg = { k: "ok" | "err"; t: string } | null;

function fmt(n: number): string { return n.toLocaleString("de-DE"); }
function checkoutReady(url: string): boolean { return !!url && !url.includes("REPLACE_"); }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", borderRadius: 11, border: `1.5px solid ${LINE}`,
  background: "#fff", color: INK, fontFamily: "inherit", fontSize: 14, outline: "none",
};
const primaryBtn: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 999, border: 0, cursor: "pointer",
  background: INK, color: "#fff", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap",
};
const ghostBtn: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 999, border: `1.5px solid ${LINE}`, cursor: "pointer",
  background: "#fff", color: INK, fontFamily: "inherit", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
};

export default function AccountOverlay({
  open, onClose, mode,
}: { open: boolean; onClose: () => void; mode: "account" | "paywall" }) {
  const { lang, setLang } = useI18n();
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);

  // E-Mail ändern
  const [emailNew, setEmailNew] = useState("");
  const [emailStage, setEmailStage] = useState<"idle" | "code">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [devCode, setDevCode] = useState<string | null>(null);

  // Passwort setzen/ändern
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/editor/account", { cache: "no-store" });
      setData(await r.json());
    } catch { setData(null); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    void reload();
    // Formularzustände beim Öffnen zurücksetzen.
    setEmailStage("idle"); setEmailNew(""); setEmailCode(""); setEmailMsg(null); setDevCode(null);
    setCurPw(""); setNewPw(""); setPwMsg(null);
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

  // ── E-Mail ändern ──
  const requestEmail = async () => {
    if (emailBusy) return;
    const v = emailNew.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) { setEmailMsg({ k: "err", t: "Bitte gib eine gültige E-Mail-Adresse ein." }); return; }
    setEmailBusy(true); setEmailMsg(null);
    try {
      const r = await fetch("/api/editor-auth/email/change-request", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ newEmail: v }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setDevCode(d.devCode || null); setEmailStage("code"); setEmailCode("");
        setEmailMsg({ k: "ok", t: `Code an ${v} geschickt.` });
      } else {
        setEmailMsg({ k: "err", t: d.error === "email_taken" ? "Diese Adresse gehört bereits einem Konto." : d.error === "rate_limited" ? "Zu viele Versuche — bitte warte kurz." : d.error === "send_failed" ? "Code konnte nicht verschickt werden." : "Bitte gib eine gültige E-Mail ein." });
      }
    } catch { setEmailMsg({ k: "err", t: "Netzwerkfehler." }); } finally { setEmailBusy(false); }
  };
  const verifyEmail = async () => {
    if (emailBusy) return;
    const c = emailCode.replace(/\D/g, "");
    if (c.length !== 6) { setEmailMsg({ k: "err", t: "Bitte den 6-stelligen Code eingeben." }); return; }
    setEmailBusy(true); setEmailMsg(null);
    try {
      const r = await fetch("/api/editor-auth/email/change-verify", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: c }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setEmailStage("idle"); setEmailNew(""); setEmailCode(""); setDevCode(null);
        setEmailMsg({ k: "ok", t: "E-Mail geändert ✓" }); void reload();
      } else if (d.error === "code_wrong") {
        setEmailMsg({ k: "err", t: `Code stimmt nicht${typeof d.attemptsLeft === "number" ? ` — noch ${d.attemptsLeft}` : ""}.` });
      } else if (d.error === "email_taken") {
        setEmailStage("idle"); setEmailMsg({ k: "err", t: "Diese Adresse gehört bereits einem Konto." });
      } else {
        setEmailMsg({ k: "err", t: d.error === "code_expired" || d.error === "code_missing" ? "Code abgelaufen — bitte neu anfordern." : d.error === "too_many_attempts" ? "Zu oft falsch — bitte neu anfordern." : "Fehler." });
        if (d.error === "code_expired" || d.error === "too_many_attempts" || d.error === "code_missing") setEmailStage("idle");
      }
    } catch { setEmailMsg({ k: "err", t: "Netzwerkfehler." }); } finally { setEmailBusy(false); }
  };

  // ── Passwort setzen/ändern ──
  const changePassword = async () => {
    if (pwBusy) return;
    if (newPw.length < 8) { setPwMsg({ k: "err", t: "Neues Passwort: mindestens 8 Zeichen." }); return; }
    if (data?.hasPassword && !curPw) { setPwMsg({ k: "err", t: "Bitte aktuelles Passwort eingeben." }); return; }
    setPwBusy(true); setPwMsg(null);
    try {
      const r = await fetch("/api/editor-auth/password/change", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: curPw || undefined, newPassword: newPw }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.ok) {
        setCurPw(""); setNewPw("");
        setPwMsg({ k: "ok", t: d.hadPassword ? "Passwort geändert ✓" : "Passwort gesetzt ✓" }); void reload();
      } else {
        setPwMsg({ k: "err", t: d.error === "current_wrong" ? "Aktuelles Passwort stimmt nicht." : d.error === "password_weak" ? "Neues Passwort: mindestens 8 Zeichen." : d.error === "rate_limited" ? "Zu viele Versuche — bitte warte kurz." : "Fehler." });
      }
    } catch { setPwMsg({ k: "err", t: "Netzwerkfehler." }); } finally { setPwBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button className="absolute inset-0" style={{ background: "rgba(20,18,26,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", border: 0, cursor: "pointer" }} aria-label="Schließen" onClick={onClose} />
      <div className="relative" style={{
        width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff",
        border: "1px solid rgba(20,18,26,0.10)", borderRadius: 26, boxShadow: "0 40px 120px -20px rgba(20,18,26,0.45)",
        padding: "30px 28px", color: INK, fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
      }}>
        {/* Kopf */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {mode === "paywall" ? "Wähle deinen Plan" : "Konto & Einstellungen"}
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.5, color: INK_SOFT }}>
              {mode === "paywall" ? "Zum Herunterladen deines Themes brauchst du ein aktives Abo. Jederzeit kündbar." : data?.email || data?.username || (isAdmin ? "Admin" : "")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Schließen" style={{ border: 0, background: "rgba(20,18,26,0.06)", width: 34, height: 34, borderRadius: 10, cursor: "pointer", color: INK_SOFT, fontSize: 18, lineHeight: "34px", flexShrink: 0 }}>×</button>
        </div>

        {/* Status-Zeile (account) */}
        {mode === "account" && (
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <StatCard label="Plan" value={loading ? "…" : isAdmin ? "Admin" : active ? (data?.plan?.label || "Abo") : "Gratis-Vorschau"} accent={active || isAdmin} />
            <StatCard label="Credits" value={loading ? "…" : isAdmin ? "∞" : balance == null ? "–" : fmt(balance)} />
            <StatCard label="Aktive Projekte" value={loading ? "…" : designs ? (designs.limit === -1 ? `${designs.used} / ∞` : `${designs.used} / ${designs.limit}`) : "–"} />
          </div>
        )}

        {/* Ladehinweis, solange /api/editor/account noch nicht da ist —
            sonst würde die Passwort-Sektion kurz den falschen Zustand
            (hasPassword=undefined → „Passwort setzen") zeigen. */}
        {mode === "account" && !isAdmin && !data && (
          <p style={{ marginTop: 22, fontSize: 13, color: INK_FAINT }}>Lädt …</p>
        )}

        {/* ── Einstellungen (nur account, nicht Admin, geladen) ── */}
        {mode === "account" && !isAdmin && data && (
          <>
            {/* Konto / E-Mail */}
            <Section title="Konto">
              {data?.username && <Row label="Username" value={data.username} />}
              <div style={{ marginTop: data?.username ? 12 : 0 }}>
                <FieldLabel>E-Mail-Adresse</FieldLabel>
                {emailStage === "idle" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input style={{ ...inputStyle, flex: "1 1 200px" }} type="email" autoComplete="email"
                      placeholder={data?.email || "deine@email.de"} value={emailNew}
                      onChange={(e) => { setEmailNew(e.target.value); setEmailMsg(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") requestEmail(); }} disabled={emailBusy} />
                    <button style={{ ...ghostBtn, opacity: emailBusy ? 0.6 : 1 }} onClick={requestEmail} disabled={emailBusy}>
                      {emailBusy ? "…" : "Ändern"}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input style={{ ...inputStyle, flex: "1 1 160px", letterSpacing: "0.2em", textAlign: "center", fontWeight: 700 }}
                      inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={emailCode}
                      onChange={(e) => { setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setEmailMsg(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") verifyEmail(); }} disabled={emailBusy} autoFocus />
                    <button style={{ ...primaryBtn, opacity: emailBusy ? 0.6 : 1 }} onClick={verifyEmail} disabled={emailBusy}>
                      {emailBusy ? "…" : "Bestätigen"}
                    </button>
                    <button style={ghostBtn} onClick={() => { setEmailStage("idle"); setEmailMsg(null); }} disabled={emailBusy}>Abbrechen</button>
                  </div>
                )}
                {devCode && emailStage === "code" && <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: ACCENT }}>(Dev) Code: {devCode}</p>}
                {emailMsg && <p style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 600, color: emailMsg.k === "ok" ? "#15803d" : "#b91c1c" }}>{emailMsg.t}</p>}
                <p style={{ margin: "8px 0 0", fontSize: 11.5, color: INK_FAINT }}>Wir schicken einen Bestätigungscode an die NEUE Adresse.</p>
              </div>
            </Section>

            {/* Sicherheit / Passwort */}
            <Section title="Sicherheit">
              <FieldLabel>{data?.hasPassword ? "Passwort ändern" : "Passwort setzen"}</FieldLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data?.hasPassword && (
                  <input style={inputStyle} type="password" autoComplete="current-password" placeholder="Aktuelles Passwort"
                    value={curPw} onChange={(e) => { setCurPw(e.target.value); setPwMsg(null); }} disabled={pwBusy} />
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input style={{ ...inputStyle, flex: "1 1 200px" }} type="password" autoComplete="new-password" placeholder="Neues Passwort (mind. 8 Zeichen)"
                    value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwMsg(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") changePassword(); }} disabled={pwBusy} />
                  <button style={{ ...primaryBtn, opacity: pwBusy ? 0.6 : 1 }} onClick={changePassword} disabled={pwBusy}>
                    {pwBusy ? "…" : "Speichern"}
                  </button>
                </div>
                {pwMsg && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: pwMsg.k === "ok" ? "#15803d" : "#b91c1c" }}>{pwMsg.t}</p>}
              </div>
            </Section>

            {/* Sprache */}
            <Section title="App-Sprache">
              <div style={{ display: "flex", gap: 8 }}>
                {(["de", "en"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    ...ghostBtn, flex: 1, textAlign: "center",
                    borderColor: lang === l ? ACCENT : LINE,
                    background: lang === l ? "rgba(124,58,237,0.06)" : "#fff",
                    color: lang === l ? INK : INK_SOFT,
                  }}>
                    {l === "de" ? "🇩🇪 Deutsch" : "🇬🇧 English"}{lang === l ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* Aktiver Plan-Hinweis */}
        {mode === "account" && active && !isAdmin && (
          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 14, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.20)" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: INK }}>Aktiver Plan: {data?.plan?.label} · {data?.plan?.priceEur} €/Monat</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: INK_SOFT }}>Download + Live-Updates freigeschaltet. Abo verwalten/kündigen über deinen Shopify-Kaufbeleg.</p>
          </div>
        )}

        {/* Plan-Karten (Paywall ODER Upgrade/Wechsel im Konto) */}
        {!isAdmin && (
          <>
            <div style={{ marginTop: 24, marginBottom: 12, fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: INK_FAINT, textTransform: "uppercase" }}>
              {active ? "Plan wechseln" : "Pläne"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              {plans.map((p) => <PlanCard key={p.key} plan={p} current={data?.plan?.key === p.key} />)}
            </div>
            <p style={{ margin: "14px 0 0", fontSize: 11.5, color: INK_FAINT, textAlign: "center" }}>
              Preise pro Monat. Kündbar jederzeit. Credits werden monatlich gutgeschrieben.
            </p>
          </>
        )}

        {/* Fußzeile: Logout */}
        {mode === "account" && (
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${LINE}`, paddingTop: 16 }}>
            <span style={{ fontSize: 12, color: INK_FAINT }}>{data?.name ? `Angemeldet als ${data.name}` : ""}</span>
            <button onClick={logout} style={ghostBtn}>Abmelden</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: INK_FAINT, textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: INK_SOFT, marginBottom: 7 }}>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: INK_SOFT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{value}</span>
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
    <div style={{ position: "relative", padding: "18px 16px", borderRadius: 18, border: `1.5px solid ${plan.highlighted ? ACCENT : LINE}`, background: plan.highlighted ? "rgba(124,58,237,0.04)" : "#fff", display: "flex", flexDirection: "column", gap: 10 }}>
      {plan.highlighted && <span style={{ position: "absolute", top: -10, right: 14, background: ACCENT, color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 999, letterSpacing: "0.04em" }}>BELIEBT</span>}
      <div style={{ fontSize: 15, fontWeight: 800, color: INK }}>{plan.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: INK }}>{plan.priceEur} €</span>
        <span style={{ fontSize: 12, color: INK_FAINT }}>/ Monat</span>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5 }}>
        <Li>{fmt(plan.credits)} Credits / Monat</Li>
        <Li>{plan.activeDesigns} aktive{plan.activeDesigns === 1 ? "s" : ""} Projekt{plan.activeDesigns === 1 ? "" : "e"}</Li>
        <Li>Download + Live-Updates</Li>
      </ul>
      <button onClick={go} disabled={!ready || current} title={ready ? "" : "Checkout-Link noch nicht hinterlegt"} style={{
        marginTop: 4, width: "100%", padding: "11px 14px", borderRadius: 999, border: 0,
        cursor: ready && !current ? "pointer" : "default",
        background: current ? "rgba(20,18,26,0.08)" : plan.highlighted ? ACCENT : INK,
        color: current ? INK_SOFT : "#fff", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
        opacity: ready || current ? 1 : 0.55,
      }}>
        {current ? "Aktueller Plan" : ready ? "Buchen →" : "Bald verfügbar"}
      </button>
    </div>
  );
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 12.5, color: INK_SOFT, display: "flex", gap: 7, alignItems: "flex-start" }}>
      <span style={{ color: ACCENT, fontWeight: 800 }}>✓</span><span>{children}</span>
    </li>
  );
}
