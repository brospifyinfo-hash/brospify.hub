import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllKunden, getKundeProfile, updateKundeProfile, deductCredits, CREDIT_LIMITS, getCreditsState } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.lizenzschluessel) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
    }

    const { topic, language, products } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Kein Thema angegeben." }, { status: 400 });
    }

    // Build product context for AI prompt
    const selectedProducts: { title: string; description: string; images: { src: string; alt: string }[] }[] = products || [];

    // Find customer row
    const kunden = await getAllKunden();
    const rowIndex = kunden.findIndex(
      (k) => k.lizenzschluessel === session.lizenzschluessel
    );
    if (rowIndex === -1) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }

    // Check credit limit
    const profile = await getKundeProfile(rowIndex);
    const creditState = getCreditsState(profile);
    if (creditState.remaining < CREDIT_LIMITS.BLOG_GENERATE) {
      return NextResponse.json(
        { error: "Dein monatliches Credit-Limit ist erreicht." },
        { status: 429 }
      );
    }

    const lang = language === "en" ? "English" : "German";
    const toneOfVoice = profile.brand_kit?.toneOfVoice || "";

    // Build product section for prompt
    let productContext = "";
    if (selectedProducts.length > 0) {
      const productLines = selectedProducts.map((p, i) => {
        const imgTags = p.images.slice(0, 2).map(
          (img) => `<img src="${img.src}" alt="${img.alt}" style="max-width:100%;border-radius:12px;margin:16px 0" />`
        ).join("\n");
        return `Product ${i + 1}: "${p.title}"\nDescription: ${p.description || "N/A"}\nImage HTML to embed:\n${imgTags}`;
      }).join("\n\n");

      productContext = `\n\nIMPORTANT — The user has selected these products from their shop. You MUST organically mention and feature them in the blog post. Embed the product images using the exact <img> tags provided below. Weave the products naturally into the content as recommendations.\n\n${productLines}`;
    }

    const systemPrompt = `You are an expert e-commerce SEO blog writer. Write in ${lang}.
${toneOfVoice ? `Tone of voice: ${toneOfVoice}` : "Use a professional yet engaging tone."}

Generate a complete blog post as valid HTML for a Shopify blog.
The blog post should be:
- 800-1200 words
- SEO optimized with proper headings (h2, h3)
- Include an engaging intro, 3-5 main sections, and a conclusion
${selectedProducts.length > 0 ? "- Organically feature the selected products with their REAL images using the exact <img> tags provided" : "- Include image placeholders as: <div class=\"blog-image-placeholder\" data-alt=\"[descriptive alt text]\">[Bild: descriptive text]</div>"}
- Include internal linking suggestions as comments: <!-- LINK: suggested anchor text -> /collections/... -->
- End with a call-to-action${productContext}

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

    // Deduct credits
    const deduction = await deductCredits(rowIndex, profile, CREDIT_LIMITS.BLOG_GENERATE);
    if (!deduction.success) {
      return NextResponse.json(
        { error: "Dein monatliches Credit-Limit ist erreicht." },
        { status: 429 }
      );
    }

    return NextResponse.json({
      blog: {
        title: blogData.title,
        body_html: blogData.body_html,
        seo_title: blogData.seo_title || blogData.title,
        seo_description: blogData.seo_description || "",
        tags: blogData.tags || "",
      },
      creditsRemaining: deduction.remaining,
    });
  } catch (error) {
    console.error("[Blog Generate] Error:", error);
    return NextResponse.json({ error: "Serverfehler." }, { status: 500 });
  }
}
