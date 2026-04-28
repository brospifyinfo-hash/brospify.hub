"use client";

/**
 * /dashboard/email-templates
 *
 * AI Email Template Generator & Auto-Deployer für Brospify Hub.
 *
 * Zwei Modes auf einer Page (kein Routing-Wechsel — schneller Übergang):
 *   1. GRID:    10 Cards der wichtigsten Shopify-Notifications.
 *   2. EDITOR:  Form (Tonfall + Notes) + Live-Preview + One-Click-Deploy.
 *
 * Design-Sprache:
 *   • Apple-Style Minimalismus
 *   • Sanfter Aurora-Hintergrund (radial gradient orbs)
 *   • Glasmorphismus-Container mit feinen weißen Rändern
 *   • SF-Pro-Stack via .font-sf
 *   • Akzent-Grün #95BF47 für den Live-Schalt-Button
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  ArrowLeft,
  AlertCircle,
  LogOut,
  Settings,
  Loader2,
} from "lucide-react";
import type {
  EmailTemplateMeta,
  EmailTemplateKey,
} from "@/lib/email-templates";
import TemplateCard from "./_components/TemplateCard";
import EditorPanel from "./_components/EditorPanel";

interface ApiTemplate extends EmailTemplateMeta {
  /** Wenn vorhanden: Template wurde im Shop bereits angepasst (live). */
  live?: { id: number; subject: string; body: string };
}

export default function EmailTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [shopConnected, setShopConnected] = useState(false);
  const [shopDomain, setShopDomain] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeKey, setActiveKey] = useState<EmailTemplateKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/email-templates/list");
        if (res.status === 401) {
          router.push("/");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Fehler beim Laden.");
          return;
        }
        setTemplates(data.templates || []);
        setShopConnected(!!data.shopConnected);
        setShopDomain(data.shopDomain);
      } catch {
        if (!cancelled) setError("Verbindungsfehler.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const activeTemplate = activeKey
    ? templates.find((t) => t.key === activeKey)
    : null;

  return (
    <div className="font-sf min-h-screen relative bg-[#0a0a0c] text-white">
      {/* Aurora-Hintergrund (animiertes Radial-Gradient) */}
      <div className="aurora" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-md bg-black/20 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2.5 text-white/70 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            <span className="text-[14px] font-medium tracking-tight">
              Brospify Hub
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-3 py-1.5 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5 cursor-pointer"
              title="Einstellungen"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.8} />
              Shop-Verbindung
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-xl text-[13px] text-white/60 hover:text-white hover:bg-white/5 transition flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.8} />
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-16">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2
              className="w-6 h-6 animate-spin text-white/40"
              strokeWidth={1.8}
            />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl glass text-red-300">
            <AlertCircle className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[14px]">{error}</span>
          </div>
        ) : activeTemplate ? (
          <EditorPanel
            meta={activeTemplate}
            shopConnected={shopConnected}
            shopDomain={shopDomain}
            onBack={() => setActiveKey(null)}
            onDeployed={() => {
              // Lokal als "live" markieren, damit die Card beim Zurückgehen
              // den grünen Status-Dot zeigt.
              setTemplates((prev) =>
                prev.map((t) =>
                  t.key === activeTemplate.key
                    ? {
                        ...t,
                        live: t.live ?? {
                          id: 0,
                          subject: "",
                          body: "",
                        },
                      }
                    : t
                )
              );
            }}
          />
        ) : (
          <GridView
            templates={templates}
            shopConnected={shopConnected}
            shopDomain={shopDomain}
            onSelect={setActiveKey}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid View — Hero + 10 Cards
// ---------------------------------------------------------------------------

function GridView({
  templates,
  shopConnected,
  shopDomain,
  onSelect,
}: {
  templates: ApiTemplate[];
  shopConnected: boolean;
  shopDomain?: string;
  onSelect: (k: EmailTemplateKey) => void;
}) {
  const customizedCount = templates.filter((t) => t.live).length;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6 text-[12px] text-white/70">
          <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
          AI Email Template Generator
        </div>
        <h1 className="text-[44px] sm:text-[56px] font-semibold tracking-[-0.03em] leading-[1.05] text-white">
          Deine Shopify-E-Mails.{" "}
          <span className="text-white/50">Neu gedacht.</span>
        </h1>
        <p className="text-[16px] sm:text-[17px] text-white/55 mt-5 leading-relaxed max-w-2xl">
          Lass die KI deine 10 wichtigsten Shopify-Benachrichtigungen schreiben —
          mit deinem Tonfall, deiner Marke, deinen Hinweisen. Vorschau prüfen,
          mit einem Klick live schalten.
        </p>

        {/* Status-Bar */}
        <div className="flex flex-wrap gap-3 mt-8">
          <StatusPill
            label="Verbundener Shop"
            value={shopConnected ? shopDomain ?? "Verbunden" : "Nicht verbunden"}
            tone={shopConnected ? "ok" : "warn"}
          />
          <StatusPill
            label="Angepasste Templates"
            value={`${customizedCount} / ${templates.length}`}
            tone="neutral"
          />
        </div>
      </div>

      {!shopConnected && (
        <div className="glass rounded-2xl px-5 py-4 flex items-start gap-3 text-amber-200">
          <AlertCircle
            className="w-4 h-4 mt-0.5 shrink-0"
            strokeWidth={1.8}
          />
          <div className="text-[13px] leading-relaxed">
            <strong className="text-amber-100">Shop nicht verbunden.</strong>{" "}
            Templates kannst du trotzdem generieren und als Vorschau ansehen.
            Zum Live-Schalten ist eine Shopify-Verbindung nötig — verfügbar im{" "}
            <a
              href="/dashboard"
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Hauptdashboard
            </a>
            .
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {templates.map((t) => (
          <TemplateCard
            key={t.key}
            meta={t}
            customized={!!t.live}
            onClick={() => onSelect(t.key)}
          />
        ))}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const dot = {
    ok: "bg-[#95BF47] shadow-[0_0_10px_#95BF47]",
    warn: "bg-amber-400 shadow-[0_0_10px_rgb(251_191_36_/0.6)]",
    neutral: "bg-white/40",
  }[tone];

  return (
    <div className="glass rounded-full pl-3 pr-4 py-1.5 flex items-center gap-2.5">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className="text-[11px] uppercase tracking-wider text-white/40">
        {label}
      </span>
      <span className="text-[12px] text-white font-medium font-mono">
        {value}
      </span>
    </div>
  );
}
