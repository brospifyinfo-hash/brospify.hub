"use client";

// ─── Login der Standalone-Editor-Website ────────────────────────────────
// Drei Anmeldewege: Google (next-auth), Shopify (eigener OAuth-Flow über
// /api/editor-auth/shopify/*) und E-Mail-Login-Link (Magic Link über
// /api/editor-auth/email/*). Beim ERSTEN Login entsteht automatisch ein
// Gratis-Konto. Bewusst mit festen hellen Inline-Farben (Landing-Look),
// damit keine Theme-/White-Mode-Regel die Lesbarkeit kippen kann.
// Wiederverwendet als Modal im Editor UND als Karte auf /start/login.

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

const INK = "#14121a";
const INK_SOFT = "#5b5766";
const INK_FAINT = "#8c8896";
const LINE = "rgba(20,18,26,0.12)";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function ShopifyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5.6 7.4h12.8l1 12.6a1.5 1.5 0 0 1-1.5 1.6H6.1a1.5 1.5 0 0 1-1.5-1.6L5.6 7.4Z" fill="#95BF47" />
      <path d="M8.6 9V6.4a3.4 3.4 0 0 1 6.8 0V9" stroke="#4d6a24" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const secondaryBtn: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  padding: "12px 18px",
  borderRadius: 12,
  border: `1.5px solid ${LINE}`,
  background: "#ffffff",
  color: INK,
  fontFamily: "inherit",
  fontSize: 13.5,
  fontWeight: 700,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: 12,
  border: `1.5px solid ${LINE}`,
  background: "#ffffff",
  color: INK,
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
};

/** Die weiße Login-Karte (ohne Overlay) — nutzbar im Modal und auf Seiten. */
const VERIFY_ERROR_TEXT: Record<string, string> = {
  code_wrong: "Der Code stimmt nicht — bitte prüfe die Eingabe.",
  code_expired: "Der Code ist abgelaufen — fordere unten einen neuen an.",
  code_missing: "Bitte fordere unten einen neuen Code an.",
  too_many_attempts: "Zu oft falsch eingegeben — fordere bitte einen neuen Code an.",
  use_primary_login:
    "Zu dieser Adresse gehört ein Konto mit Mitgliedschaft oder Admin-Rechten — bitte melde dich mit Google an.",
  username_taken: "Dieser Username wurde gerade vergeben — bitte wähle im Formular einen anderen.",
  blocked: "Dieses Konto ist gesperrt — bitte wende dich an den Support.",
  invalid: "Anmeldung nicht möglich — bitte versuche es erneut.",
  server: "Technischer Fehler — bitte versuche es gleich erneut.",
};

export function EditorLoginCard({ next, onCancel }: { next: string; onCancel?: () => void }) {
  const [view, setView] = useState<"choose" | "register" | "shopify" | "email" | "emailSent">("choose");
  const [shop, setShop] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [cooldown, setCooldown] = useState(false);
  const [regMode, setRegMode] = useState(false); // ob der aktuelle Code-Flow eine Registrierung ist
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cooldown-Timer beim Unmount aufräumen (kein verwaister Timer, der
  // später den Cooldown eines neueren Sends vorzeitig beendet).
  useEffect(() => () => { if (cooldownTimer.current) clearTimeout(cooldownTimer.current); }, []);

  // Google/Shopify setzen busy=true und navigieren dann weg. Kommt der
  // Nutzer per Browser-Back aus dem OAuth-Fenster zurück, stellt der
  // bfcache den alten React-State (busy=true) wieder her → alle Buttons
  // blieben tot. pageshow bei persisted-Restore setzt busy zurück.
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setBusy(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  const startGoogle = () => {
    if (busy) return;
    setBusy(true);
    signIn("google", { callbackUrl: `/api/auth/google-callback?remember=1&next=${encodeURIComponent(next)}` });
  };

  const startShopify = () => {
    if (busy) return;
    const v = shop.trim();
    if (!v) { setErr("Bitte gib deine Shop-Adresse ein."); return; }
    setBusy(true);
    window.location.href = `/api/editor-auth/shopify/start?shop=${encodeURIComponent(v)}&next=${encodeURIComponent(next)}`;
  };

  // withCreds=true → Registrierung mit Username+Passwort; sonst reiner
  // Code-Login (Passwort-vergessen / passwortloser Weg).
  const sendEmailLink = async (withCreds: boolean) => {
    if (busy) return;
    const v = email.trim().toLowerCase();
    if (!EMAIL_RE.test(v)) { setErr("Bitte gib eine gültige E-Mail-Adresse ein."); return; }
    const payload: Record<string, string> = { email: v, next };
    if (withCreds) {
      const u = username.trim().toLowerCase();
      if (!/^[a-z0-9][a-z0-9_.-]{1,28}[a-z0-9]$/.test(u)) {
        setErr("Username: 3–30 Zeichen, Buchstaben/Zahlen/._- (Anfang & Ende alphanumerisch)."); return;
      }
      if (password.length < 8) { setErr("Passwort muss mindestens 8 Zeichen haben."); return; }
      payload.username = u;
      payload.password = password;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/editor-auth/email/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; devUrl?: string; devCode?: string };
      if (d.ok) {
        setDevUrl(d.devUrl || null);
        setDevCode(d.devCode || null);
        setCodeInput("");
        setRegMode(withCreds);
        setView("emailSent");
        // Kleiner Client-Cooldown fürs erneute Senden (Server limitiert zusätzlich).
        // Vorherigen Timer canceln, damit er nicht den neuen Cooldown killt.
        if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
        setCooldown(true);
        cooldownTimer.current = setTimeout(() => setCooldown(false), 30000);
      } else {
        setErr(
          d.error === "rate_limited"
            ? "Zu viele Versuche — bitte warte ein paar Minuten."
            : d.error === "email_invalid"
              ? "Bitte gib eine gültige E-Mail-Adresse ein."
              : d.error === "username_taken"
                ? "Dieser Username ist schon vergeben — bitte wähle einen anderen."
                : d.error === "username_invalid"
                  ? "Username: 3–30 Zeichen, Buchstaben/Zahlen/._-."
                  : d.error === "password_weak"
                    ? "Passwort muss mindestens 8 Zeichen haben."
                    : "Der Code konnte nicht verschickt werden — bitte versuche es gleich erneut.",
        );
      }
    } catch {
      setErr("Netzwerkfehler — bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  };

  // Direkter Login mit Username/E-Mail + Passwort (kein Code nötig).
  const passwordLogin = async () => {
    if (busy) return;
    const id = identifier.trim();
    if (!id || loginPw.length < 1) { setErr("Bitte Username/E-Mail und Passwort eingeben."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/editor-auth/password/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: id, password: loginPw, next }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; next?: string };
      if (d.ok) { window.location.href = d.next || next; return; }
      setErr(
        d.error === "rate_limited"
          ? "Zu viele Versuche — bitte warte ein paar Minuten."
          : d.error === "blocked"
            ? "Dieses Konto ist gesperrt — bitte wende dich an den Support."
            : "Username/E-Mail oder Passwort stimmt nicht.",
      );
      setBusy(false);
    } catch {
      setErr("Netzwerkfehler — bitte versuche es erneut.");
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (busy) return;
    const v = codeInput.replace(/\D/g, "");
    if (v.length !== 6) { setErr("Bitte gib den 6-stelligen Code aus der E-Mail ein."); return; }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/editor-auth/email/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: v, next }),
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; next?: string; attemptsLeft?: number };
      if (d.ok) {
        // Eingeloggt — weiter ins Ziel (busy bleibt an, die Seite wechselt).
        window.location.href = d.next || next;
        return;
      }
      // Username wurde zwischenzeitlich vergeben → zurück ins Formular
      // (dort kann ein neuer Username gewählt werden; Code-View hat keins).
      if (d.error === "username_taken") {
        setErr(VERIFY_ERROR_TEXT.username_taken);
        setCodeInput("");
        setView("register");
        setBusy(false);
        return;
      }
      let msg = VERIFY_ERROR_TEXT[d.error || "server"] ?? VERIFY_ERROR_TEXT.server;
      if (d.error === "code_wrong" && typeof d.attemptsLeft === "number") {
        msg = `Der Code stimmt nicht — noch ${d.attemptsLeft} ${d.attemptsLeft === 1 ? "Versuch" : "Versuche"}.`;
      }
      setErr(msg);
      setBusy(false);
    } catch {
      setErr("Netzwerkfehler — bitte versuche es erneut.");
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        width: "min(430px, 100%)",
        background: "#ffffff",
        border: "1px solid rgba(20,18,26,0.10)",
        borderRadius: 28,
        boxShadow: "0 40px 120px -20px rgba(20,18,26,0.45)",
        padding: "32px 28px",
        textAlign: "center",
        color: INK,
      }}
    >
      <span
        style={{
          width: 54, height: 54, borderRadius: 16, margin: "0 auto 18px",
          display: "grid", placeItems: "center", color: "#fff",
          background: "linear-gradient(100deg,#7c3aed,#ec4899 52%,#fb923c)",
          boxShadow: "0 12px 30px rgba(236,72,153,0.35)",
        }}
        aria-hidden
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M6 3.5h7a4.5 4.5 0 0 1 2.6 8.2A5 5 0 0 1 13.5 21H6V3.5Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      </span>

      {view === "emailSent" ? (
        <>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>Gib deinen Code ein ✉️</h2>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
            Wir haben einen 6-stelligen Code an{" "}
            {email.trim() ? <strong>{email.trim().toLowerCase()}</strong> : "deine E-Mail-Adresse"} geschickt.
            Er ist 15 Minuten gültig — schau auch im Spam-Ordner nach.
          </p>

          {err && (
            <p style={{ margin: "14px 0 0", padding: "10px 14px", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#b91c1c", fontSize: 12.5, fontWeight: 600 }}>
              {err}
            </p>
          )}
          {devCode && (
            <p style={{ margin: "12px 0 0", fontSize: 12.5, fontWeight: 700, color: "#7c3aed" }}>
              (Dev) Code: {devCode}
              {devUrl && (
                <>
                  {" · "}
                  <a href={devUrl} style={{ color: "#7c3aed" }}>Link öffnen →</a>
                </>
              )}
            </p>
          )}

          <input
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") verifyCode(); }}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={busy}
            style={{
              ...inputStyle,
              flex: "none",
              width: "100%",
              marginTop: 18,
              textAlign: "center",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.35em",
              padding: "14px 10px",
            }}
          />

          <button
            onClick={verifyCode}
            disabled={busy}
            style={{
              marginTop: 12, width: "100%", padding: "14px 22px", borderRadius: 999, border: 0,
              cursor: busy ? "default" : "pointer", background: INK, color: "#fff",
              fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, opacity: busy ? 0.7 : 1,
              boxShadow: "0 10px 26px rgba(20,18,26,0.22)",
            }}
          >
            {busy ? "Wird geprüft …" : "Anmelden →"}
          </button>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => sendEmailLink(regMode)} disabled={busy || cooldown} style={{ ...secondaryBtn, opacity: busy || cooldown ? 0.6 : 1 }}>
              {cooldown ? "Code gesendet ✓" : "Code erneut senden"}
            </button>
            <button onClick={() => { setView(regMode ? "register" : "email"); setErr(null); setCodeInput(""); }} disabled={busy} style={secondaryBtn}>
              Zurück
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {view === "register" ? "Konto erstellen" : "Willkommen zurück"}
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: INK_SOFT }}>
            {view === "register"
              ? "Username + Passwort festlegen — danach meldest du dich direkt damit an."
              : "Melde dich an, um deinen Shop zu bauen. Erste Vorschau gratis."}
          </p>

          {err && (
            <p style={{ margin: "14px 0 0", padding: "10px 14px", borderRadius: 12, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", color: "#b91c1c", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>
              {err}
            </p>
          )}

          {view === "register" ? (
            /* ── Registrieren: E-Mail + Username + Passwort → Code ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} placeholder="deine@email.de" type="email" autoComplete="email" autoFocus disabled={busy} style={{ ...inputStyle, flex: "none", width: "100%" }} />
              <input value={username} onChange={(e) => { setUsername(e.target.value); setErr(null); }} placeholder="Username (z. B. maxmustermann)" autoComplete="username" disabled={busy} style={{ ...inputStyle, flex: "none", width: "100%" }} />
              <input value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") sendEmailLink(true); }} placeholder="Passwort (mind. 8 Zeichen)" type="password" autoComplete="new-password" disabled={busy} style={{ ...inputStyle, flex: "none", width: "100%" }} />
              <button onClick={() => sendEmailLink(true)} disabled={busy} style={{ marginTop: 4, width: "100%", padding: "14px 22px", borderRadius: 999, border: 0, cursor: busy ? "default" : "pointer", background: INK, color: "#fff", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, opacity: busy ? 0.7 : 1, boxShadow: "0 10px 26px rgba(20,18,26,0.22)" }}>
                {busy ? "…" : "Konto erstellen →"}
              </button>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: INK_FAINT }}>
                Wir schicken dir einen 6-stelligen Code, um deine E-Mail zu bestätigen.
              </p>
              <button onClick={() => { setView("choose"); setErr(null); }} disabled={busy} style={{ margin: "2px auto 0", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: INK_SOFT }}>
                Schon ein Konto? Anmelden
              </button>
            </div>
          ) : view === "shopify" ? (
            /* ── Shopify-Shop verbinden ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={shop} onChange={(e) => { setShop(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") startShopify(); }} placeholder="dein-shop.myshopify.com" autoFocus style={inputStyle} disabled={busy} />
                <button onClick={startShopify} disabled={busy} style={{ ...secondaryBtn, width: "auto", background: "#95BF47", border: 0, color: "#10230a" }}>Weiter →</button>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: INK_FAINT }}>Die Adresse findest du im Shopify-Admin — sie endet auf .myshopify.com.</p>
              <button onClick={() => { setView("choose"); setErr(null); }} disabled={busy} style={{ margin: "2px auto 0", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: INK_SOFT }}>← Zurück</button>
            </div>
          ) : view === "email" ? (
            /* ── Code-Login (Passwort vergessen / passwortloser Weg) ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") sendEmailLink(false); }} placeholder="deine@email.de" type="email" autoFocus style={inputStyle} disabled={busy} />
                <button onClick={() => sendEmailLink(false)} disabled={busy} style={{ ...secondaryBtn, width: "auto" }}>{busy ? "…" : "Code senden"}</button>
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: INK_FAINT }}>Du bekommst einen 6-stelligen Code per E-Mail — kein Passwort nötig.</p>
              <button onClick={() => { setView("emailSent"); setErr(null); }} disabled={busy} style={{ margin: "2px auto 0", border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: INK_SOFT }}>
                Code schon erhalten? Hier eingeben →
              </button>
              <button onClick={() => { setView("choose"); setErr(null); }} disabled={busy} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: INK_SOFT }}>← Zurück zum Login</button>
            </div>
          ) : (
            /* ── Standard: direkter Login mit Username/E-Mail + Passwort ── */
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
                <input value={identifier} onChange={(e) => { setIdentifier(e.target.value); setErr(null); }} placeholder="Username oder E-Mail" autoComplete="username" autoFocus disabled={busy} style={{ ...inputStyle, flex: "none", width: "100%" }} />
                <input value={loginPw} onChange={(e) => { setLoginPw(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") passwordLogin(); }} placeholder="Passwort" type="password" autoComplete="current-password" disabled={busy} style={{ ...inputStyle, flex: "none", width: "100%" }} />
                <button onClick={passwordLogin} disabled={busy} style={{ width: "100%", padding: "14px 22px", borderRadius: 999, border: 0, cursor: busy ? "default" : "pointer", background: INK, color: "#fff", fontFamily: "inherit", fontSize: 14.5, fontWeight: 700, opacity: busy ? 0.7 : 1, boxShadow: "0 10px 26px rgba(20,18,26,0.22)" }}>
                  {busy ? "…" : "Anmelden →"}
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                <button onClick={() => { setView("register"); setErr(null); }} disabled={busy} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: INK }}>
                  Neu hier? Konto erstellen
                </button>
                <button onClick={() => { setView("email"); setErr(null); setRegMode(false); setUsername(""); setPassword(""); }} disabled={busy} style={{ border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: INK_FAINT }}>
                  Passwort vergessen?
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }} aria-hidden>
                <span style={{ flex: 1, height: 1, background: LINE }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: INK_FAINT, letterSpacing: "0.08em" }}>ODER</span>
                <span style={{ flex: 1, height: 1, background: LINE }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={startGoogle} disabled={busy} style={secondaryBtn}><GoogleIcon /> Mit Google anmelden</button>
                <button onClick={() => { setView("shopify"); setErr(null); }} disabled={busy} style={secondaryBtn}><ShopifyIcon /> Mit Shopify anmelden</button>
              </div>
            </>
          )}
        </>
      )}

      {onCancel && (
        <button onClick={onCancel} style={{ marginTop: 16, border: 0, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, color: INK_FAINT }}>
          Abbrechen
        </button>
      )}
    </div>
  );
}

/** Modal-Variante für den Editor (Overlay + Karte). */
export default function EditorLoginModal({ next, onClose }: { next: string; onClose: () => void }) {
  // ESC schließt das Login-Fenster (die Karte selbst hat keinen Handler).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0"
        style={{ background: "rgba(20,18,26,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", border: 0, cursor: "pointer" }}
        aria-label="Schließen"
        onClick={onClose}
      />
      <div className="relative">
        <EditorLoginCard next={next} onCancel={onClose} />
      </div>
    </div>
  );
}
