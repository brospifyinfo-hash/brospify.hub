"use client";

// ─── /coaching ───────────────────────────────────────────────────
// Membership-only area: a curated feed of coaching tips (written by
// the admin or drafted by AI) plus a direct WhatsApp line.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Lock,
  Crown,
  ArrowRight,
  MessageCircle,
  Sparkles,
  UserCog,
  Lightbulb,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface CoachingTip {
  id: string;
  title: string;
  body: string;
  mediaUrl: string;
  author: string;
  createdAt: string;
}

// Build a wa.me link from a loosely-formatted number (strips spaces,
// dashes, leading +/00).
function whatsappLink(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "").replace(/^00/, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}`;
}

export default function CoachingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [lockTier, setLockTier] = useState<string | null>(null);
  const [tips, setTips] = useState<CoachingTip[]>([]);
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((sess) => {
        if (!sess.isLoggedIn) {
          router.push("/");
          return;
        }
        return fetch("/api/coaching");
      })
      .then(async (res) => {
        if (!res) return;
        if (res.status === 403) {
          const d = await res.json().catch(() => ({}));
          setLocked(true);
          setLockTier(d.tier ?? null);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTips(Array.isArray(data.tips) ? data.tips : []);
        setWhatsapp(data.whatsapp || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const waLink = whatsappLink(whatsapp);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Locked — keine aktive Membership ──
  if (locked) {
    return (
      <div className="min-h-screen bg-mesh">
        <Navigation />
        <div className="max-w-xl mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-2xl border border-white/10 p-8 text-center"
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-400/30"
              style={{ background: "linear-gradient(135deg, rgba(250,204,21,0.25), rgba(202,138,4,0.1))" }}
            >
              <Lock className="w-7 h-7 text-yellow-300" />
            </div>
            <h1 className="text-lg font-bold">Privates Coaching ist Membership-exklusiv</h1>
            <p className="text-[12px] text-zinc-400 mt-2 leading-relaxed">
              Persönliche Tipps vom Brospify-Team und ein direkter WhatsApp-Draht zum Support.
              Mit aktiver Brospify Membership freigeschaltet.
            </p>
            <button
              onClick={() => router.push("/tiers")}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold"
              style={{
                background: "linear-gradient(135deg, #fde047 0%, #ca8a04 100%)",
                color: "#422006",
              }}
            >
              <Crown className="w-4 h-4" />
              Membership buchen
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-64 h-64 bg-yellow-500/[0.07] rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-base font-bold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-yellow-400 shrink-0" />
            Privates Coaching
            <span
              className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border"
              style={{
                background: "rgba(250,204,21,0.15)",
                borderColor: "rgba(250,204,21,0.35)",
                color: "#fde047",
              }}
            >
              Membership
            </span>
          </h1>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Tipps vom Brospify-Team — und ein direkter Draht zu uns.
          </p>
        </motion.div>

        {/* WhatsApp contact card */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-emerald-500/25 overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(0,0,0,0) 100%)" }}
        >
          <div className="p-4 flex items-center gap-3 flex-wrap">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold">Direkter WhatsApp-Support</h2>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Als Membership-Mitglied erreichst du uns direkt — Fragen zu Shop, Strategie oder Tools.
              </p>
            </div>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold bg-emerald-500 text-emerald-950 hover:brightness-110 transition shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp schreiben
              </a>
            ) : (
              <span className="text-[10px] text-zinc-500 shrink-0">
                WhatsApp-Kontakt wird in Kürze hinterlegt.
              </span>
            )}
          </div>
        </motion.div>

        {/* Tips feed */}
        <div className="space-y-2">
          <h3 className="text-[10px] uppercase tracking-[0.16em] font-bold text-zinc-400 flex items-center gap-1.5 pt-1">
            <Lightbulb className="w-3 h-3" />
            Coaching-Tipps
          </h3>

          {tips.length === 0 && (
            <div className="glass-strong rounded-xl p-6 border border-white/10 text-center">
              <Lightbulb className="w-9 h-9 text-zinc-600 mx-auto mb-2" />
              <h2 className="text-sm font-bold mb-1">Noch keine Tipps</h2>
              <p className="text-xs text-zinc-500">Sobald wir Coaching-Inhalte hinterlegen, erscheinen sie hier.</p>
            </div>
          )}

          {tips.map((tip, idx) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * idx }}
              className="glass-strong rounded-xl border border-white/10 overflow-hidden"
            >
              {tip.mediaUrl && (
                <div className="aspect-video bg-zinc-900 border-b border-white/5">
                  <img src={tip.mediaUrl} alt={tip.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <h2 className="text-sm font-bold flex-1 min-w-0">{tip.title}</h2>
                  <span
                    className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border inline-flex items-center gap-1 shrink-0 ${
                      tip.author === "ai"
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-300"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {tip.author === "ai" ? <Sparkles className="w-2.5 h-2.5" /> : <UserCog className="w-2.5 h-2.5" />}
                    {tip.author === "ai" ? "KI" : "Team"}
                  </span>
                </div>
                {tip.body && (
                  <p className="text-[12px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{tip.body}</p>
                )}
                {tip.createdAt && (
                  <p className="text-[9px] text-zinc-600 mt-2">
                    {new Date(tip.createdAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
