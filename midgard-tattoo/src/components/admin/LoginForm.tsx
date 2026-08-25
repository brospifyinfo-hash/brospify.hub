"use client";

// ─── Login-Formular ──────────────────────────────────────────────
// Ein Feld, ein Knopf. Der Inhaber eines Tattoostudios soll sich hier
// nicht durch eine Benutzerverwaltung arbeiten — es gibt genau einen
// Zugang, und der ist mit einem Passwort geschützt.

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  configured,
  studioName,
}: {
  configured: boolean;
  studioName: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // `refresh()` verwirft den Server-Cache, damit das Dashboard mit
        // der frischen Session gerendert wird statt aus dem Cache.
        router.replace("/admin");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Anmeldung fehlgeschlagen.");
    } catch {
      setError("Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100svh] items-center justify-center p-6">
      <motion.div
        className="card w-full max-w-sm p-7"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-7 flex items-baseline gap-2">
          <span className="display text-2xl">{studioName.split(" ")[0]}</span>
          <span className="marker text-lg" style={{ color: "var(--signal)" }}>Studio</span>
        </div>

        {!configured ? (
          <div>
            <h1 className="display text-xl">Noch nicht eingerichtet</h1>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--bone-soft)" }}>
              Für den Admin-Bereich fehlt das Passwort. Setz die Umgebungsvariable{" "}
              <code style={{ color: "var(--signal)" }}>TATTOO_ADMIN_PASSWORD</code> und
              lade die Seite neu.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="display mb-1 text-xl">Anmelden</h1>
            <p className="mb-6 text-sm" style={{ color: "var(--bone-dim)" }}>
              Termine anlegen und Anfragen beantworten.
            </p>

            <label className="block">
              <span className="eyebrow mb-2 block">Passwort</span>
              <input
                type="password"
                className={`field ${error ? "field-error" : ""}`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); }}
                autoComplete="current-password"
                autoFocus
                placeholder="••••••••"
              />
            </label>

            {error && (
              <p className="mt-3 text-sm" style={{ color: "var(--danger)" }} role="alert">{error}</p>
            )}

            <button type="submit" disabled={busy || !password} className="btn btn-signal mt-6 w-full">
              {busy ? "Moment …" : "Anmelden"}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
