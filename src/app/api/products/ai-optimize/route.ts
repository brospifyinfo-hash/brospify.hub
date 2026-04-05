import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, findKundeByKey, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const MAX_AI_USES_PER_MONTH = 3;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { produktId } = await req.json();
    if (!produktId) {
      return NextResponse.json({ error: "produktId fehlt" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY ist nicht konfiguriert. Kontaktiere den Admin." },
        { status: 500 }
      );
    }

    // Check usage limit (3x per month)
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const profile = await getKundeProfile(kunde.rowIndex);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const aiUsage = profile.ai_usage || { month: "", count: 0 };

    if (aiUsage.month === currentMonth && aiUsage.count >= MAX_AI_USES_PER_MONTH) {
      return NextResponse.json(
        { error: `Du hast dein Limit von ${MAX_AI_USES_PER_MONTH} KI-Optimierungen pro Monat erreicht. Nächsten Monat stehen dir wieder ${MAX_AI_USES_PER_MONTH} zur Verfügung.` },
        { status: 429 }
      );
    }

    // Find the product
    const produkte = await getAllProdukte();
    const produkt = produkte.find((p) => p.id === produktId);
    if (!produkt) {
      return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });
    }

    // Get tone of voice from customer profile or fallback
    const toneOfVoice = profile.brand_kit?.toneOfVoice || "Professionell, vertrauenswürdig, auf Deutsch";

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

    console.log("[AI-Optimize] Calling DeepSeek for product:", produktId);

    const deepseekRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Du bist ein E-Commerce-Copywriting-Experte. Antworte ausschließlich mit validem JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!deepseekRes.ok) {
      const errText = await deepseekRes.text();
      console.error("[AI-Optimize] DeepSeek error:", deepseekRes.status, errText);
      return NextResponse.json(
        { error: `DeepSeek API Fehler (${deepseekRes.status}). Versuche es erneut.` },
        { status: 500 }
      );
    }

    const deepseekData = await deepseekRes.json();
    const rawText = deepseekData?.choices?.[0]?.message?.content || "";

    console.log("[AI-Optimize] DeepSeek raw response:", rawText.substring(0, 500));

    // Parse JSON from response (handle markdown code blocks)
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[AI-Optimize] Failed to parse JSON:", cleaned.substring(0, 500));
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden. Versuche es erneut." },
        { status: 500 }
      );
    }

    // Increment usage counter
    const newCount = aiUsage.month === currentMonth ? aiUsage.count + 1 : 1;
    await updateKundeProfile(kunde.rowIndex, {
      ...profile,
      ai_usage: { month: currentMonth, count: newCount },
    });

    const remaining = MAX_AI_USES_PER_MONTH - newCount;

    return NextResponse.json({
      success: true,
      remaining,
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
