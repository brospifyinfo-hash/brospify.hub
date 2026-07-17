"use client";

// ─── Profil-Icon + Dropdown in der Editor-Toolbar ──────────────────────
// Auffälliger Gradient-Avatar; Klick öffnet ein schickes Dropdown mit
// Plan/Credits/Designs, Schnell-Sprachumschaltung und den Aktionen
// „Konto & Einstellungen" (öffnet das große Overlay) + „Abmelden".
// Feste helle Inline-Farben (Landing-Look), damit White-Mode nichts kippt.

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useCredits } from "@/lib/credits";

const INK = "#14121a";
const INK_SOFT = "#5b5766";
const INK_FAINT = "#8c8896";
const LINE = "rgba(20,18,26,0.12)";
const GRAD = "linear-gradient(120deg,#7c3aed,#ec4899 52%,#fb923c)";

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
function fmt(n: number): string { return n.toLocaleString("de-DE"); }

export default function ProfileMenu({
  isAdmin, onOpenSettings, onOpenPlans, compact,
}: {
  isAdmin: boolean;
  onOpenSettings: () => void;
  onOpenPlans: () => void;
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
  const size = compact ? 34 : 36;

  return (
    <div ref={wrapRef} style={{ position: "relative", flexShrink: 0 }}>
      {/* Avatar-Button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Profil & Einstellungen"
        title="Profil & Einstellungen"
        style={{
          width: size, height: size, borderRadius: 999, border: "2px solid rgba(255,255,255,0.6)",
          background: GRAD, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
          display: "grid", placeItems: "center", padding: 0,
          boxShadow: open ? "0 0 0 3px rgba(124,58,237,0.35), 0 8px 22px rgba(236,72,153,0.4)" : "0 6px 18px rgba(236,72,153,0.38)",
          transition: "box-shadow .2s, transform .2s", transform: open ? "scale(1.04)" : "none",
        }}
      >
        {isAdmin ? "∞" : initialOf(acc)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 90,
              width: 300, background: "#fff", borderRadius: 20,
              border: "1px solid rgba(20,18,26,0.08)", boxShadow: "0 30px 80px -18px rgba(20,18,26,0.4)",
              overflow: "hidden", fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
              color: INK, textAlign: "left",
            }}
          >
            {/* Kopf: Avatar + Name + Plan-Badge */}
            <div style={{ padding: "18px 18px 16px", background: "linear-gradient(180deg, rgba(124,58,237,0.07), rgba(255,255,255,0))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: GRAD, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19, boxShadow: "0 6px 16px rgba(236,72,153,0.4)" }}>
                  {isAdmin ? "∞" : initialOf(acc)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc?.name || acc?.username || (isAdmin ? "Admin" : "Dein Konto")}
                  </div>
                  <div style={{ fontSize: 12, color: INK_FAINT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc?.email || ""}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span style={{
                  display: "inline-block", fontSize: 11, fontWeight: 800, letterSpacing: "0.03em",
                  padding: "5px 12px", borderRadius: 999, color: active || isAdmin ? "#fff" : INK_SOFT,
                  background: active || isAdmin ? GRAD : "rgba(20,18,26,0.06)",
                }}>
                  {isAdmin ? "ADMIN" : active ? `${acc?.plan?.label} · ${acc?.plan?.priceEur} €/Mon.` : "Gratis-Vorschau"}
                </span>
              </div>
            </div>

            {/* Schnell-Stats */}
            <div style={{ display: "flex", gap: 10, padding: "0 18px 14px" }}>
              <Stat label="Credits" value={balance} />
              <Stat label="Designs" value={acc?.designs ? (acc.designs.limit === -1 ? `${acc.designs.used}/∞` : `${acc.designs.used}/${acc.designs.limit}`) : (isAdmin ? "∞" : "–")} />
            </div>

            <div style={{ height: 1, background: LINE }} />

            {/* Aktionen */}
            <div style={{ padding: 8 }}>
              <MenuItem onClick={() => { setOpen(false); onOpenSettings(); }} icon="⚙️" label="Konto & Einstellungen" />
              {!isAdmin && (
                <MenuItem onClick={() => { setOpen(false); onOpenPlans(); }} icon="✨" label={active ? "Plan wechseln" : "Plan upgraden"} accent />
              )}
            </div>

            {/* Sprache */}
            {!isAdmin && (
              <>
                <div style={{ height: 1, background: LINE }} />
                <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: INK_FAINT, marginRight: "auto" }}>Sprache</span>
                  {(["de", "en"] as const).map((l) => (
                    <button key={l} onClick={() => setLang(l)} style={{
                      border: `1.5px solid ${lang === l ? "#7c3aed" : LINE}`, background: lang === l ? "rgba(124,58,237,0.08)" : "#fff",
                      color: lang === l ? INK : INK_SOFT, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                      fontFamily: "inherit", fontSize: 12, fontWeight: 700,
                    }}>{l === "de" ? "DE" : "EN"}</button>
                  ))}
                </div>
              </>
            )}

            <div style={{ height: 1, background: LINE }} />
            <div style={{ padding: 8 }}>
              <MenuItem onClick={() => { window.location.href = "/api/auth/logout"; }} icon="↩︎" label="Abmelden" muted />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${LINE}`, background: "#fff" }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.05em", color: INK_FAINT, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 16, fontWeight: 800, color: INK }}>{value}</div>
    </div>
  );
}
function MenuItem({ onClick, icon, label, accent, muted }: { onClick: () => void; icon: string; label: string; accent?: boolean; muted?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px",
        borderRadius: 12, border: 0, background: "transparent", cursor: "pointer",
        fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
        color: accent ? "#7c3aed" : muted ? INK_SOFT : INK, textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = accent ? "rgba(124,58,237,0.08)" : "rgba(20,18,26,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: "center" }} aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
