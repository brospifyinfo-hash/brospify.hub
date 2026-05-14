// ─── /api/admin/code-blocks/analyze ──────────────────────────────
// Admin pastes a Shopify custom-liquid snippet. We hand it to DeepSeek
// and ask it to pick out the values an end-user would realistically
// want to tweak — mostly visible texts and colors. The response is a
// list of CANDIDATE options; the admin reviews them (confirm/reject
// individually) before the block is saved.
//
// Body: { code: string }
// Returns: { options: { id, label, type, original }[] }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Candidate {
  id: string;
  label: string;
  type: "text" | "color";
  original: string;
}

// Fallback heuristic when the AI is unavailable — pull obvious hex
// colors so the admin still gets something usable.
function heuristicScan(code: string): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = hexRe.exec(code)) !== null) {
    const val = m[0];
    if (seen.has(val)) continue;
    seen.add(val);
    out.push({
      id: `opt_h_${i++}`,
      label: `Farbe ${out.filter((o) => o.type === "color").length + 1}`,
      type: "color",
      original: val,
    });
  }
  return out.slice(0, 12);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }

    const body = await req.json();
    const code = String(body.code || "");
    if (!code.trim()) {
      return NextResponse.json({ error: "Code fehlt" }, { status: 400 });
    }
    if (code.length > 20000) {
      return NextResponse.json({ error: "Code zu lang (max 20.000 Zeichen)." }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // No AI configured — degrade gracefully to the hex heuristic.
      return NextResponse.json({ options: heuristicScan(code), source: "heuristic" });
    }

    const systemPrompt = `Du analysierst Shopify-Liquid/HTML/CSS-Code-Snippets.
Finde alle Werte, die ein Shop-Betreiber (Nicht-Entwickler) anpassen möchte —
hauptsächlich SICHTBARE TEXTE (Überschriften, Button-Beschriftungen, Slogans)
und FARBEN (Hex-Codes wie #FF5733, rgb(...)).

Regeln:
- "original" MUSS exakt der Teilstring sein, wie er im Code vorkommt (Zeichen für Zeichen).
- Keine CSS-Klassennamen, keine Liquid-Variablen, keine URLs, keine technischen Werte.
- Nur Dinge, die optisch/inhaltlich relevant sind.
- "label" ist eine kurze deutsche Beschreibung (z.B. "Button-Text", "Hintergrundfarbe").
- "type" ist "color" für Farben, sonst "text".
- Maximal 15 Einträge, die wichtigsten zuerst.

Antworte NUR mit JSON in diesem Format:
{ "options": [ { "label": "...", "type": "text|color", "original": "..." } ] }`;

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
          { role: "user", content: `Analysiere diesen Code:\n\n${code}` },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!aiRes.ok) {
      console.error("[CodeBlocks/analyze] DeepSeek error:", await aiRes.text());
      return NextResponse.json({ options: heuristicScan(code), source: "heuristic" });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed: { options?: unknown } = {};
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no json");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ options: heuristicScan(code), source: "heuristic" });
    }

    const raw = Array.isArray(parsed.options) ? parsed.options : [];
    const options: Candidate[] = [];
    let i = 0;
    for (const o of raw) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const original = typeof r.original === "string" ? r.original : "";
      // Only keep options whose `original` actually appears in the code —
      // guards against the AI hallucinating substrings.
      if (!original || !code.includes(original)) continue;
      options.push({
        id: `opt_${Date.now()}_${i++}`,
        label: typeof r.label === "string" && r.label ? r.label : `Option ${i}`,
        type: r.type === "color" ? "color" : "text",
        original,
      });
    }

    // If the AI returned nothing usable, fall back to the heuristic.
    if (options.length === 0) {
      return NextResponse.json({ options: heuristicScan(code), source: "heuristic" });
    }

    return NextResponse.json({ options, source: "ai" });
  } catch (error) {
    console.error("[CodeBlocks/analyze] error:", error);
    return NextResponse.json({ error: "Analyse fehlgeschlagen." }, { status: 500 });
  }
}
