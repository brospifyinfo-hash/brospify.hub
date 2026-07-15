"use client";

// ─── Standalone-Login der Editor-Website („Eingangstür") ─────────────────
// Eigene, HELLE Login-/Fehlerseite im Landing-Look — komplett ohne Hub:
//  - ohne ?error: zeigt die Login-Karte (Google · Shopify · E-Mail-Link).
//  - mit ?error (Redirect aus den Auth-Callbacks): erklärt den Fehler
//    verständlich; darunter steht dieselbe Login-Karte für den nächsten
//    Versuch. Das Ziel (?next=…, z. B. /editor?start=own) bleibt erhalten.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EditorLoginCard } from "@/components/theme-editor/EditorLoginModal";

const DEFAULT_NEXT = "/editor";

const INK = "#14121a";
const INK_SOFT = "#5b5766";
const INK_FAINT = "#8c8896";

const ERROR_TEXT: Record<string, { title: string; hint: string }> = {
  blocked: {
    title: "Dieses Konto ist gesperrt",
    hint: "Wenn du glaubst, dass das ein Irrtum ist, melde dich bitte beim Support.",
  },
  no_email: {
    title: "Google hat keine E-Mail übermittelt",
    hint: "Bitte versuche es erneut und erlaube im Google-Fenster den Zugriff auf deine E-Mail-Adresse.",
  },
  no_license: {
    title: "Anmeldung nicht möglich",
    hint: "Dieses Konto konnte nicht angemeldet werden. Bitte versuche es unten erneut.",
  },
  use_primary_login: {
    title: "Bitte melde dich wie gewohnt an",
    hint: "Zu dieser Adresse gehört bereits ein Konto mit Mitgliedschaft oder Admin-Rechten. Aus Sicherheitsgründen funktioniert dafür der E-Mail- bzw. Shopify-Schnellzugang nicht — nutze bitte „Mit Google anmelden“ oder deinen Lizenzschlüssel-Login im Hub.",
  },
  email_expired: {
    title: "Dieser Login-Link ist abgelaufen",
    hint: "Login-Links sind 15 Minuten gültig. Fordere unten einfach einen neuen an.",
  },
  shopify_config: {
    title: "Shopify-Login noch nicht eingerichtet",
    hint: "Die Shopify-Anmeldung ist auf diesem Server noch nicht konfiguriert. Nutze so lange Google oder den E-Mail-Link.",
  },
  shopify_invalid: {
    title: "Shop-Adresse nicht erkannt",
    hint: "Bitte gib deine *.myshopify.com-Adresse ein — du findest sie im Shopify-Admin.",
  },
  shopify_failed: {
    title: "Shopify-Anmeldung abgebrochen",
    hint: "Die Anmeldung über Shopify hat nicht geklappt. Bitte versuche es erneut — oder nimm Google bzw. den E-Mail-Link.",
  },
  rate_limited: {
    title: "Zu viele Versuche",
    hint: "Bitte warte ein paar Minuten und versuche es dann noch einmal.",
  },
  invalid: {
    title: "Anmeldung nicht möglich",
    hint: "Es fehlen Angaben für die Anmeldung. Bitte versuche es unten erneut.",
  },
  server: {
    title: "Da ist etwas schiefgelaufen",
    hint: "Ein technischer Fehler auf unserer Seite — bitte versuche es gleich noch einmal.",
  },
};

function StartLoginInner() {
  const params = useSearchParams();
  const rawNext = params.get("next") || DEFAULT_NEXT;
  // Open-Redirect-Schutz: nur interne, absolute Pfade zulassen.
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : DEFAULT_NEXT;
  const error = params.get("error");
  const e = error ? ERROR_TEXT[error] ?? ERROR_TEXT.server : null;

  return (
    <Shell>
      {e && (
        <div
          role="alert"
          style={{
            width: "min(430px, 100%)",
            background: "rgba(220,38,38,0.06)",
            border: "1.5px solid rgba(220,38,38,0.30)",
            borderRadius: 20,
            padding: "16px 20px",
            textAlign: "left",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#991b1b" }}>{e.title}</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, fontWeight: 500, color: INK_SOFT }}>{e.hint}</p>
        </div>
      )}

      <EditorLoginCard next={next} />

      <a
        href="/start"
        style={{ fontSize: 13, fontWeight: 600, color: INK_FAINT, textDecoration: "none" }}
      >
        ← Zurück zur Startseite
      </a>
    </Shell>
  );
}

/** Heller Landing-Look als Rahmen (Farbwelt/Marke wie /start). */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        overflowY: "auto",
        background:
          "radial-gradient(1100px 520px at 50% -80px, rgba(124,58,237,0.08), transparent 68%), linear-gradient(#ffffff, #faf7f1)",
        color: INK,
        fontFamily: '"Plus Jakarta Sans", -apple-system, "Segoe UI", sans-serif',
        textAlign: "center",
        padding: "32px 24px",
      }}
    >
      {children}
    </div>
  );
}

export default function StartLoginPage() {
  return (
    <Suspense fallback={<Shell><span /></Shell>}>
      <StartLoginInner />
    </Suspense>
  );
}
