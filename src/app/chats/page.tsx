"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
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
  ChevronLeft,
  Store,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface ChatRoom {
  id: string;
  name: string;
  description: string;
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
  const [newRoomAllowMsgs, setNewRoomAllowMsgs] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Admin: create image post
  const [showImagePost, setShowImagePost] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageBgColor, setImageBgColor] = useState("#000000");
  const [imageCaption, setImageCaption] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push to Shopify
  const [pushingId, setPushingId] = useState<string | null>(null);

  // Mobile state
  const [showRoomList, setShowRoomList] = useState(true);

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/chats");
      if (!res.ok) return;
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chats/messages?chatId=${chatId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* ignore */ }
    finally { setMessagesLoading(false); }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch("/api/chats/messages?pending=true");
      if (!res.ok) return;
      const data = await res.json();
      setPendingMessages(data.messages || []);
    } catch { /* ignore */ }
  }, []);

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
    if (session) {
      loadRooms();
      if (session.isAdmin) loadPending();
    }
  }, [session, loadRooms, loadPending]);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
      setShowRoomList(false);
    }
  }, [selectedRoom, loadMessages]);

  function selectRoom(room: ChatRoom) {
    setSelectedRoom(room);
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
        body: JSON.stringify({ name: newRoomName, description: newRoomDesc, allowCustomerMessages: newRoomAllowMsgs }),
      });
      if (res.ok) {
        setShowCreateRoom(false);
        setNewRoomName("");
        setNewRoomDesc("");
        setNewRoomAllowMsgs(false);
        await loadRooms();
        setSuccess("Raum erstellt!");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch { setError("Fehler beim Erstellen."); }
    finally { setCreatingRoom(false); }
  }

  async function handleSendMessage() {
    if (!selectedRoom || (!newMessage.trim())) return;
    setSending(true);
    try {
      const res = await fetch("/api/chats/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedRoom.id, content: newMessage, senderName }),
      });
      if (res.ok) {
        setNewMessage("");
        await loadMessages(selectedRoom.id);
        if (!session?.isAdmin) {
          setSuccess("Nachricht gesendet! Sie wird nach Freigabe sichtbar.");
          setTimeout(() => setSuccess(""), 4000);
        }
      } else {
        const data = await res.json();
        setError(data.error || "Fehler beim Senden.");
      }
    } catch { setError("Senden fehlgeschlagen."); }
    finally { setSending(false); }
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
      // Upload image via /api/upload
      const fd = new FormData();
      fd.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) { setError("Bild-Upload fehlgeschlagen."); setUploadingImage(false); return; }
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData.url;

      // Create message with image
      const res = await fetch("/api/chats/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedRoom.id,
          content: imageCaption,
          imageUrl,
          imageBgColor: imageFile.type === "image/png" ? imageBgColor : "",
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
    } catch { setError("Fehler beim Erstellen des Posts."); }
    finally { setUploadingImage(false); }
  }

  async function handleModerate(messageId: string, chatId: string, status: string) {
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
    } catch { /* ignore */ }
  }

  async function handlePushToShopify(msg: ChatMessage) {
    setPushingId(msg.id);
    setError("");
    try {
      const res = await fetch("/api/chats/push-to-shopify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: msg.imageUrl, alt: msg.content || "Community Bild" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Bild erfolgreich zu Shopify gepusht!");
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Push fehlgeschlagen.");
      }
    } catch { setError("Verbindung fehlgeschlagen."); }
    finally { setPushingId(null); }
  }

  function handleDownload(imageUrl: string, filename?: string) {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = filename || "brospify-image.png";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = session.isAdmin;

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <Navigation />

      {/* Toasts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-16 md:top-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 px-4 py-3 rounded-xl border text-sm flex items-center gap-2 ${
              error ? "bg-red-500/10 border-red-500/20 text-red-300" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            }`}
          >
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{error || success}</span>
            <button onClick={() => { setError(""); setSuccess(""); }}><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        {/* Sidebar / Room List */}
        <div className={`${showRoomList ? "block" : "hidden md:block"} w-full md:w-72 lg:w-80 border-r border-white/5 flex flex-col`}>
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#95BF47]" />
                Community
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setShowCreateRoom(true)}
                  className="p-2 rounded-xl bg-[#95BF47]/10 border border-[#95BF47]/20 text-[#95BF47] hover:bg-[#95BF47]/20 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Pending badge for admin */}
            {isAdmin && pendingMessages.length > 0 && (
              <div className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-2 rounded-lg flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                {pendingMessages.length} Nachricht{pendingMessages.length > 1 ? "en" : ""} warten auf Freigabe
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {rooms.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                {isAdmin ? "Erstelle deinen ersten Chat-Raum." : "Noch keine Chat-Räume vorhanden."}
              </div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => selectRoom(room)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedRoom?.id === room.id
                      ? "bg-[#95BF47]/10 border border-[#95BF47]/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{room.name}</p>
                      {room.description && (
                        <p className="text-xs text-zinc-500 truncate">{room.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`${!showRoomList ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {selectedRoom ? (
            <>
              {/* Room Header */}
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <button
                  onClick={() => { setShowRoomList(true); setSelectedRoom(null); }}
                  className="md:hidden p-1.5 rounded-lg hover:bg-white/5"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{selectedRoom.name}</h3>
                  {selectedRoom.description && (
                    <p className="text-xs text-zinc-500 truncate">{selectedRoom.description}</p>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => setShowImagePost(true)}
                    className="btn-accent px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Bild posten</span>
                  </button>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 text-sm">
                    Noch keine Nachrichten in diesem Raum.
                  </div>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`${
                        msg.messageStatus === "pending" ? "opacity-60 border-l-2 border-amber-500/50 pl-3" : ""
                      } ${msg.messageStatus === "hidden" ? "opacity-40" : ""}`}
                    >
                      {/* Admin badge */}
                      <div className="flex items-center gap-2 mb-2">
                        {msg.senderType === "admin" ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Crown className="w-3.5 h-3.5 text-[#95BF47]" />
                            <span className="font-semibold text-[#95BF47]">BrospifyHub</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                            <Shield className="w-3.5 h-3.5" />
                            <span>{msg.senderName}</span>
                          </div>
                        )}
                        <span className="text-[10px] text-zinc-600">
                          {new Date(msg.createdAt).toLocaleDateString("de-DE", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {msg.messageStatus === "pending" && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">Wartet</span>
                        )}
                        {msg.messageStatus === "hidden" && (
                          <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">Versteckt</span>
                        )}
                      </div>

                      {/* Image Post */}
                      {msg.imageUrl && (
                        <div
                          className="rounded-xl overflow-hidden mb-2 max-w-lg"
                          style={{
                            backgroundColor: msg.imageBgColor || "#111111",
                          }}
                        >
                          <div className="p-3 md:p-4 flex items-center justify-center">
                            <img
                              src={msg.imageUrl}
                              alt={msg.content || "Bild"}
                              className="max-w-full max-h-80 object-contain rounded-lg"
                            />
                          </div>
                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 px-3 md:px-4 pb-3">
                            <button
                              onClick={() => handleDownload(msg.imageUrl)}
                              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition text-xs font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Herunterladen
                            </button>
                            {!isAdmin && session.hasShopifyToken !== false && (
                              <button
                                onClick={() => handlePushToShopify(msg)}
                                disabled={pushingId === msg.id}
                                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-[#95BF47]/20 border border-[#95BF47]/30 text-[#95BF47] hover:bg-[#95BF47]/30 transition text-xs font-medium disabled:opacity-50"
                              >
                                {pushingId === msg.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Store className="w-3.5 h-3.5" />
                                )}
                                Zu Shopify
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Text content */}
                      {msg.content && (
                        <p className="text-sm text-zinc-300 leading-relaxed">{msg.content}</p>
                      )}

                      {/* Admin moderation buttons */}
                      {isAdmin && msg.senderType === "customer" && (
                        <div className="flex items-center gap-2 mt-2">
                          {msg.messageStatus === "pending" && (
                            <>
                              <button
                                onClick={() => handleModerate(msg.id, msg.chatId, "approved")}
                                className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg hover:bg-emerald-500/20 flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Freigeben
                              </button>
                              <button
                                onClick={() => handleModerate(msg.id, msg.chatId, "hidden")}
                                className="text-xs bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg hover:bg-red-500/20 flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Ablehnen
                              </button>
                            </>
                          )}
                          {msg.messageStatus === "approved" && (
                            <button
                              onClick={() => handleModerate(msg.id, msg.chatId, "hidden")}
                              className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1"
                            >
                              <EyeOff className="w-3 h-3" /> Verstecken
                            </button>
                          )}
                          {msg.messageStatus === "hidden" && (
                            <button
                              onClick={() => handleModerate(msg.id, msg.chatId, "approved")}
                              className="text-xs text-zinc-500 hover:text-emerald-400 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Anzeigen
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </div>

              {/* Message Input (if allowed) */}
              {(isAdmin || selectedRoom.allowCustomerMessages) && (
                <div className="p-3 md:p-4 border-t border-white/5">
                  {!isAdmin && !senderName && (
                    <div className="mb-2">
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Dein Name..."
                        className="input-glass w-full text-xs"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder={isAdmin ? "Admin-Nachricht..." : "Nachricht schreiben..."}
                      className="input-glass flex-1 text-sm"
                      disabled={sending}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={sending || !newMessage.trim()}
                      className="btn-accent p-3 rounded-xl disabled:opacity-50 shrink-0"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {!isAdmin && (
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      Deine Nachricht wird nach Admin-Freigabe sichtbar.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-400 mb-1">Community</h3>
                <p className="text-sm text-zinc-600">
                  {rooms.length > 0
                    ? "Wähle einen Chat-Raum aus der Liste."
                    : isAdmin
                    ? "Erstelle deinen ersten Chat-Raum."
                    : "Noch keine Räume vorhanden."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal (Admin) */}
      <AnimatePresence>
        {showCreateRoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowCreateRoom(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#95BF47]" />
                Neuer Chat-Raum
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="z.B. Produkt-Updates"
                    className="input-glass w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Beschreibung</label>
                  <input
                    type="text"
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="Worum geht es in diesem Raum?"
                    className="input-glass w-full"
                  />
                </div>
                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <input
                    type="checkbox"
                    checked={newRoomAllowMsgs}
                    onChange={(e) => setNewRoomAllowMsgs(e.target.checked)}
                    className="w-4 h-4 accent-[#95BF47] rounded"
                  />
                  <span className="text-sm text-zinc-300">Kunden dürfen Nachrichten schreiben</span>
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowCreateRoom(false)} className="flex-1 py-2.5 glass border border-white/10 rounded-xl text-sm font-medium">
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={creatingRoom || !newRoomName.trim()}
                  className="flex-1 btn-accent py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {creatingRoom ? <Loader2 className="w-4 h-4 animate-spin" /> : "Erstellen"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Post Modal (Admin) */}
      <AnimatePresence>
        {showImagePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => !uploadingImage && setShowImagePost(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#95BF47]" />
                Bild-Post erstellen
              </h3>

              <div className="space-y-4">
                {/* Image Upload */}
                {imagePreview ? (
                  <div
                    className="rounded-xl p-4 flex items-center justify-center relative"
                    style={{ backgroundColor: imageBgColor }}
                  >
                    <img src={imagePreview} alt="" className="max-h-48 object-contain rounded-lg" />
                    <button
                      onClick={() => { setImageFile(null); setImagePreview(""); }}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-zinc-500 transition"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">Bild auswählen</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

                {/* PNG Background Color */}
                {imageFile?.type === "image/png" && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Hintergrundfarbe (PNG)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={imageBgColor}
                        onChange={(e) => setImageBgColor(e.target.value)}
                        className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={imageBgColor}
                        onChange={(e) => setImageBgColor(e.target.value)}
                        className="input-glass flex-1 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Caption */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Bildunterschrift (optional)</label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="Beschreibe das Bild..."
                    className="input-glass w-full text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowImagePost(false)}
                  disabled={uploadingImage}
                  className="flex-1 py-2.5 glass border border-white/10 rounded-xl text-sm font-medium"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleImagePost}
                  disabled={uploadingImage || !imageFile}
                  className="flex-1 btn-accent py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" />Posten</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
