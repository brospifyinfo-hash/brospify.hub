// ─── E-Mail-Versand über Resend ──────────────────────────────────
// Bewusst ohne SDK: ein einziger fetch-Aufruf gegen die HTTP-API. Das
// spart eine Abhängigkeit, die sonst nur eine Funktion beisteuert.
//
// Konfiguration (siehe .env.example):
//   RESEND_API_KEY     Pflicht für den Versand. Fehlt er, wird nichts
//                      verschickt — aber auch nichts geworfen.
//   RESEND_FROM_EMAIL  Absender, muss auf einer bei Resend verifizierten
//                      Domain liegen.
//
// FEHLERTOLERANT: Diese Funktion wirft NIE. Eine Terminanfrage ist beim
// Aufruf längst gespeichert; ein Mail-Problem darf sie nicht kippen.
// Der Inhaber sieht die Anfrage in jedem Fall im Dashboard.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendResult {
  sent: boolean;
  id?: string;
  error?: string;
}

export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Überschreibt RESEND_FROM_EMAIL für einzelne Mails. */
  from?: string;
}

export async function sendViaResend(args: SendArgs): Promise<SendResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (args.from || process.env.RESEND_FROM_EMAIL || "").trim();

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY nicht gesetzt — Versand übersprungen.");
    return { sent: false, error: "RESEND_API_KEY fehlt" };
  }
  if (!from) {
    console.warn("[email] RESEND_FROM_EMAIL nicht gesetzt — Versand übersprungen.");
    return { sent: false, error: "RESEND_FROM_EMAIL fehlt" };
  }
  if (!args.to.includes("@")) {
    return { sent: false, error: "ungültiger Empfänger" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      console.error("[email] Resend-Fehler:", res.status, data);
      return { sent: false, error: data.message || `HTTP ${res.status}` };
    }
    return { sent: true, id: data.id };
  } catch (err) {
    console.error("[email] Resend nicht erreichbar:", err);
    return { sent: false, error: err instanceof Error ? err.message : "unbekannt" };
  }
}
