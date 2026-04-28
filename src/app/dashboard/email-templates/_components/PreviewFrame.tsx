"use client";

/**
 * PreviewFrame — Visuelle Vorschau einer generierten E-Mail.
 *
 * Verwendet einen sandboxed iframe mit srcDoc — der generierte Liquid+HTML
 * wird isoliert vom Host-Stylesheet gerendert, exakt wie es im Postfach
 * eines Kunden aussehen würde.
 *
 *   • Mobile View:  375px Breite, "iPhone-frame"-Look
 *   • Desktop View: 600px Breite, "Mail-App"-Look (Gmail/Apple Mail Standard)
 *
 * Vorschau-Hinweis: Liquid-Tags (z. B. {{ order.name }}) bleiben sichtbar —
 * das ist gewünscht, der Nutzer soll sehen, *welche* Variablen Shopify im
 * echten Versand ersetzt.
 */

import { useEffect, useRef, useState } from "react";
import { Smartphone, Monitor, Mail, Sparkles } from "lucide-react";

interface Props {
  html: string | null;
  subject: string | null;
  loading: boolean;
}

export default function PreviewFrame({ html, subject, loading }: Props) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Bei jedem html-Wechsel scrollt der iframe-Inhalt zurück nach oben.
  useEffect(() => {
    if (iframeRef.current && html) {
      // Mini-Trick: srcDoc neu setzen reseted den Scroll automatisch,
      // hier kein Extra-Code nötig.
    }
  }, [html]);

  return (
    <div className="glass rounded-3xl p-6 md:p-8 h-full flex flex-col">
      {/* Header: View-Toggle + Subject-Preview */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl glass-strong flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-white/80" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Posteingang-Vorschau
            </div>
            <div className="text-[14px] font-medium text-white truncate">
              {subject ?? "—"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-2xl glass-strong shrink-0">
          <ToggleButton
            active={view === "desktop"}
            onClick={() => setView("desktop")}
            icon={Monitor}
            label="Desktop"
          />
          <ToggleButton
            active={view === "mobile"}
            onClick={() => setView("mobile")}
            icon={Smartphone}
            label="Mobile"
          />
        </div>
      </div>

      {/* Frame */}
      <div className="flex-1 flex items-start justify-center overflow-auto">
        <div
          className="transition-all duration-500 ease-out mx-auto my-4"
          style={{
            width: view === "mobile" ? 375 : 640,
            maxWidth: "100%",
          }}
        >
          <DeviceFrame view={view}>
            {loading ? (
              <PreviewSkeleton />
            ) : html ? (
              <iframe
                ref={iframeRef}
                title="Email Preview"
                sandbox="allow-same-origin"
                srcDoc={html}
                className="block w-full h-[640px] bg-white"
              />
            ) : (
              <PreviewEmpty />
            )}
          </DeviceFrame>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Monitor;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-1.5 rounded-xl text-[12px] font-medium flex items-center gap-1.5 transition cursor-pointer",
        active ? "bg-white text-black" : "text-white/60 hover:text-white",
      ].join(" ")}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {label}
    </button>
  );
}

/**
 * Optisches Frame um den iframe — auf Mobile mit Notch-Andeutung,
 * auf Desktop wie ein Mail-App-Fenster mit Window-Dots.
 */
function DeviceFrame({
  view,
  children,
}: {
  view: "desktop" | "mobile";
  children: React.ReactNode;
}) {
  if (view === "mobile") {
    return (
      <div className="rounded-[36px] bg-zinc-950 border border-white/10 p-2.5 shadow-2xl shadow-black/40">
        <div className="rounded-[28px] overflow-hidden bg-white relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-950 rounded-b-2xl z-10" />
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-zinc-950 border border-white/10 overflow-hidden shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 bg-zinc-900/60">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
        <span className="ml-3 text-[11px] text-white/40">Mail</span>
      </div>
      {children}
    </div>
  );
}

function PreviewEmpty() {
  return (
    <div className="bg-white text-zinc-400 p-12 h-[640px] flex flex-col items-center justify-center text-center">
      <Sparkles
        className="w-8 h-8 text-zinc-300 mb-4"
        strokeWidth={1.4}
      />
      <p className="text-[14px] text-zinc-500 max-w-xs leading-relaxed">
        Wähle einen Tonfall und klicke auf{" "}
        <span className="font-medium text-zinc-700">„Mit KI generieren&ldquo;</span>,
        um eine Vorschau zu sehen.
      </p>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="bg-white p-12 h-[640px] space-y-4 animate-pulse">
      <div className="h-8 w-2/3 bg-zinc-200 rounded-lg" />
      <div className="h-4 w-full bg-zinc-100 rounded" />
      <div className="h-4 w-5/6 bg-zinc-100 rounded" />
      <div className="h-4 w-4/6 bg-zinc-100 rounded" />
      <div className="h-32 bg-zinc-100 rounded-xl mt-8" />
      <div className="h-12 w-40 bg-zinc-200 rounded-full mx-auto mt-8" />
    </div>
  );
}
