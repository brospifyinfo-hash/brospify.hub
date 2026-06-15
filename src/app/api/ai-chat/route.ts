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

    const { messages, attemptCount } = (await req.json()) as {
      messages: ChatMessage[];
      attemptCount: number;
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

    // Build the system prompt
    const systemPrompt = `Du bist der offizielle KI-Support-Agent von Brospify Hub, einem Managed-Dropshipping-Service mit KI-Tools.

REGELN:
- Antworte IMMER auf Deutsch, freundlich, konkret und auf den Punkt: 1-5 Sätze oder eine kurze Schritt-Liste, keine Romane.
- Stütze dich AUSSCHLIESSLICH auf das Wissen unten (App-Wissen + ggf. Admin-Zusatzwissen). Erfinde KEINE Funktionen, Preise oder Pfade.
- Wenn jemand fragt, WO etwas ist oder WIE etwas geht: nenne die Funktion kurz UND hänge den passenden Link als Markdown-Link in der Form [Name](/pfad) an (Pfade nur aus dem Wissen). Beispiel: "Das Theme findest du unter [Themes](/themes)."
- Nenne die Credit-Kosten, wenn nach einer kostenpflichtigen Funktion gefragt wird.
- Ist eine Funktion unten als "aktuell nicht verfügbar" markiert, sage genau das (nicht so tun, als gäbe es sie).
- Geht die Antwort NICHT aus dem Wissen hervor, antworte exakt: "Dazu habe ich leider keine Informationen. Bitte eröffne ein Live-Ticket, damit ein Admin dir persönlich helfen kann." — und erfinde nichts.

${APP_KNOWLEDGE}

${adminKnowledge && adminKnowledge.trim().length > 0 ? `ZUSÄTZLICHES ADMIN-WISSEN (ergänzt das obige, hat bei Konflikt Vorrang):\n---\n${adminKnowledge}\n---` : ""}`;

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
    const reply = data.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren. Bitte eröffne ein Live-Ticket.";

    // If this is the 2nd attempt, suggest escalation
    const shouldEscalate = attemptCount >= 2;

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
