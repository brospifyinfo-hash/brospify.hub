import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminSetting } from "@/lib/sheets";

export const dynamic = "force-dynamic";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

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

    // Load knowledge base from Google Sheet (Settings tab, key: "ai_knowledge_base")
    let knowledgeBase = "";
    try {
      knowledgeBase = await getAdminSetting("ai_knowledge_base");
      console.log("[AI Chat] Knowledge base loaded, length:", knowledgeBase.length);
    } catch (kbErr) {
      console.error("[AI Chat] Failed to load knowledge base:", kbErr);
      // Continue without KB — the strict prompt will force "no info" answers
    }

    // Build the hardened system prompt
    const systemPrompt = `Du bist der offizielle KI-Support-Agent von BrospifyHub, einem Managed Dropshipping Service.

STRICT INSTRUCTION: Du darfst AUSSCHLIESSLICH Informationen aus diesem System-Prompt verwenden. Wenn eine Frage nicht durch dieses Wissen beantwortet werden kann, ERFINDE NICHTS. Antworte exakt mit: "Dazu habe ich leider keine Informationen. Bitte eröffne ein Live-Ticket, damit ein Admin dir persönlich helfen kann."

REGELN:
- Antworte IMMER auf Deutsch.
- Antworte kurz und präzise (max 3-4 Sätze).
- Erfinde NIEMALS Produkte, Apps, Preise, URLs oder Funktionen die nicht im Firmenwissen stehen.
- Wenn du dir nicht 100% sicher bist, sage dass du keine Information dazu hast.
- Empfehle KEINE externen Apps oder Tools die nicht explizit im Firmenwissen genannt werden.
- Verweise bei Unsicherheit IMMER auf das Live-Ticket-System.

WICHTIG ZUM SHOPIFY SETUP:
Der Kunde muss KEINE eigene App programmieren. Er muss im Shopify Admin-Bereich unter "Einstellungen" → "Apps und Vertriebskanäle" → "Apps entwickeln" → "Benutzerdefinierte App erstellen" (Custom App) eine App anlegen. Dort erhält er die API-Zugangsdaten (Admin API Access Token), die er dann im BrospifyHub unter "Profil" → "Shopify API" einträgt. Das ist ein reiner Klick-Prozess, kein Programmieren.

${knowledgeBase ? `FIRMENWISSEN (NUR diese Informationen als Grundlage verwenden):\n---\n${knowledgeBase}\n---` : "HINWEIS: Es wurde noch kein Firmenwissen vom Admin hinterlegt. Antworte auf alle inhaltlichen Fragen mit dem Hinweis, ein Live-Ticket zu eröffnen."}`;

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
        max_tokens: 500,
        temperature: 0.1,
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
