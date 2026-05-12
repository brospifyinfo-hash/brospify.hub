"use client";

// ─── /ai-support ─────────────────────────────────────────────────
// Two views in one page:
//   1) "Neuer Chat"     — fresh AI conversation, escalates to ticket
//   2) "Meine Tickets"  — persistent list of past tickets + chat
//
// Tickets are stored on Google Sheets via /api/tickets. The chat
// remains accessible forever — clicking a ticket reopens the full
// thread, the user can continue if open, or read history if closed.
//
// Deep-link: /ai-support?ticket=<id> jumps directly into a ticket.

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ChevronLeft,
  Clock,
  Inbox,
  Plus,
  ChevronRight,
  Lock,
} from "lucide-react";
import Navigation from "@/components/Navigation";
import {
  useResilientJob,
  readJobResponse,
  JobDebugPanel,
  TerminalJobError,
} from "@/lib/resilient-job";

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

interface TicketSummary {
  id: string;
  subject: string;
  status: "open" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: { sender: string; name: string; content: string; timestamp: string }[];
}

type View = "chat" | "tickets" | "ticket-detail";

export default function AISupportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-mesh flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AISupportContent />
    </Suspense>
  );
}

function AISupportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // View state
  const [view, setView] = useState<View>("chat");
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // AI chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatJob = useResilientJob<{ reply: string; shouldEscalate?: boolean }>("ai-chat");
  const [attemptCount, setAttemptCount] = useState(0);
  const [showEscalation, setShowEscalation] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Tickets list
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Active ticket detail
  const [activeTicket, setActiveTicket] = useState<TicketSummary | null>(null);
  const [liveInput, setLiveInput] = useState("");
  const [sendingLive, setSendingLive] = useState(false);
  const liveEndRef = useRef<HTMLDivElement>(null);

  // ── Init ──
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

  // ── Read deep-link param ──
  useEffect(() => {
    const ticketId = searchParams.get("ticket");
    if (ticketId) {
      setActiveTicketId(ticketId);
      setView("ticket-detail");
    } else {
      const v = searchParams.get("view");
      if (v === "tickets") setView("tickets");
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showEscalation]);

  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTicket?.messages]);

  // ── Tickets list loader ──
  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetch("/api/tickets");
      if (res.ok) {
        const data = await res.json();
        const all: TicketSummary[] = data.tickets || [];
        all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        setTickets(all);
      }
    } catch { /* ignore */ }
    finally { setTicketsLoading(false); }
  }, []);

  useEffect(() => {
    if (view === "tickets" || view === "ticket-detail") {
      loadTickets();
    }
  }, [view, loadTickets]);

  // ── Active ticket detail loader ──
  const loadTicket = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/tickets?ticketId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveTicket(data.ticket || null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (view === "ticket-detail" && activeTicketId) {
      loadTicket(activeTicketId);
    } else if (view !== "ticket-detail") {
      setActiveTicket(null);
    }
  }, [view, activeTicketId, loadTicket]);

  // Poll active open ticket
  useEffect(() => {
    if (view !== "ticket-detail" || !activeTicketId || activeTicket?.status !== "open") return;
    const t = setInterval(() => loadTicket(activeTicketId), 8000);
    return () => clearInterval(t);
  }, [view, activeTicketId, activeTicket?.status, loadTicket]);

  // ── Handlers ──
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
      const data = await chatJob.run({
        hint: "AI-Antwort wird erstellt",
        attempt: async () => {
          const res = await fetch("/api/ai-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
              attemptCount: newAttempt,
            }),
          });
          return await readJobResponse<{ reply: string; shouldEscalate?: boolean }>(res);
        },
      });
      const assistantMsg: ChatMsg = {
        role: "assistant",
        content: data.reply,
        isEscalation: data.shouldEscalate,
      };
      setMessages([...newMessages, assistantMsg]);
      if (data.shouldEscalate) setShowEscalation(true);
    } catch (err) {
      const msg = err instanceof TerminalJobError ? err.message : "Verbindungsfehler.";
      setError(msg);
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
        // Switch to the new ticket detail view
        setActiveTicketId(data.ticket.id);
        setActiveTicket(data.ticket);
        setView("ticket-detail");
        // Reset chat
        setMessages([]);
        setShowEscalation(false);
        setAttemptCount(0);
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
    if (!liveInput.trim() || sendingLive || !activeTicketId) return;
    setSendingLive(true);
    try {
      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: activeTicketId,
          message: liveInput.trim(),
          senderName: session?.googleName || "Kunde",
        }),
      });
      setLiveInput("");
      await loadTicket(activeTicketId);
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
    <div className="min-h-screen bg-mesh">
      <Navigation />

      <div className="fixed top-32 right-8 w-56 h-56 bg-purple-500/[0.05] rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-20 left-8 w-44 h-44 bg-blue-500/[0.04] rounded-full blur-[80px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3">

        {/* ─── Header ─── */}
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-purple-500/20 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight">
                <span className="ai-gradient-text">Support</span>
              </h1>
              <p className="text-[10px] text-zinc-500 truncate">
                KI-Chat & deine Support-Tickets
              </p>
            </div>
          </div>
        </motion.div>

        {/* ─── Tabs ─── */}
        {view !== "ticket-detail" && (
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <button
              onClick={() => setView("chat")}
              className={`px-3 py-2 rounded-lg text-[12px] font-semibold transition flex items-center justify-center gap-1.5 ${
                view === "chat" ? "bg-purple-500/15 border border-purple-500/30 text-purple-300" : "text-zinc-400"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Neuer Chat
            </button>
            <button
              onClick={() => setView("tickets")}
              className={`px-3 py-2 rounded-lg text-[12px] font-semibold transition flex items-center justify-center gap-1.5 ${
                view === "tickets" ? "bg-amber-500/15 border border-amber-500/30 text-amber-300" : "text-zinc-400"
              }`}
            >
              <Inbox className="w-3.5 h-3.5" /> Meine Tickets
              {tickets.length > 0 && (
                <span className="ml-0.5 px-1 py-px rounded text-[9px] font-bold bg-white/[0.08] text-zinc-300 tabular-nums">
                  {tickets.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* ─── Error toast ─── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-red-300 text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError("")}><X className="w-3 h-3" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Views ─── */}
        {view === "ticket-detail" ? (
          <TicketDetailView
            ticket={activeTicket}
            onBack={() => { setView("tickets"); router.replace("/ai-support?view=tickets"); }}
            liveInput={liveInput}
            setLiveInput={setLiveInput}
            sendingLive={sendingLive}
            onSendLive={handleSendLive}
            liveEndRef={liveEndRef}
          />
        ) : view === "tickets" ? (
          <TicketsListView
            tickets={tickets}
            loading={ticketsLoading}
            onOpenTicket={(id) => { setActiveTicketId(id); setView("ticket-detail"); router.replace(`/ai-support?ticket=${id}`); }}
            onStartChat={() => setView("chat")}
          />
        ) : (
          <ChatView
            messages={messages}
            input={input}
            setInput={setInput}
            sending={sending}
            onSend={handleSend}
            attemptCount={attemptCount}
            showEscalation={showEscalation}
            onCreateTicket={handleCreateTicket}
            creatingTicket={creatingTicket}
            messagesEndRef={messagesEndRef}
            jobState={chatJob.state}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tickets List View ──────────────────────────────────────────

function TicketsListView({ tickets, loading, onOpenTicket, onStartChat }: {
  tickets: TicketSummary[];
  loading: boolean;
  onOpenTicket: (id: string) => void;
  onStartChat: () => void;
}) {
  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-3">
            <Inbox className="w-5 h-5 text-zinc-500" />
          </div>
          <h3 className="text-sm font-bold mb-1">Noch keine Tickets</h3>
          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto mb-4">
            Tickets werden gespeichert, sobald du den KI-Chat eskalierst. Der Verlauf bleibt für dich abrufbar.
          </p>
          <button
            onClick={onStartChat}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-300 text-xs font-semibold hover:bg-purple-500/20 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            KI-Chat starten
          </button>
        </div>
      ) : (
        tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => onOpenTicket(ticket.id)}
            className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition text-left"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              ticket.status === "open"
                ? "bg-amber-500/12 border-amber-500/25"
                : ticket.status === "resolved"
                  ? "bg-emerald-500/12 border-emerald-500/25"
                  : "bg-zinc-500/12 border-zinc-500/25"
            }`}>
              {ticket.status === "closed" ? (
                <Lock className="w-4 h-4 text-zinc-400" />
              ) : (
                <MessageCircle className={`w-4 h-4 ${
                  ticket.status === "open" ? "text-amber-400" : "text-emerald-400"
                }`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-zinc-200 truncate">{ticket.subject}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  ticket.status === "open" ? "text-amber-400" :
                  ticket.status === "resolved" ? "text-emerald-400" : "text-zinc-500"
                }`}>
                  {ticket.status === "open" ? "Offen" : ticket.status === "resolved" ? "Gelöst" : "Geschlossen"}
                </span>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelative(ticket.updatedAt)}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {ticket.messages.length} Msg
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
          </button>
        ))
      )}

      {tickets.length > 0 && (
        <button
          onClick={onStartChat}
          className="w-full flex items-center justify-center gap-1.5 mt-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold hover:bg-purple-500/15 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Neuen KI-Chat starten
        </button>
      )}
    </div>
  );
}

// ─── Ticket Detail View ─────────────────────────────────────────

function TicketDetailView({ ticket, onBack, liveInput, setLiveInput, sendingLive, onSendLive, liveEndRef }: {
  ticket: TicketSummary | null;
  onBack: () => void;
  liveInput: string;
  setLiveInput: (v: string) => void;
  sendingLive: boolean;
  onSendLive: () => void;
  liveEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (!ticket) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  const isOpen = ticket.status === "open";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] transition shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate">{ticket.subject}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest ${
              isOpen ? "text-amber-400" :
              ticket.status === "resolved" ? "text-emerald-400" : "text-zinc-500"
            }`}>
              {isOpen ? "Offen" : ticket.status === "resolved" ? "Gelöst" : "Geschlossen"}
            </span>
            <span className="text-[9px] text-zinc-600 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatRelative(ticket.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {!isOpen && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] ${
          ticket.status === "resolved"
            ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-300"
            : "bg-zinc-500/8 border-zinc-500/20 text-zinc-400"
        }`}>
          {ticket.status === "resolved" ? <CheckCircle className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {ticket.status === "resolved"
            ? "Dieses Ticket wurde gelöst. Der Verlauf bleibt jederzeit für dich abrufbar."
            : "Dieses Ticket ist geschlossen. Du kannst den Verlauf einsehen."}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
        {ticket.messages.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-6">Keine Nachrichten.</div>
        ) : (
          ticket.messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.sender === "customer" ? "flex-row-reverse" : ""}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold border ${
                msg.sender === "admin"
                  ? "bg-[#95BF47]/15 border-[#95BF47]/25 text-[#95BF47]"
                  : msg.sender === "ai"
                  ? "bg-purple-500/15 border-purple-500/25 text-purple-400"
                  : "bg-blue-500/15 border-blue-500/25 text-blue-400"
              }`}>
                {msg.sender === "admin" ? "A" : msg.sender === "ai" ? "KI" : "Du"}
              </div>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[12px] ${
                msg.sender === "customer"
                  ? "bg-blue-500/10 border border-blue-500/15 text-zinc-100"
                  : msg.sender === "admin"
                  ? "bg-[#95BF47]/8 border border-[#95BF47]/15 text-zinc-100"
                  : "bg-white/[0.04] border border-white/[0.08] text-zinc-200"
              }`}>
                <div className="text-[10px] text-zinc-500 mb-0.5 font-medium">{msg.name}</div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </motion.div>
          ))
        )}
        <div ref={liveEndRef} />
      </div>

      {/* Reply input — only for open tickets */}
      {isOpen ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={liveInput}
              onChange={(e) => setLiveInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSendLive()}
              placeholder="Antwort senden…"
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder:text-zinc-600"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onSendLive}
              disabled={sendingLive || !liveInput.trim()}
              className="w-8 h-8 rounded-lg bg-[#95BF47] flex items-center justify-center text-black disabled:opacity-30 transition shrink-0"
            >
              {sendingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </motion.button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Chat View ──────────────────────────────────────────────────

function ChatView({ messages, input, setInput, sending, onSend, attemptCount, showEscalation, onCreateTicket, creatingTicket, messagesEndRef, jobState }: {
  messages: ChatMsg[];
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  attemptCount: number;
  showEscalation: boolean;
  onCreateTicket: () => void;
  creatingTicket: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  jobState: import("@/lib/resilient-job").ResilientJobState;
}) {
  return (
    <div className="space-y-3">
      {/* Empty state */}
      {messages.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-purple-500/15 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-purple-400/60" />
          </div>
          <h2 className="text-sm font-bold text-zinc-300 mb-1.5">Wie kann ich helfen?</h2>
          <p className="text-[11px] text-zinc-600 max-w-sm mx-auto mb-4">
            Stelle deine Frage, der KI-Agent versucht sie sofort zu lösen. Falls nicht, wird daraus ein Ticket.
          </p>
          <div className="grid grid-cols-2 gap-1.5 max-w-md mx-auto">
            {[
              "Wie importiere ich ein Produkt?",
              "Was kostet der Service?",
              "Wie verbinde ich Shopify?",
              "Hilfe bei SEO",
            ].map((q) => (
              <button
                key={q}
                onClick={() => setInput(q)}
                className="text-left text-[11px] text-zinc-400 px-2.5 py-2 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition flex items-start gap-1.5"
              >
                <MessageCircle className="w-3 h-3 text-purple-400/60 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{q}</span>
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                msg.role === "assistant"
                  ? "bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-purple-500/15"
                  : "bg-white/[0.06] border border-white/[0.08]"
              }`}>
                {msg.role === "assistant"
                  ? <Bot className="w-3.5 h-3.5 text-purple-400" />
                  : <User className="w-3.5 h-3.5 text-zinc-400" />
                }
              </div>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-blue-500/10 border border-blue-500/15"
                  : "bg-white/[0.04] border border-white/[0.06]"
              }`}>
                <p className="text-[12px] text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </motion.div>
          ))}

          {sending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-purple-500/15 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-[10px] text-zinc-500 ml-0.5">denkt nach…</span>
                </div>
              </div>
              <JobDebugPanel state={jobState} compact />
            </motion.div>
          )}

          {/* Escalation */}
          <AnimatePresence>
            {showEscalation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/8 to-orange-500/5 p-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[12px] font-bold text-amber-300 mb-1">Brauchst du echten Menschen-Support?</h4>
                    <p className="text-[10px] text-zinc-400 mb-2.5 leading-relaxed">
                      Wir machen daraus ein Live-Ticket — der gesamte Chat-Verlauf wird mitgeschickt und bleibt für dich gespeichert.
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={onCreateTicket}
                      disabled={creatingTicket}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-[11px] disabled:opacity-50"
                    >
                      {creatingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                      {creatingTicket ? "Erstelle Ticket…" : "Live-Ticket eröffnen"}
                      {!creatingTicket && <ArrowRight className="w-3 h-3" />}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            placeholder="Stelle deine Frage…"
            disabled={sending}
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-white placeholder:text-zinc-600 disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onSend}
            disabled={sending || !input.trim()}
            className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white disabled:opacity-30 transition shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </motion.button>
        </div>
        <div className="mt-1.5 px-1 flex items-center gap-1.5">
          <Bot className="w-2.5 h-2.5 text-zinc-700" />
          <span className="text-[10px] text-zinc-700">
            DeepSeek AI{attemptCount > 0 ? ` · Versuch ${attemptCount}/2` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatRelative(iso: string): string {
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
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" });
}
