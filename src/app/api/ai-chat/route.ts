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

    // Load knowledge base from admin settings
    const knowledgeBase = await getAdminSetting("ai_knowledge_base");

    const systemPrompt = `Du bist der KI-Support-Agent von BrospifyHub, einem Managed Dropshipping Dashboard.
Deine Aufgabe ist es, Kunden bei Fragen und Problemen zu helfen.
Antworte immer auf Deutsch, freundlich und professionell.
Halte deine Antworten kurz und hilfreich (max 3-4 Sätze).

${knowledgeBase ? `FIRMENWISSEN (nutze dieses Wissen für deine Antworten):\n${knowledgeBase}\n` : ""}

Wenn du ein Problem nicht lösen kannst oder dir unsicher bist, sage dem Kunden ehrlich, dass du nicht weiterhelfen kannst.`;

    const deepseekMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

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
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[AI Chat] DeepSeek error:", res.status, errText);
      return NextResponse.json(
        { error: "KI-Anfrage fehlgeschlagen." },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Entschuldigung, ich konnte keine Antwort generieren.";

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
