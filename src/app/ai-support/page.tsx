"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Send,
  Loader2,
  Ticket,
  AlertTriangle,
  CheckCircle,
  User,
  Sparkles,
  ArrowRight,
  MessageCircle,
  X,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  isEscalation?: boolean;
}

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  googleName?: string;
  lizenzschluessel?: string;
}

interface TicketData {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
}

export default function AISupportPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [showEscalation, setShowEscalation] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketCreated, setTicketCreated] = useState<TicketData | null>(null);
  const [liveMessages, setLiveMessages] = useState<{ sender: string; name: string; content: string; timestamp: string }[]>([]);
  const [liveInput, setLiveInput] = useState("");
  const [sendingLive, setSendingLive] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setSession(data);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showEscalation]);

  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  // Poll for live ticket messages
  const pollTicket = useCallback(async (ticketId: string) => {
    try {
      const res = await fetch(`/api/tickets?ticketId=${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        setLiveMessages(data.ticket?.messages || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!ticketCreated) return;
    const interval = setInterval(() => pollTicket(ticketCreated.id), 5000);
    return () => clearInterval(interval);
  }, [ticketCreated, pollTicket]);

  async function handleSend() {
    if (!input.trim() || sending) return;

    const userMsg: ChatMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setSending(true);
    setError("");

    const newAttempt = attemptCount + 1;
    setAttemptCount(newAttempt);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          attemptCount: newAttempt,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fehler bei der KI-Anfrage.");
        return;
      }

      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: data.reply,
        isEscalation: data.shouldEscalate,
      };
      setMessages([...newMessages, assistantMsg]);

      if (data.shouldEscalate) {
        setShowEscalation(true);
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setSending(false);
    }
  }

  async function handleCreateTicket() {
    if (creatingTicket) return;
    setCreatingTicket(true);

    try {
      const subject = messages.find((m) => m.role === "user")?.content.slice(0, 80) || "Support-Anfrage";
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          aiHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          customerName: session?.googleName || "Kunde",
        }),
      });

      const data = await res.json();
      if (res.ok && data.ticket) {
        setTicketCreated(data.ticket);
        setLiveMessages(data.ticket.messages || []);
      } else {
        setError(data.error || "Ticket konnte nicht erstellt werden.");
      }
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setCreatingTicket(false);
    }
  }

  async function handleSendLive() {
    if (!liveInput.trim() || sendingLive || !ticketCreated) return;
    setSendingLive(true);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticketCreated.id,
          message: liveInput.trim(),
          senderName: session?.googleName || "Kunde",
        }),
      });

      if (res.ok) {
        setLiveInput("");
        await pollTicket(ticketCreated.id);
      }
    } catch { /* ignore */ }
    finally { setSendingLive(false); }
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <Navigation />

      {/* Ambient */}
      <div className="fixed top-32 right-8 w-64 h-64 bg-purple-500/[0.04] rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 left-8 w-48 h-48 bg-blue-500/[0.03] rounded-full blur-[80px] pointer-events-none" />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8 flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-purple-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                <span className="ai-gradient-text">AI Support</span>
              </h1>
              <p className="text-zinc-500 text-sm">Dein intelligenter KI-Assistent</p>
            </div>
          </div>
        </motion.div>

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/15 text-red-300 text-sm"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-xs">{error}</span>
              <button onClick={() => setError("")}><X className="w-3.5 h-3.5" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* LIVE TICKET VIEW */}
        {ticketCreated ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col"
          >
            {/* Ticket Banner */}
            <div className="glass-strong rounded-2xl border border-emerald-500/15 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Live-Ticket erstellt
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                    {ticketCreated.subject}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-600 font-mono">{ticketCreated.id.slice(-8)}</div>
              </div>
            </div>

            {/* Live Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0 max-h-[50vh]">
              {liveMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.sender === "customer" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold ${
                    msg.sender === "admin"
                      ? "bg-[#95BF47]/15 border border-[#95BF47]/20 text-[#95BF47]"
                      : msg.sender === "ai"
                      ? "bg-purple-500/15 border border-purple-500/20 text-purple-400"
                      : "bg-blue-500/15 border border-blue-500/20 text-blue-400"
                  }`}>
                    {msg.sender === "admin" ? "A" : msg.sender === "ai" ? "KI" : "Du"}
                  </div>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                    msg.sender === "customer"
                      ? "bg-blue-500/10 border border-blue-500/10 text-zinc-200"
                      : msg.sender === "admin"
                      ? "bg-[#95BF47]/8 border border-[#95BF47]/10 text-zinc-200"
                      : "bg-white/[0.04] border border-white/[0.06] text-zinc-300"
                  }`}>
                    <div className="text-[10px] text-zinc-500 mb-1 font-medium">{msg.name}</div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
              <div ref={liveEndRef} />
            </div>

            {/* Live Input */}
            <div className="glass-strong rounded-2xl border border-white/[0.08] p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={liveInput}
                  onChange={(e) => setLiveInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendLive()}
                  placeholder="Nachricht an den Admin..."
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-600"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendLive}
                  disabled={sendingLive || !liveInput.trim()}
                  className="w-9 h-9 rounded-xl bg-[#95BF47] flex items-center justify-center text-black disabled:opacity-30 transition"
                >
                  {sendingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* AI CHAT VIEW */
          <div className="flex-1 flex flex-col">
            {/* Empty State */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-12"
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-purple-500/10 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-purple-400/60" />
                </div>
                <h2 className="text-lg font-bold text-zinc-300 mb-2">Wie kann ich dir helfen?</h2>
                <p className="text-sm text-zinc-600 max-w-sm mb-8">
                  Stelle deine Frage und der KI-Agent versucht dir sofort zu helfen. Bei Bedarf wird ein Live-Ticket erstellt.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                  {[
                    "Wie importiere ich ein Produkt?",
                    "Was kostet der Service?",
                    "Wie verbinde ich Shopify?",
                    "Hilfe bei SEO-Optimierung",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-left text-xs text-zinc-400 px-4 py-3 rounded-xl border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all group"
                    >
                      <span className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-purple-400/50 group-hover:text-purple-400 transition" />
                        {q}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 max-h-[55vh]">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                      msg.role === "assistant"
                        ? "bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-purple-500/15"
                        : "bg-white/[0.06] border border-white/[0.08]"
                    }`}>
                      {msg.role === "assistant"
                        ? <Bot className="w-5 h-5 text-purple-400" />
                        : <User className="w-5 h-5 text-zinc-400" />
                      }
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-blue-500/10 border border-blue-500/10"
                        : "bg-white/[0.03] border border-white/[0.06]"
                    }`}>
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </motion.div>
                ))}

                {/* Sending indicator */}
                {sending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-purple-500/15 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[11px] text-zinc-500">denkt nach...</span>
                    </div>
                  </motion.div>
                )}

                {/* Escalation Button */}
                <AnimatePresence>
                  {showEscalation && !ticketCreated && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-orange-500/5 p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-amber-300 mb-1">Weitere Hilfe nötig?</h4>
                          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                            Der KI-Agent konnte dein Anliegen nicht vollständig lösen. Erstelle ein Live-Ticket und ein echter Mitarbeiter hilft dir persönlich weiter.
                          </p>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleCreateTicket}
                            disabled={creatingTicket}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
                          >
                            {creatingTicket
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Ticket className="w-4 h-4" />
                            }
                            {creatingTicket ? "Erstelle Ticket..." : "Live-Ticket zum Admin eröffnen"}
                            {!creatingTicket && <ArrowRight className="w-3.5 h-3.5" />}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Area */}
            <div className="glass-strong rounded-2xl border border-white/[0.08] p-3 mt-auto">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder="Stelle deine Frage..."
                  disabled={sending}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-zinc-600 disabled:opacity-50"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={sending || !input.trim()}
                  className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white disabled:opacity-30 transition shadow-lg shadow-purple-500/15"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </motion.button>
              </div>
              <div className="flex items-center gap-2 mt-2 px-1">
                <Bot className="w-3 h-3 text-zinc-700" />
                <span className="text-[10px] text-zinc-700">
                  Powered by DeepSeek AI {attemptCount > 0 && `· Versuch ${attemptCount}/2`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
