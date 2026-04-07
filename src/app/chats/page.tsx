"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Hash,
  Plus,
  Send,
  Download,
  Upload,
  Image as ImageIcon,
  Loader2,
  Check,
  X,
  AlertCircle,
  Crown,
  Shield,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  Store,
  Menu as MenuIcon,
  MessageCircle,
  HelpCircle,
  Sparkles,
  Palette,
  ArrowLeft,
} from "lucide-react";
import Navigation from "@/components/Navigation";

/* ─── Category Definitions ─────────────────────────────────────── */
const CATEGORIES = [
  { id: "general", name: "General", icon: MessageCircle },
  { id: "creatives", name: "Creatives", icon: Palette },
  { id: "qa", name: "Q&A", icon: HelpCircle },
];

/* ─── Types ────────────────────────────────────────────────────── */
interface ChatRoom {
  id: string;
  name: string;
  description: string;
  category: string;
  allowCustomerMessages: boolean;
  status: string;
}

interface ChatMessage {
  id: string;
  chatId: string;
  senderType: string;
  senderId: string;
  senderName: string;
  content: string;
  imageUrl: string;
  imageBgColor: string;
  messageStatus: string;
  createdAt: string;
}

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin: boolean;
  hasShopifyToken?: boolean;
  lizenzschluessel?: string;
}

/* ─── Page ─────────────────────────────────────────────────────── */
export default function ChatsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New message
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState("");

  // Admin: create room
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomCategory, setNewRoomCategory] = useState("general");
  const [newRoomAllowMsgs, setNewRoomAllowMsgs] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Admin: image post
  const [showImagePost, setShowImagePost] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageBgColor, setImageBgColor] = useState("#000000");
  const [imageCaption, setImageCaption] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push to Shopify
  const [pushingId, setPushingId] = useState<string | null>(null);

  // Sidebar & categories
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({
    general: true,
    creatives: true,
    qa: true,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ─── Derived: rooms grouped by category ───────────────────── */
  const roomsByCategory = useMemo(() => {
    const grouped: Record<string, ChatRoom[]> = {};
    for (const cat of CATEGORIES) grouped[cat.id] = [];
    for (const room of rooms) {
      const catId = room.category && grouped[room.category] ? room.category : "general";
      grouped[catId].push(room);
    }
    return grouped;
  }, [rooms]);

  /* ─── Data Fetching ────────────────────────────────────────── */
  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chats/messages?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      /* ignore */
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch("/api/chats/messages?pending=true");
      if (!res.ok) return;
      const data = await res.json();
      setPendingMessages(data.messages || []);
    } catch {
      /* ignore */
    }
  }, []);

  /* ─── Effects ──────────────────────────────────────────────── */
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) {
          router.push("/");
          return;
        }
        setSession(data);
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  useEffect(() => {
    if (session) {
      loadRooms();
      if (session.isAdmin) loadPending();
    }
  }, [session, loadRooms, loadPending]);

  useEffect(() => {
    if (selectedRoom) loadMessages(selectedRoom.id);
  }, [selectedRoom, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* ─── Handlers ─────────────────────────────────────────────── */
  function toggleCategory(catId: string) {
    setExpandedCats((prev) => ({ ...prev, [catId]: !prev[catId] }));
  }

  function selectRoom(room: ChatRoom) {
    setSelectedRoom(room);
    setSidebarOpen(false);
    setError("");
    setSuccess("");
  }

  async function handleCreateRoom() {
    if (!newRoomName.trim()) return;
    setCreatingRoom(true);
    try {
      const res = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName,
          description: newRoomDesc,
          category: newRoomCategory,
          allowCustomerMessages: newRoomAllowMsgs,
        }),
      });
      if (res.ok) {
        setShowCreateRoom(false);
        setNewRoomName("");
        setNewRoomDesc("");
        setNewRoomCategory("general");
        setNewRoomAllowMsgs(false);
        await loadRooms();
        setSuccess("Kanal erstellt!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Erstellen.");
      }
    } catch {
      setError("Fehler beim Erstellen.");
    } finally {
      setCreatingRoom(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedRoom || !newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/chats/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedRoom.id,
          content: newMessage,
          senderName,
        }),
      });
      if (res.ok) {
        setNewMessage("");
        await loadMessages(selectedRoom.id);
        if (!session?.isAdmin) {
          setSuccess("Nachricht gesendet! Wird nach Freigabe sichtbar.");
          setTimeout(() => setSuccess(""), 4000);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Senden.");
      }
    } catch {
      setError("Senden fehlgeschlagen.");
    } finally {
      setSending(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function handleImagePost() {
    if (!selectedRoom || !imageFile) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        setError("Bild-Upload fehlgeschlagen.");
        setUploadingImage(false);
        return;
      }
      const uploadData = await uploadRes.json();

      const res = await fetch("/api/chats/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedRoom.id,
          content: imageCaption,
          imageUrl: uploadData.url,
          imageBgColor: imageBgColor,
        }),
      });
      if (res.ok) {
        setShowImagePost(false);
        setImageFile(null);
        setImagePreview("");
        setImageCaption("");
        await loadMessages(selectedRoom.id);
        setSuccess("Bild-Post erstellt!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Fehler beim Erstellen des Posts.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleModerate(
    messageId: string,
    chatId: string,
    status: string
  ) {
    try {
      const res = await fetch("/api/chats/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, chatId, status }),
      });
      if (res.ok) {
        await loadPending();
        if (selectedRoom) await loadMessages(selectedRoom.id);
      }
    } catch {
      /* ignore */
    }
  }

  async function handlePushToShopify(msg: ChatMessage) {
    setPushingId(msg.id);
    setError("");
    try {
      const res = await fetch("/api/chats/push-to-shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: msg.imageUrl,
          alt: msg.content || "Community Bild",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Bild erfolgreich zu Shopify gepusht!");
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Push fehlgeschlagen.");
      }
    } catch {
      setError("Verbindung fehlgeschlagen.");
    } finally {
      setPushingId(null);
    }
  }

  async function handleDownload(imageUrl: string, filename?: string) {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "png";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `brospify-image.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(imageUrl, "_blank");
    }
  }

  /* ─── Loading State ────────────────────────────────────────── */
  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] text-zinc-600 tracking-widest uppercase">
            Lade Community...
          </p>
        </div>
      </div>
    );
  }

  const isAdmin = session.isAdmin;

  /* ─── Sidebar Content (shared between desktop & mobile) ──── */
  const renderSidebar = (mobile = false) => (
    <>
      {/* Community Header */}
      <div className={`p-4 border-b border-white/[0.06] ${mobile ? "" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#95BF47]/20 to-[#95BF47]/5 border border-[#95BF47]/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#95BF47]" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-zinc-100 tracking-tight">
                Community
              </h2>
              <p className="text-[10px] text-zinc-600">
                {rooms.length} {rooms.length === 1 ? "Kanal" : "Kanäle"}
              </p>
            </div>
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowCreateRoom(true)}
              className="p-2 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/15 text-[#95BF47] hover:bg-[#95BF47]/20 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </motion.button>
          )}
        </div>

        {/* Pending moderation badge */}
        {isAdmin && pendingMessages.length > 0 && (
          <div className="mt-3 text-[11px] bg-amber-500/10 border border-amber-500/10 text-amber-400/80 px-3 py-2 rounded-lg flex items-center gap-2">
            <Clock className="w-3 h-3 shrink-0" />
            <span>
              {pendingMessages.length} Nachricht
              {pendingMessages.length > 1 ? "en" : ""} warten auf Freigabe
            </span>
          </div>
        )}
      </div>

      {/* Categories & Channels */}
      <div className="flex-1 overflow-y-auto py-3">
        {CATEGORIES.map((cat) => {
          const catRooms = roomsByCategory[cat.id] || [];
          return (
            <div key={cat.id} className="mb-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 group"
              >
                <ChevronDown
                  className={`w-2.5 h-2.5 text-zinc-600 transition-transform duration-200 ${
                    !expandedCats[cat.id] ? "-rotate-90" : ""
                  }`}
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500 group-hover:text-zinc-300 transition">
                  {cat.name}
                </span>
                {catRooms.length > 0 && (
                  <span className="text-[10px] text-zinc-700 ml-auto tabular-nums">
                    {catRooms.length}
                  </span>
                )}
              </button>

              {/* Channel List */}
              <AnimatePresence initial={false}>
                {expandedCats[cat.id] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    {catRooms.length === 0 ? (
                      <p className="px-8 py-1.5 text-[10px] text-zinc-700 italic">
                        Keine Kanäle
                      </p>
                    ) : (
                      <div className="px-1.5 space-y-[2px]">
                        {catRooms.map((room) => {
                          const isSelected = selectedRoom?.id === room.id;
                          return (
                            <button
                              key={room.id}
                              onClick={() => selectRoom(room)}
                              className={`
                                w-full flex items-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] transition-all duration-150 group/ch
                                ${
                                  isSelected
                                    ? "bg-white/[0.08] text-white"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
                                }
                              `}
                            >
                              <Hash
                                className={`w-4 h-4 shrink-0 transition ${
                                  isSelected
                                    ? "text-[#95BF47]"
                                    : "opacity-40 group-hover/ch:opacity-70"
                                }`}
                              />
                              <span className="truncate font-medium">
                                {room.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );

  /* ═══════════════════════════════════════════════════════════════ */
  /* RENDER                                                         */
  /* ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <Navigation />

      {/* ─── Toasts ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-[4.5rem] right-4 left-4 md:left-auto md:w-[380px] z-50 px-4 py-3 rounded-xl border text-[13px] flex items-center gap-2.5 backdrop-blur-2xl shadow-xl ${
              error
                ? "bg-red-500/10 border-red-500/15 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/15 text-emerald-300"
            }`}
          >
            {error ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Check className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1 text-xs">{error || success}</span>
            <button
              onClick={() => {
                setError("");
                setSuccess("");
              }}
              className="p-0.5 hover:bg-white/10 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Layout ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[260px] lg:w-[280px] shrink-0 flex-col bg-[#080808]/80 backdrop-blur-2xl border-r border-white/[0.06]">
          {renderSidebar()}
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 28, stiffness: 320 }}
                className="fixed inset-y-0 left-0 w-[280px] z-40 md:hidden bg-[#080808] border-r border-white/[0.06] flex flex-col pt-14"
              >
                {renderSidebar(true)}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Mobile: Full-width channel list when no room selected */}
        {!selectedRoom && (
          <div className="flex md:hidden flex-1 flex-col bg-[#080808]/40">
            {renderSidebar(true)}
          </div>
        )}

        {/* ─── Chat Area ───────────────────────────────────────── */}
        <div
          className={`${selectedRoom ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}
        >
          {selectedRoom ? (
            <>
              {/* Channel Header */}
              <div className="h-12 md:h-[52px] flex items-center gap-2.5 px-4 border-b border-white/[0.06] bg-black/20 backdrop-blur-md shrink-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-white/5 text-zinc-400 transition"
                >
                  <MenuIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="hidden md:flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.04]">
                  <Hash className="w-4 h-4 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">
                    {selectedRoom.name}
                  </h3>
                  {selectedRoom.description && (
                    <p className="text-[11px] text-zinc-600 truncate hidden sm:block">
                      {selectedRoom.description}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowImagePost(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/15 text-[#95BF47] text-xs font-semibold hover:bg-[#95BF47]/20 transition"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Bild posten</span>
                  </motion.button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {messagesLoading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-700" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full px-4 py-16">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                      <Hash className="w-7 h-7 text-zinc-800" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-400 mb-1">
                      Willkommen in #{selectedRoom.name}
                    </p>
                    <p className="text-xs text-zinc-700 text-center max-w-[280px]">
                      {isAdmin
                        ? "Poste das erste Bild oder eine Nachricht in diesem Kanal."
                        : "Noch keine Nachrichten in diesem Kanal."}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                    {messages.map((msg, i) => {
                      const isAdminMsg = msg.senderType === "admin";
                      const isPending = msg.messageStatus === "pending";
                      const isHidden = msg.messageStatus === "hidden";

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: Math.min(i * 0.04, 0.3),
                            duration: 0.35,
                          }}
                          className={`group relative ${isPending ? "opacity-60" : ""} ${isHidden ? "opacity-30" : ""}`}
                        >
                          {/* Sender Row */}
                          <div className="flex items-center gap-2.5 mb-2">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                isAdminMsg
                                  ? "bg-gradient-to-br from-[#95BF47]/25 to-[#95BF47]/5 border border-[#95BF47]/20"
                                  : "bg-white/[0.05] border border-white/[0.08]"
                              }`}
                            >
                              {isAdminMsg ? (
                                <Crown className="w-3.5 h-3.5 text-[#95BF47]" />
                              ) : (
                                <Shield className="w-3 h-3 text-zinc-500" />
                              )}
                            </div>
                            <span
                              className={`text-[13px] font-semibold ${
                                isAdminMsg ? "text-[#95BF47]" : "text-zinc-400"
                              }`}
                            >
                              {isAdminMsg ? "BrospifyHub" : msg.senderName}
                            </span>
                            <span className="text-[10px] text-zinc-700 tabular-nums">
                              {new Date(msg.createdAt).toLocaleDateString(
                                "de-DE",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            {isPending && (
                              <span className="text-[10px] bg-amber-500/15 text-amber-400/80 px-1.5 py-0.5 rounded font-medium">
                                Wartet
                              </span>
                            )}
                            {isHidden && (
                              <span className="text-[10px] bg-red-500/15 text-red-400/80 px-1.5 py-0.5 rounded font-medium">
                                Versteckt
                              </span>
                            )}
                          </div>

                          {/* Image Post — Gallery Card */}
                          {msg.imageUrl && (
                            <div className="ml-[42px] rounded-2xl overflow-hidden border border-white/[0.06] shadow-2xl shadow-black/50 max-w-2xl">
                              {/* Image Display */}
                              <div
                                className="relative flex items-center justify-center p-6 md:p-10 min-h-[200px]"
                                style={{
                                  backgroundColor:
                                    msg.imageBgColor || "#0a0a0a",
                                }}
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt={msg.content || "Bild"}
                                  className="max-w-full max-h-[420px] object-contain rounded-lg drop-shadow-2xl"
                                  loading="lazy"
                                />
                                {/* Subtle vignette overlay */}
                                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.04] pointer-events-none" />
                              </div>

                              {/* Glass Action Bar */}
                              <div className="flex items-center gap-2 p-3 bg-white/[0.02] border-t border-white/[0.06]">
                                <motion.button
                                  whileHover={{
                                    scale: 1.02,
                                    backgroundColor:
                                      "rgba(255, 255, 255, 0.07)",
                                  }}
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => handleDownload(msg.imageUrl)}
                                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm transition-colors text-xs font-medium text-zinc-300"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Herunterladen
                                </motion.button>
                                {!isAdmin &&
                                  session.hasShopifyToken !== false && (
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() =>
                                        handlePushToShopify(msg)
                                      }
                                      disabled={pushingId === msg.id}
                                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/15 text-[#95BF47] hover:bg-[#95BF47]/15 backdrop-blur-sm transition-colors text-xs font-medium disabled:opacity-50"
                                    >
                                      {pushingId === msg.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Store className="w-3.5 h-3.5" />
                                      )}
                                      Zu Shopify
                                    </motion.button>
                                  )}
                              </div>
                            </div>
                          )}

                          {/* Text Content */}
                          {msg.content && (
                            <div
                              className={`ml-[42px] ${msg.imageUrl ? "mt-2.5" : ""}`}
                            >
                              <p
                                className={`text-[14px] leading-relaxed ${
                                  isAdminMsg
                                    ? "text-zinc-200"
                                    : "text-zinc-400"
                                }`}
                              >
                                {msg.content}
                              </p>
                            </div>
                          )}

                          {/* Moderation Buttons (Admin only, customer messages) */}
                          {isAdmin && !isAdminMsg && (
                            <div className="flex items-center gap-2 mt-2 ml-[42px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              {isPending && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleModerate(
                                        msg.id,
                                        msg.chatId,
                                        "approved"
                                      )
                                    }
                                    className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md hover:bg-emerald-500/20 flex items-center gap-1 transition"
                                  >
                                    <Check className="w-3 h-3" /> Freigeben
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleModerate(
                                        msg.id,
                                        msg.chatId,
                                        "hidden"
                                      )
                                    }
                                    className="text-[11px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-md hover:bg-red-500/20 flex items-center gap-1 transition"
                                  >
                                    <X className="w-3 h-3" /> Ablehnen
                                  </button>
                                </>
                              )}
                              {msg.messageStatus === "approved" && (
                                <button
                                  onClick={() =>
                                    handleModerate(
                                      msg.id,
                                      msg.chatId,
                                      "hidden"
                                    )
                                  }
                                  className="text-[11px] text-zinc-600 hover:text-red-400 flex items-center gap-1 transition"
                                >
                                  <EyeOff className="w-3 h-3" /> Verstecken
                                </button>
                              )}
                              {isHidden && (
                                <button
                                  onClick={() =>
                                    handleModerate(
                                      msg.id,
                                      msg.chatId,
                                      "approved"
                                    )
                                  }
                                  className="text-[11px] text-zinc-600 hover:text-emerald-400 flex items-center gap-1 transition"
                                >
                                  <Eye className="w-3 h-3" /> Anzeigen
                                </button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              {(isAdmin || selectedRoom.allowCustomerMessages) && (
                <div className="px-4 pb-4 pt-2 shrink-0">
                  <div className="max-w-3xl mx-auto">
                    {!isAdmin && !senderName && (
                      <div className="mb-2">
                        <input
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Dein Name..."
                          className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-1.5 py-1.5 backdrop-blur-sm focus-within:border-[#95BF47]/20 transition-colors">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={
                          isAdmin
                            ? "Admin-Nachricht schreiben..."
                            : `Nachricht in #${selectedRoom.name}...`
                        }
                        className="flex-1 bg-transparent text-sm px-3 py-2 outline-none placeholder:text-zinc-600"
                        disabled={sending}
                      />
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        onClick={handleSendMessage}
                        disabled={sending || !newMessage.trim()}
                        className="p-2.5 rounded-lg bg-[#95BF47] text-black disabled:opacity-25 disabled:bg-zinc-700 transition-colors shrink-0"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>
                    {!isAdmin && (
                      <p className="text-[10px] text-zinc-700 mt-1.5 ml-1">
                        Wird nach Admin-Freigabe sichtbar.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty State (Desktop) */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="relative mx-auto mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#95BF47]/10 to-transparent border border-white/[0.05] flex items-center justify-center mx-auto">
                    <Sparkles className="w-9 h-9 text-[#95BF47]/30" />
                  </div>
                  <div className="absolute -inset-6 bg-[#95BF47]/[0.04] rounded-full blur-3xl -z-10" />
                </div>
                <h3 className="text-lg font-bold text-zinc-300 mb-1.5">
                  BrospifyHub Community
                </h3>
                <p className="text-sm text-zinc-600 max-w-[260px] mx-auto leading-relaxed">
                  {rooms.length > 0
                    ? "Wähle einen Kanal aus der Sidebar."
                    : isAdmin
                      ? "Erstelle deinen ersten Kanal."
                      : "Noch keine Kanäle vorhanden."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Room Modal ───────────────────────────────── */}
      <AnimatePresence>
        {showCreateRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowCreateRoom(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/15 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#95BF47]" />
                </div>
                Neuer Kanal
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5 uppercase tracking-[0.08em] font-medium">
                    Kanal-Name *
                  </label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="z.B. produkt-updates"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5 uppercase tracking-[0.08em] font-medium">
                    Kategorie
                  </label>
                  <select
                    value={newRoomCategory}
                    onChange={(e) => setNewRoomCategory(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition"
                  >
                    {CATEGORIES.map((cat) => (
                      <option
                        key={cat.id}
                        value={cat.id}
                        className="bg-[#111]"
                      >
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5 uppercase tracking-[0.08em] font-medium">
                    Beschreibung
                  </label>
                  <input
                    type="text"
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="Worum geht es?"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <div
                    className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                      newRoomAllowMsgs
                        ? "bg-[#95BF47] border-[#95BF47]"
                        : "border-white/[0.15] bg-white/[0.03]"
                    }`}
                  >
                    {newRoomAllowMsgs && (
                      <Check className="w-3 h-3 text-black" />
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={newRoomAllowMsgs}
                    onChange={(e) => setNewRoomAllowMsgs(e.target.checked)}
                    className="hidden"
                  />
                  <span className="text-sm text-zinc-300">
                    Kunden dürfen Nachrichten schreiben
                  </span>
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateRoom(false)}
                  className="flex-1 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/[0.06] transition"
                >
                  Abbrechen
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleCreateRoom}
                  disabled={creatingRoom || !newRoomName.trim()}
                  className="flex-1 py-3 bg-[#95BF47] text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition"
                >
                  {creatingRoom ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Erstellen"
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Image Post Modal ────────────────────────────────── */}
      <AnimatePresence>
        {showImagePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => !uploadingImage && setShowImagePost(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#111] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-bold mb-5 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#95BF47]/10 border border-[#95BF47]/15 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-[#95BF47]" />
                </div>
                Bild-Post erstellen
              </h3>

              <div className="space-y-4">
                {imagePreview ? (
                  <div
                    className="rounded-xl overflow-hidden relative border border-white/[0.06]"
                    style={{ backgroundColor: imageBgColor }}
                  >
                    <div className="p-6 flex items-center justify-center">
                      <img
                        src={imagePreview}
                        alt=""
                        className="max-h-48 object-contain rounded-lg drop-shadow-xl"
                      />
                    </div>
                    <button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview("");
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full hover:bg-black/80 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-[16/10] rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] flex flex-col items-center justify-center gap-3 text-zinc-600 hover:border-[#95BF47]/20 hover:text-zinc-400 transition group"
                  >
                    <Upload className="w-7 h-7 group-hover:text-[#95BF47]/60 transition" />
                    <span className="text-xs font-medium">
                      Bild auswählen
                    </span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {imageFile && (
                  <div>
                    <label className="block text-[11px] text-zinc-500 mb-1.5 uppercase tracking-[0.08em] font-medium">
                      Hintergrundfarbe (Hex)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={imageBgColor}
                        onChange={(e) => setImageBgColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-white/[0.1] cursor-pointer bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={imageBgColor}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v.replace("#", ""))) {
                            setImageBgColor(v.startsWith("#") ? v : `#${v}`);
                          }
                        }}
                        maxLength={7}
                        placeholder="#000000"
                        className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs font-mono outline-none focus:border-[#95BF47]/30 transition"
                      />
                      {/* Quick color presets */}
                      <div className="flex gap-1 shrink-0">
                        {["#000000", "#FFFFFF", "#1a1a1a", "#95BF47"].map((c) => (
                          <button
                            key={c}
                            onClick={() => setImageBgColor(c)}
                            className={`w-7 h-7 rounded-md border transition ${
                              imageBgColor.toUpperCase() === c.toUpperCase()
                                ? "border-[#95BF47] ring-1 ring-[#95BF47]/50"
                                : "border-white/[0.1] hover:border-white/[0.2]"
                            }`}
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5 uppercase tracking-[0.08em] font-medium">
                    Bildunterschrift
                  </label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="Beschreibe das Bild..."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowImagePost(false)}
                  disabled={uploadingImage}
                  className="flex-1 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/[0.06] transition"
                >
                  Abbrechen
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleImagePost}
                  disabled={uploadingImage || !imageFile}
                  className="flex-1 py-3 bg-[#95BF47] text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Posten
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
