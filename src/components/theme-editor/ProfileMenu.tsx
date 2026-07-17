"use client";

// ─── Profil-Menü (Titelleiste, ganz rechts) ─────────────────────────────
// Sitzt wie in jedem Profi-Programm in der äußersten rechten Ecke der
// Titelleiste. Klick öffnet ein aufgeräumtes Konto-Panel: Kopf mit Avatar/
// Name/Plan, Schnell-Stats (Credits · Projekte), klare Aktionen mit
// Lucide-Icons, Sprachumschalter, Abmelden. Feste helle Inline-Farben
// (Landing-Look), damit die White-Mode-Wildcards nichts kippen.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Crown, Keyboard, Globe, LogOut, ChevronDown, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useCredits } from "@/lib/credits";

const INK = "#14121a";
const INK_SOFT = "#5b5766";
const INK_FAINT = "#8c8896";
const LINE = "rgba(20,18,26,0.1)";
const GRAD = "linear-gradient(120deg,#7c3aed,#ec4899 52%,#fb923c)";
const PURPLE = "#7c3aed";

interface Acc {
  loggedIn: boolean;
  isAdmin?: boolean;
  name?: string | null;
  email?: string | null;
  username?: string | null;
  plan?: { active: boolean; label: string | null; priceEur: number };
  credits?: { balance: number | null };
  designs?: { used: number; limit: number };
}

function initialOf(a: Acc | null): string {
  const s = (a?.name || a?.username || a?.email || "").trim();
  return s ? s[0]!.toUpperCase() : "★";
}

export default function ProfileMenu({
  isAdmin, onOpenSettings, onOpenPlans, onOpenShortcuts, compact,
}: {
  isAdmin: boolean;
  onOpenSettings: () => void;
  onOpenPlans: () => void;
  onOpenShortcuts?: () => void;
  compact?: boolean;
}) {
  const { lang, setLang } = useI18n();
  const credits = useCredits();
  const [open, setOpen] = useState(false);
  const [acc, setAcc] = useState<Acc | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/editor/account", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAcc(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const active = acc?.plan?.active === true;
  const balance = isAdmin ? "∞" : credits.loading ? "…" : String(credits.balance);
  const size = compact ? 32 : 30;
  const de = lang === "de";

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      {/* Avatar-Pill: Avatar + Chevron — klar als Menü erkennbar */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={de ? "Konto-Menü öffnen" : "Open account menu"}
        aria-expanded={open}
        title={de ? "Konto" : "Account"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer",
          border: `1px solid ${open ? "rgba(124,58,237,0.55)" : "rgba(20,18,26,0.14)"}`,
          background: "#fff", borderRadius: 999, padding: compact ? 2 : "2px 6px 2px 2px",
          boxShadow: open ? "0 0 0 3px rgba(124,58,237,0.14)" : "0 1px 2px rgba(20,18,26,0.06)",
          transition: "border-color .15s, box-shadow .15s",
        }}
      >
        <span style={{
          width: size, height: size, borderRadius: 999, background: GRAD, color: "#fff",
          fontWeight: 800, fontSize: compact ? 13 : 12.5, display: "grid", placeItems: "center",
        }}>
          {isAdmin ? "∞" : initialOf(acc)}
        </span>
        {!compact && (
          <ChevronDown style={{
            width: 13, height: 13, color: INK_SOFT,
            transform: open ? "rotate(180deg)" : "none", transition: "transform .18s",
          }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 90,
              width: 316, background: "#fff", borderRadius: 18,
              border: "1px solid rgba(20,18,26,0.09)",
              boxShadow: "0 8px 24px -12px rgba(20,18,26,0.18), 0 32px 80px -20px rgba(20,18,26,0.35)",
              overflow: "hidden", fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
              color: INK, textAlign: "left",
            }}
          >
            {/* Kopf: Avatar + Name + E-Mail + Plan-Chip */}
            <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${LINE}`, background: "linear-gradient(180deg, rgba(124,58,237,0.06), rgba(255,255,255,0))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 999, background: GRAD, color: "#fff",
                  display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19,
                  boxShadow: "0 6px 16px rgba(236,72,153,0.35)", flexShrink: 0,
                }}>
                  {isAdmin ? "∞" : initialOf(acc)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc?.name || acc?.username || (isAdmin ? "Admin" : de ? "Dein Konto" : "Your account")}
                  </div>
                  <div style={{ fontSize: 11.5, color: INK_FAINT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc?.email || ""}
                  </div>
                  <span style={{
                    display: "inline-block", marginTop: 5, fontSize: 10, fontWeight: 800, letterSpacing: "0.04em",
                    padding: "3px 9px", borderRadius: 999, color: active || isAdmin ? "#fff" : INK_SOFT,
                    background: active || isAdmin ? GRAD : "rgba(20,18,26,0.06)",
                  }}>
                    {isAdmin ? "ADMIN" : active ? `${acc?.plan?.label} · ${acc?.plan?.priceEur} €/${de ? "Mon." : "mo"}` : de ? "Gratis-Vorschau" : "Free preview"}
                  </span>
                </div>
              </div>
            </div>

            {/* Schnell-Stats */}
            <div style={{ display: "flex", gap: 8, padding: "12px 14px 4px" }}>
              <Stat label="Credits" value={balance} />
              <Stat
                label={de ? "Projekte" : "Projects"}
                value={acc?.designs ? (acc.designs.limit === -1 ? `${acc.designs.used}/∞` : `${acc.designs.used}/${acc.designs.limit}`) : (isAdmin ? "∞" : "–")}
              />
            </div>

            {/* Aktionen */}
            <div style={{ padding: "8px 8px 4px" }}>
              <MenuItem onClick={() => { setOpen(false); onOpenSettings(); }} icon={Settings} label={de ? "Konto & Einstellungen" : "Account & settings"} />
              {!isAdmin && (
                <MenuItem
                  onClick={() => { setOpen(false); onOpenPlans(); }}
                  icon={Crown}
                  label={active ? (de ? "Plan wechseln" : "Change plan") : (de ? "Plan upgraden" : "Upgrade plan")}
                  accent
                />
              )}
              {onOpenShortcuts && (
                <MenuItem onClick={() => { setOpen(false); onOpenShortcuts(); }} icon={Keyboard} label={de ? "Tastaturkürzel" : "Keyboard shortcuts"} />
              )}
            </div>

            {/* Sprache */}
            <div style={{ margin: "4px 8px", padding: "8px 8px", borderTop: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Globe style={{ width: 15, height: 15, color: INK_FAINT, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: INK_SOFT, marginRight: "auto" }}>{de ? "Sprache" : "Language"}</span>
              <div style={{ display: "flex", background: "rgba(20,18,26,0.05)", borderRadius: 999, padding: 2 }}>
                {(["de", "en"] as const).map((l) => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    border: 0, background: lang === l ? "#fff" : "transparent",
                    color: lang === l ? INK : INK_FAINT, borderRadius: 999, padding: "4px 12px", cursor: "pointer",
                    fontFamily: "inherit", fontSize: 11.5, fontWeight: 800,
                    boxShadow: lang === l ? "0 1px 3px rgba(20,18,26,0.14)" : "none",
                  }}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            {/* Abmelden + Marke */}
            <div style={{ padding: "4px 8px 8px", borderTop: `1px solid ${LINE}` }}>
              <MenuItem onClick={() => { window.location.href = "/api/auth/logout"; }} icon={LogOut} label={de ? "Abmelden" : "Sign out"} muted />
            </div>
            <div style={{ padding: "7px 16px 9px", background: "rgba(20,18,26,0.025)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: GRAD }} aria-hidden />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: INK_FAINT, letterSpacing: "0.02em" }}>Brospify Editor</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: "9px 12px", borderRadius: 12, border: `1px solid ${LINE}`, background: "rgba(20,18,26,0.02)" }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em", color: INK_FAINT, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 15.5, fontWeight: 800, color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function MenuItem({ onClick, icon: Ico, label, accent, muted }: {
  onClick: () => void; icon: LucideIcon; label: string; accent?: boolean; muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
        borderRadius: 11, border: 0, background: "transparent", cursor: "pointer",
        fontFamily: "inherit", fontSize: 13, fontWeight: 700,
        color: accent ? PURPLE : muted ? INK_SOFT : INK, textAlign: "left",
        transition: "background .12s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = accent ? "rgba(124,58,237,0.08)" : "rgba(20,18,26,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <Ico style={{ width: 16, height: 16, flexShrink: 0, color: accent ? PURPLE : INK_FAINT }} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
