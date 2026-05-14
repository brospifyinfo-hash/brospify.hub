// ─── /api/admin/coaching/generate ────────────────────────────────
// Admin enters a topic → DeepSeek drafts a coaching tip (title + body)
// the admin can review and then save via /api/admin/coaching POST.
//
// Body: { topic: string }
// Returns: { title, body }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const body = await req.json();
    const topic = String(body.topic || "").trim();
    if (!topic) return NextResponse.json({ error: "Thema fehlt" }, { status: 400 });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KI-Service nicht konfiguriert." }, { status: 500 });
    }

    const systemPrompt = `Du bist ein erfahrener E-Commerce- und Shopify-Coach.
Schreibe einen kompakten, umsetzbaren Coaching-Tipp auf Deutsch.
- Praxisnah, konkret, ohne Floskeln.
- 120-220 Wörter.
- Der "body" darf einfache Zeilenumbrüche und Aufzählungen mit "- " enthalten.

Antworte NUR mit JSON: { "title": "...", "body": "..." }`;

    const aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Thema: ${topic}` },
        ],
        temperature: 0.6,
        max_tokens: 900,
      }),
    });

    if (!aiRes.ok) {
      console.error("[Coaching/generate] DeepSeek error:", await aiRes.text());
      return NextResponse.json({ error: "KI-Generierung fehlgeschlagen." }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    let parsed: { title?: string; body?: string } = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no json");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht verarbeitet werden." }, { status: 500 });
    }

    return NextResponse.json({
      title: String(parsed.title || topic).slice(0, 200),
      body: String(parsed.body || ""),
    });
  } catch (error) {
    console.error("[Coaching/generate] error:", error);
    return NextResponse.json({ error: "Fehler bei der Generierung." }, { status: 500 });
  }
}
