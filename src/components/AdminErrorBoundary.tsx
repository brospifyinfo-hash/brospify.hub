"use client";

// ─── AdminErrorBoundary ──────────────────────────────────────────
// Catches any thrown error from a child subtree and renders a
// recoverable card instead of letting the whole admin page white-
// screen. Used twice:
//   1. Wrapping the entire /admin route (in admin/layout.tsx) so even
//      a crash in the top-level state setup is contained.
//   2. Wrapping each tab content block inside admin/page.tsx so a
//      problem in one view (e.g. malformed stats response) doesn't
//      kill the sidebar / other tabs.
//
// The boundary keeps a `version` counter and bumps it on "Erneut
// versuchen" — the child gets a fresh `key` so its state resets
// cleanly without a full page reload.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  /** Human-friendly label, shown on the card. */
  label?: string;
  /** Render-prop alternative — full control over the fallback UI. */
  fallback?: (info: { error: Error | null; reset: () => void; label: string }) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
  version: number;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null, version: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the browser console + Vercel logs so we keep an
    // audit trail even when the user just clicks "Erneut versuchen".
    console.error(`[AdminErrorBoundary:${this.props.label || "—"}]`, error, info.componentStack);
  }

  reset = (): void => {
    this.setState((s) => ({ error: null, version: s.version + 1 }));
  };

  render(): ReactNode {
    const { error, version } = this.state;
    const label = this.props.label || "Admin-Bereich";

    if (error) {
      if (this.props.fallback) {
        return this.props.fallback({ error, reset: this.reset, label });
      }
      return (
        <div
          className="rounded-2xl border border-red-500/25 p-4 my-2"
          style={{
            background:
              "linear-gradient(180deg, rgba(239,68,68,0.08) 0%, rgba(255,255,255,0.02) 100%)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-red-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-white">{label} ist abgestürzt</h3>
              <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                Ein interner Fehler hat diesen Bereich gestoppt. Der
                Rest des Admin-Panels läuft weiter. Klick auf „Erneut
                versuchen" um den Tab frisch zu laden.
              </p>
              <pre className="text-[10px] text-red-200/80 font-mono mt-2 max-h-32 overflow-auto bg-black/30 rounded-lg p-2 border border-red-500/20">
                {error.message || String(error)}
              </pre>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={this.reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-semibold hover:bg-red-500/25 transition"
                >
                  <RefreshCw className="w-3 h-3" />
                  Erneut versuchen
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition"
                >
                  Ganze Seite neu laden
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // The `key` reset trick: when version bumps, React unmounts the
    // current subtree and mounts a fresh copy with default state.
    // Without this, child components keep their pre-error state.
    return <div key={version}>{this.props.children}</div>;
  }
}
