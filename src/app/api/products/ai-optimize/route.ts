import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte } from "@/lib/sheets";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

async function getSettings() {
  try {
    const { blobs } = await list({ prefix: "brospifyhub-settings.json", limit: 1 });
    if (blobs.length > 0 && blobs[0].url) {
      const res = await fetch(blobs[0].url, { cache: "no-store" });
      if (res.ok) return await res.json();
    }
  } catch { /* ignore */ }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { produktId } = await req.json();
    if (!produktId) {
      return NextResponse.json({ error: "produktId fehlt" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY ist nicht konfiguriert. Kontaktiere den Admin." },
        { status: 500 }
      );
    }

    // Find the product
    const produkte = await getAllProdukte();
    const produkt = produkte.find((p) => p.id === produktId);
    if (!produkt) {
      return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
    }

    // Get brand settings for tone of voice
    const settings = await getSettings();
    const toneOfVoice = settings.toneOfVoice || "Professionell, vertrauenswürdig, auf Deutsch";

    // Build prompt
    const prompt = `Du bist ein erfahrener E-Commerce-Copywriter für den deutschen Markt.

PRODUKT-ROHDATEN:
Titel: ${produkt.titel}
Beschreibung: ${produkt.beschreibung || "(keine)"}
Preis: ${produkt.preis}€

TONFALL-ANWEISUNG: ${toneOfVoice}

AUFGABE:
Erstelle einen verkaufsstarken Shopify-Produkteintrag auf Deutsch.

Antworte NUR mit einem JSON-Objekt in exakt diesem Format (kein Markdown, kein Codeblock):
{
  "title": "Optimierter Produkttitel (max 70 Zeichen)",
  "body_html": "<div>..Verkaufsstarke HTML-Beschreibung mit <ul><li>Bullet Points</li></ul>, Vorteilen, Trust-Elementen. Nutze <strong>, <em>, <br> Tags. Max 800 Wörter..</div>",
  "seo_title": "SEO-Titel (max 60 Zeichen)",
  "seo_description": "Meta-Beschreibung (max 155 Zeichen)",
  "tags": "tag1, tag2, tag3, tag4, tag5"
}`;

    console.log("[AI-Optimize] Calling Gemini for product:", produktId);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[AI-Optimize] Gemini error:", geminiRes.status, errText);
      return NextResponse.json(
        { error: `Gemini API Fehler (${geminiRes.status}). Versuche es erneut.` },
        { status: 500 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log("[AI-Optimize] Gemini raw response:", rawText.substring(0, 500));

    // Parse JSON from Gemini response (handle markdown code blocks)
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[AI-Optimize] Failed to parse Gemini JSON:", cleaned.substring(0, 500));
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden. Versuche es erneut." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      original: {
        title: produkt.titel,
        description: produkt.beschreibung,
      },
      optimized: {
        title: parsed.title || produkt.titel,
        body_html: parsed.body_html || produkt.beschreibung,
        seo_title: parsed.seo_title || "",
        seo_description: parsed.seo_description || "",
        tags: parsed.tags || "",
      },
    });
  } catch (error) {
    console.error("[AI-Optimize] Error:", error);
    return NextResponse.json(
      { error: "Ein Fehler ist aufgetreten." },
      { status: 500 }
    );
  }
}
