"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { motion, AnimatePresence } from "framer-motion";
import {
  PenTool,
  Loader2,
  Sparkles,
  Upload,
  Send,
  Check,
  AlertCircle,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImageIcon,
  Link2,
  Undo,
  Redo,
  Store,
  X,
  Tag,
  Search,
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface ShopifyImage {
  id: number;
  src: string;
  alt: string;
  productTitle: string;
}

export default function BlogPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Blog generation
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("de");
  const [blogTitle, setBlogTitle] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [tags, setTags] = useState("");

  // Image picker
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [shopifyImages, setShopifyImages] = useState<ShopifyImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Published article
  const [publishedUrl, setPublishedUrl] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false }),
    ],
    content: "<p>Generiere zuerst einen Blog-Artikel oder schreibe direkt los...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[300px] px-5 py-4",
      },
    },
  });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        if (!data.isLoggedIn) {
          router.push("/");
          return;
        }
        setLoading(false);
      })
      .catch(() => router.push("/"));
  }, [router]);

  const loadShopifyImages = useCallback(async () => {
    setLoadingImages(true);
    try {
      const res = await fetch("/api/blog/shopify-images");
      if (res.ok) {
        const data = await res.json();
        setShopifyImages(data.images || []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingImages(false);
    }
  }, []);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generierung fehlgeschlagen.");
        return;
      }
      const blog = data.blog;
      setBlogTitle(blog.title);
      setSeoTitle(blog.seo_title || blog.title);
      setSeoDescription(blog.seo_description || "");
      setTags(blog.tags || "");
      editor?.commands.setContent(blog.body_html);
      setSuccess("Blog-Artikel generiert! Bearbeite ihn im Editor.");
      setTimeout(() => setSuccess(""), 4000);
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        setError("Bild-Upload fehlgeschlagen.");
        return;
      }
      const data = await res.json();
      editor?.chain().focus().setImage({ src: data.url, alt: file.name }).run();
      setSuccess("Bild eingefügt!");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Upload fehlgeschlagen.");
    } finally {
      setUploadingImage(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  }

  function insertShopifyImage(img: ShopifyImage) {
    editor?.chain().focus().setImage({ src: img.src, alt: img.alt }).run();
    setShowImagePicker(false);
    setSuccess("Shopify-Bild eingefügt!");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handlePublish() {
    if (!blogTitle.trim() || !editor) return;
    setPublishing(true);
    setError("");
    try {
      const body_html = editor.getHTML();
      const res = await fetch("/api/blog/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: blogTitle,
          body_html,
          tags,
          seo_title: seoTitle,
          seo_description: seoDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Veröffentlichung fehlgeschlagen.");
        return;
      }
      setPublishedUrl(data.article?.url || "");
      setSuccess("Blog-Artikel erfolgreich veröffentlicht!");
    } catch {
      setError("Verbindungsfehler.");
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#95BF47] border-t-transparent rounded-full animate-spin" />
          <p className="text-[11px] text-zinc-600 tracking-widest uppercase">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh">
      <Navigation />

      {/* Toasts */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-20 right-4 left-4 md:left-auto md:w-[400px] z-50 px-4 py-3 rounded-xl border text-[13px] flex items-center gap-2.5 backdrop-blur-2xl shadow-xl ${
              error
                ? "bg-red-500/10 border-red-500/15 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/15 text-emerald-300"
            }`}
          >
            {error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
            <span className="flex-1 text-xs">{error || success}</span>
            <button onClick={() => { setError(""); setSuccess(""); }} className="p-0.5 hover:bg-white/10 rounded transition">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#95BF47]/20 to-[#95BF47]/5 border border-[#95BF47]/15 flex items-center justify-center">
              <PenTool className="w-5 h-5 text-[#95BF47]" />
            </div>
            KI Blog-Wizard
          </h1>
          <p className="text-sm text-zinc-500 mt-1.5">
            Generiere SEO-optimierte Blog-Artikel und veröffentliche sie direkt auf Shopify.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr,340px] gap-6">
          {/* Main Editor Area */}
          <div className="space-y-5">
            {/* AI Generation */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#95BF47]" />
                KI-Generierung
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Blog-Thema eingeben, z.B. '5 Tipps für bessere Produktfotos'"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-600"
                  onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                />
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-sm outline-none focus:border-[#95BF47]/30 transition"
                >
                  <option value="de" className="bg-[#111]">Deutsch</option>
                  <option value="en" className="bg-[#111]">English</option>
                </select>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerate}
                  disabled={generating || !topic.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-40 transition shrink-0"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {generating ? "Generiere..." : "Generieren"}
                </motion.button>
              </div>
            </div>

            {/* Blog Title */}
            <input
              type="text"
              value={blogTitle}
              onChange={(e) => setBlogTitle(e.target.value)}
              placeholder="Blog-Titel..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-5 py-4 text-lg font-bold outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
            />

            {/* Editor Toolbar */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] flex-wrap">
                {[
                  { icon: Bold, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive("bold") },
                  { icon: Italic, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive("italic") },
                  { icon: Heading2, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive("heading", { level: 2 }) },
                  { icon: Heading3, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive("heading", { level: 3 }) },
                  { icon: List, action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive("bulletList") },
                  { icon: ListOrdered, action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive("orderedList") },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className={`p-2 rounded-lg transition ${
                      btn.active ? "bg-[#95BF47]/15 text-[#95BF47]" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <btn.icon className="w-4 h-4" />
                  </button>
                ))}
                <div className="w-px h-5 bg-white/[0.06] mx-1" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition relative"
                  title="Bild hochladen (Vercel Blob)"
                >
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => { setShowImagePicker(true); loadShopifyImages(); }}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition"
                  title="Shopify-Produktbild einfügen"
                >
                  <Store className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const url = prompt("Link-URL eingeben:");
                    if (url) editor?.chain().focus().setLink({ href: url }).run();
                  }}
                  className={`p-2 rounded-lg transition ${
                    editor?.isActive("link") ? "bg-[#95BF47]/15 text-[#95BF47]" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05]"
                  }`}
                >
                  <Link2 className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-white/[0.06] mx-1" />
                <button
                  onClick={() => editor?.chain().focus().undo().run()}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  onClick={() => editor?.chain().focus().redo().run()}
                  className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition"
                >
                  <Redo className="w-4 h-4" />
                </button>
              </div>

              {/* Editor Content */}
              <EditorContent editor={editor} />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-5">
            {/* SEO Settings */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Search className="w-4 h-4 text-[#95BF47]" />
                SEO Einstellungen
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1 uppercase tracking-wider font-medium">SEO Titel</label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                    placeholder="SEO Titel..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1 uppercase tracking-wider font-medium">Meta Description</label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700 resize-none"
                    placeholder="Meta-Beschreibung (max. 160 Zeichen)..."
                  />
                  <p className="text-[10px] text-zinc-700 mt-1">{seoDescription.length}/160</p>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1 uppercase tracking-wider font-medium flex items-center gap-1">
                    <Tag className="w-3 h-3" /> Tags
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-xs outline-none focus:border-[#95BF47]/30 transition placeholder:text-zinc-700"
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>
            </div>

            {/* Publish */}
            <div className="rounded-2xl border border-[#95BF47]/15 bg-[#95BF47]/5 p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Send className="w-4 h-4 text-[#95BF47]" />
                Veröffentlichen
              </h3>
              <p className="text-[11px] text-zinc-500 mb-4">
                Sendet den fertigen Artikel direkt an deinen Shopify-Blog (inkl. aller Bilder).
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePublish}
                disabled={publishing || !blogTitle.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#95BF47] text-black font-bold text-sm disabled:opacity-40 transition"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {publishing ? "Veröffentliche..." : "Auf Shopify veröffentlichen"}
              </motion.button>
              {publishedUrl && (
                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-3 text-xs text-[#95BF47] hover:underline text-center truncate"
                >
                  {publishedUrl}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shopify Image Picker Modal */}
      <AnimatePresence>
        {showImagePicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setShowImagePicker(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-[#111] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-[#95BF47]" />
                  Shopify Produktbilder
                </h3>
                <button
                  onClick={() => setShowImagePicker(false)}
                  className="p-1.5 hover:bg-white/[0.05] rounded-lg transition"
                >
                  <X className="w-4 h-4 text-zinc-500" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[60vh]">
                {loadingImages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                  </div>
                ) : shopifyImages.length === 0 ? (
                  <p className="text-center text-sm text-zinc-600 py-12">
                    Keine Produktbilder gefunden. Ist dein Shop verbunden?
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {shopifyImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => insertShopifyImage(img)}
                        className="group rounded-xl border border-white/[0.06] overflow-hidden hover:border-[#95BF47]/30 transition"
                      >
                        <div className="aspect-square bg-white/[0.02] relative">
                          <img
                            src={img.src}
                            alt={img.alt}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ImageIcon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-500 px-2 py-1.5 truncate">{img.alt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
