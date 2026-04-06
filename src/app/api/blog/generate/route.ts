import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, getKundeProfile, updateKundeProfile } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    const { topic, language } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Kein Thema angegeben." }, { status: 400 });
    }

    // Find customer row
    const kunden = await getAllKunden();
    const rowIndex = kunden.findIndex(
      (k) => k.lizenzschluessel === session.lizenzschluessel
    );
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }

    // Check AI usage limit (3/month)
    const profile = await getKundeProfile(rowIndex);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usage = profile.ai_usage || { month: currentMonth, count: 0 };
    if (usage.month !== currentMonth) {
      usage.month = currentMonth;
      usage.count = 0;
    }
    if (usage.count >= 3) {
      return NextResponse.json(
        { error: "KI-Limit erreicht (3x pro Monat). Nächsten Monat wieder verfügbar." },
        { status: 429 }
      );
    }

    const lang = language === "en" ? "English" : "German";
    const toneOfVoice = profile.brand_kit?.toneOfVoice || "";

    const systemPrompt = `You are an expert e-commerce SEO blog writer. Write in ${lang}.
${toneOfVoice ? `Tone of voice: ${toneOfVoice}` : "Use a professional yet engaging tone."}

Generate a complete blog post as valid HTML for a Shopify blog.
The blog post should be:
- 800-1200 words
- SEO optimized with proper headings (h2, h3)
- Include an engaging intro, 3-5 main sections, and a conclusion
- Include image placeholders as: <div class="blog-image-placeholder" data-alt="[descriptive alt text]">[Bild: descriptive text]</div>
- Include internal linking suggestions as comments: <!-- LINK: suggested anchor text -> /collections/... -->
- End with a call-to-action

Return JSON: { "title": "...", "body_html": "...", "seo_title": "...", "seo_description": "...", "tags": "tag1,tag2,tag3" }`;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "KI-Service nicht konfiguriert." }, { status: 500 });
    }

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
          { role: "user", content: `Write a blog post about: ${topic}` },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[Blog AI] DeepSeek error:", errText);
      return NextResponse.json({ error: "KI-Generierung fehlgeschlagen." }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response
    let blogData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      blogData = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ error: "KI-Antwort konnte nicht verarbeitet werden." }, { status: 500 });
    }

    // Increment usage
    usage.count += 1;
    await updateKundeProfile(rowIndex, { ...profile, ai_usage: usage });

    return NextResponse.json({
      blog: {
        title: blogData.title,
        body_html: blogData.body_html,
        seo_title: blogData.seo_title || blogData.title,
        seo_description: blogData.seo_description || "",
        tags: blogData.tags || "",
      },
      aiUsage: usage,
    });
  } catch (error) {
    console.error("[Blog Generate] Error:", error);
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 });
  }
}
