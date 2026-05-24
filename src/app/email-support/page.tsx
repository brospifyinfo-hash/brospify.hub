"use client";

// ─── /email-support ──────────────────────────────────────────
// Klassisches Support-Formular: Betreff + Nachricht, geht direkt
// per E-Mail an brospify.info@gmail.com (via Resend). Alternative
// zum AI Support fuer User die lieber persoenlich schreiben.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Bot,
  ArrowRight,
} from "lucide-react";
import Navigation from "@/components/Navigation";

export default function EmailSupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) {
          router.push("/");
          return;
        }
        setUserEmail(data.googleEmail || "");
        setAuthorized(true);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      setError("Bitte Betreff und Nachricht ausfüllen.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/email-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(String(data.error || "Versand fehlgeschlagen."));
        return;
      }
      setSuccess(true);
      setSubject("");
      setMessage("");
    } catch {
      setError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#95BF47]" />
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />
      <main className="max-w-2xl mx-auto px-3 sm:px-5 py-3 sm:py-5 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-base font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-rose-300" />
            E-Mail Support
          </h1>
          <p className="text-[11px] text-zinc-500">
            Direkte E-Mail an unser Support-Team — Antwort meist innerhalb von 24h
          </p>
        </div>

        {/* Cross-links zu den anderen Support-Optionen */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => router.push("/ai-support")}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left"
          >
            <Bot className="w-4 h-4 text-purple-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-200">AI Support</div>
              <div className="text-[10px] text-zinc-500">Sofort-Antwort per KI</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
          </button>
          <button
            onClick={() => router.push("/ai-support?view=tickets")}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] transition text-left"
          >
            <Inbox className="w-4 h-4 text-blue-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-zinc-200">Meine Tickets</div>
              <div className="text-[10px] text-zinc-500">Frühere Anfragen</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
          </button>
        </div>

        {/* Erfolgs-Banner */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-emerald-100"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-emerald-200">
                E-Mail erfolgreich gesendet
              </div>
              <p className="text-[11px] text-emerald-100/80 mt-0.5">
                Wir haben deine Anfrage an unser Support-Team weitergeleitet. Antwort kommt
                {userEmail ? <> an <strong>{userEmail}</strong></> : null}.
              </p>
            </div>
            <button
              onClick={() => setSuccess(false)}
              className="text-[10px] text-emerald-300/70 hover:text-emerald-200 underline shrink-0"
            >
              Neu schreiben
            </button>
          </motion.div>
        )}

        {/* Error-Banner */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/[0.06] border border-red-500/20 text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] flex-1">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="space-y-3 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
              Betreff <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              placeholder="z. B. Frage zur Theme-Installation"
              maxLength={200}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">
              Nachricht <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sending}
              rows={10}
              maxLength={10000}
              placeholder="Beschreibe dein Anliegen so detailliert wie möglich — gerne mit Schritten, was du schon probiert hast, Screenshots-Links, etc."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 resize-none"
            />
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-zinc-500">
                Wir sehen automatisch deinen Account & Shop — du brauchst nichts zusätzlich angeben.
              </p>
              <span className="text-[10px] text-zinc-600 tabular-nums">
                {message.length}/10000
              </span>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim()}
            className="w-full py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 text-rose-100 transition"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sende E-Mail…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                E-Mail senden
              </>
            )}
          </button>
        </div>

        {/* Footer-Hinweis */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-600">
            Direkt an <strong className="text-zinc-500">brospify.info@gmail.com</strong>. Antwort meist innerhalb von 24h.
          </p>
        </div>
      </main>
    </div>
  );
}
