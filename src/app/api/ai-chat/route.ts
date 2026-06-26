import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminSetting } from "@/lib/sheets";
import { requireFeature } from "@/lib/tier-guard";
import { APP_KNOWLEDGE } from "@/lib/app-knowledge";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const guard = await requireFeature(session, "aiChat");
    if (!guard.ok) return guard.response;

    const { messages, lang } = (await req.json()) as {
      messages: ChatMessage[];
      // Vom Client gewählte Oberflächen-Sprache ("de" | "en"). Der Bot
      // antwortet in dieser Sprache (Wissensbasis bleibt deutsch).
      lang?: string;
      // attemptCount wird vom Client noch mitgeschickt, aber nicht mehr
      // genutzt — Eskalation entscheidet sich jetzt am Inhalt (siehe unten).
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Keine Nachrichten" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DeepSeek API nicht konfiguriert." },
        { status: 500 }
      );
    }

    // Optionales, vom Admin im Sheet gepflegtes Zusatzwissen. Kommt
    // OBEN DRAUF auf das fest eingebaute APP_KNOWLEDGE (Single Source
    // of Truth). Fehlt es, ist das App-Wissen allein vollständig.
    let adminKnowledge = "";
    try {
      adminKnowledge = await getAdminSetting("ai_knowledge_base");
    } catch (kbErr) {
      console.error("[AI Chat] Failed to load admin knowledge base:", kbErr);
    }

    // Leichte Personalisierung (nur unkritische Felder — kein E-Mail/Key
    // in den Prompt). Macht die Antworten persönlicher und passender.
    const firstName = (session.googleName || "").trim().split(/\s+/)[0] || "";
    const userContext = [
      firstName ? `Vorname: ${firstName} (gern mal namentlich ansprechen, aber nicht in jeder Nachricht).` : "",
      session.isAdmin
        ? "Dieser Nutzer ist ein ADMIN (kein Credit-Limit)."
        : session.lizenzschluessel
          ? "Dieser Nutzer ist eingeloggtes Mitglied."
          : "",
    ].filter(Boolean).join("\n");

    // Build the system prompt
    const systemPrompt = `Du bist „Brospi", der offizielle KI-Support-Assistent von Brospify Hub — einem Dropshipping-Service mit KI-Tools. Viele Nutzer sind Einsteiger; du bist ihr geduldiger, kompetenter Begleiter.

DEINE MISSION: Das Anliegen WIRKLICH lösen — nicht nur beschreiben, wo etwas ist, sondern den nächsten konkreten Schritt geben. Mach den Nutzer erfolgreich.

TON & STIL:
- Immer Deutsch, per „du", freundlich, ruhig und motivierend. Nie von oben herab.
- Kurz und konkret: 1–5 Sätze ODER eine knackige nummerierte Schritt-Liste. Keine Romane, kein Füll-Text.
- Bei „Wie geht X?": gib die Schritte. Bei „Wo ist X?": nenne den Ort + Link.
- Sprich den Vornamen gelegentlich an (wenn bekannt), aber nicht aufdringlich.

HARTE REGELN:
- Stütze dich AUSSCHLIESSLICH auf das Wissen unten (App-Wissen + ggf. Admin-Zusatzwissen). Erfinde NIEMALS Funktionen, Preise, Pfade oder Zahlen. Lieber ehrlich „weiß ich nicht".
- Verlinke Funktionen IMMER als Markdown-Link [Name](/pfad) — nur Pfade aus dem Wissen. Beispiel: „Das Theme lädst du unter [Theme](/themes) herunter."
- Nenne die Credit-Kosten, wenn nach einer kostenpflichtigen Funktion gefragt wird.
- Credit-Modell exakt: 1.500 beim ersten Login, danach +1.000 alle 28 Tage. Nicht 500, nicht 2.000.
- Ist etwas unten als „aktuell nicht verfügbar" markiert, sage genau das.
- Erkenne Frust/echte Bugs/Account-Probleme und leite proaktiv weiter: „Am schnellsten hilft dir das Team über [Problem melden](/email-support)" — oder bei offenen Fragen: ein Live-Ticket aus diesem Chat.
- Geht die Antwort NICHT aus dem Wissen hervor: antworte sinngemäß „Dazu habe ich leider keine gesicherte Info — am besten [Problem melden](/email-support) oder hier ein Live-Ticket eröffnen, dann hilft dir ein Mensch persönlich." Erfinde nichts.

ESKALATIONS-SIGNAL (wichtig):
- Wenn du das Anliegen NICHT zufriedenstellend lösen kannst — Antwort nicht im Wissen, echter Bug, Account-/Zahlungs-/Lizenz-Problem, oder der Nutzer kommt mit deiner Hilfe nicht weiter — hänge GANZ AM ENDE deiner Nachricht in einer eigenen Zeile den Marker [[ESCALATE]] an.
- Dieser Marker wird dem Nutzer NICHT angezeigt; er signalisiert dem System nur, ein Live-Ticket anzubieten.
- Konntest du die Frage normal beantworten, verwende den Marker NIEMALS.

BEISPIELE (Stil, nicht wörtlich übernehmen):
- Frage „wie bekomme ich mehr credits?" → „Du bekommst alle 28 Tage automatisch +1.000 Credits (Countdown unter [Abo verwalten](/account/subscription)). Sofort mehr gibt's über eine kurze Umfrage auf der [Home](/home) oder ein Paket unter [Credits](/credits)."
- Frage „mein bild lädt ewig" → „Aktiviere im [AI Studio](/ai-tools/ai-studio) den Schalter „Im Hintergrund generieren" — dann kannst du den Tab schließen und findest das Bild gleich in der [Mediathek](/library)."
- Frage „login geht nicht" → kurz die 2–3 Schritte + [Problem melden](/email-support) als Fallback.
${userContext ? `\nNUTZER-KONTEXT:\n${userContext}\n` : ""}
${APP_KNOWLEDGE}

${adminKnowledge && adminKnowledge.trim().length > 0 ? `ZUSÄTZLICHES ADMIN-WISSEN (ergänzt das obige, hat bei Konflikt Vorrang):\n---\n${adminKnowledge}\n---` : ""}

${lang === "en" ? "IMPORTANT — LANGUAGE: The user's interface is set to English. ALWAYS reply in natural, fluent English, even though this knowledge base is written in German. Keep all link paths exactly as given." : "WICHTIG — SPRACHE: Antworte auf Deutsch."}`;

    const deepseekMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    console.log("[AI Chat] Sending to DeepSeek, messages:", deepseekMessages.length, "temperature: 0.1");

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: deepseekMessages,
        max_tokens: 700,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[AI Chat] DeepSeek error:", res.status, errText);
      return NextResponse.json(
        { error: "KI-Anfrage fehlgeschlagen. Bitte versuche es erneut." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren. Bitte eröffne ein Live-Ticket.";

    // Eskalation rein inhaltlich: der Bot hängt [[ESCALATE]] an, wenn er
    // nicht helfen kann. Marker erkennen + aus der Antwort entfernen.
    const ESCALATE_RE = /\[\[\s*ESCALATE\s*\]\]/gi;
    const shouldEscalate = ESCALATE_RE.test(raw);
    const reply = raw.replace(ESCALATE_RE, "").trim() ||
      "Dazu habe ich leider keine gesicherte Info — am besten [Problem melden](/email-support) oder hier ein Live-Ticket eröffnen.";

    return NextResponse.json({
      reply,
      shouldEscalate,
    });
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler." },
      { status: 500 }
    );
  }
}
