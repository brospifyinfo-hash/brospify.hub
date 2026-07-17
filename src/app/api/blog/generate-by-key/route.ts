// ─── POST /api/blog/generate-by-key ─────────────────────────────
// CORS-fähige Variante von /api/blog/generate für das Shopify-
// Storefront-Theme. Auth via licence key / Customer-Email + shared
// API-Key. Tier-Check: `blogGenerator` Feature.
//
// Body: { topic, language?, products?, key?, email?, apikey? }
// Response: { ok, blog, creditsRemaining } | { error }
//
// Wichtig: kein Streaming für die erste Iteration — DeepSeek braucht
// 10–20 s. Storefront zeigt einen Loader, polling/SSE können wir
// später nachziehen wenn nötig.

import { NextRequest, NextResponse } from "next/server";
import {
  CREDIT_LIMITS,
  deductCredits,
  findKundeByEmail,
  findKundeByKey,
  getCreditsState,
  getKundeProfile,
} from "@/lib/sheets";
import { isHubSubscriber } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface ProductInput {
  title: string;
  description?: string;
  images?: { src: string; alt: string }[];
}

export async function POST(req: NextRequest) {
  let body: {
    topic?: unknown;
    language?: unknown;
    products?: unknown;
    key?: unknown;
    email?: unknown;
    apikey?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiger Request-Body." }, 400);
  }

  const apiKey = typeof body.apikey === "string" ? body.apikey.trim() : "";
  const expected = (process.env.LICENSE_API_KEY || "").trim();
  if (expected && apiKey !== expected) {
    return json({ error: "Nicht autorisiert." }, 401);
  }

  const key = typeof body.key === "string" ? body.key.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!key && !email) return json({ error: "Lizenzschlüssel oder Email fehlt." }, 400);

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length < 4) {
    return json({ error: "Bitte gib ein Thema an (min. 4 Zeichen)." }, 400);
  }
  if (topic.length > 500) {
    return json({ error: "Thema ist zu lang (max. 500 Zeichen)." }, 400);
  }

  const language = body.language === "en" ? "en" : "de";
  const products: ProductInput[] = Array.isArray(body.products)
    ? (body.products as unknown[]).slice(0, 4).map((p): ProductInput => {
        const o = (p ?? {}) as Record<string, unknown>;
        return {
          title: typeof o.title === "string" ? o.title.slice(0, 200) : "",
          description: typeof o.description === "string" ? o.description.slice(0, 600) : "",
          images: Array.isArray(o.images)
            ? (o.images as unknown[]).slice(0, 2).map((im) => {
                const i = (im ?? {}) as Record<string, unknown>;
                return {
                  src: typeof i.src === "string" ? i.src.slice(0, 600) : "",
                  alt: typeof i.alt === "string" ? i.alt.slice(0, 200) : "",
                };
              })
            : [],
        };
      })
    : [];

  // Resolve customer
  let kunde;
  try {
    kunde = key ? await findKundeByKey(key) : await findKundeByEmail(email);
  } catch (err) {
    console.error("[blog/generate-by-key] kunde lookup failed:", err);
    return json({ error: "Upstream-Fehler." }, 502);
  }
  if (!kunde) return json({ error: "Kunde nicht gefunden." }, 404);
  if (!isHubSubscriber(kunde)) {
    return json({ error: "Membership erforderlich.", gated: true }, 403);
  }

  const rowIndex = kunde.rowIndex;
  const profile = await getKundeProfile(rowIndex);
  const creditState = getCreditsState(profile);
  if (creditState.balance < CREDIT_LIMITS.BLOG_GENERATE) {
    return json(
      {
        error: `Nicht genug Credits — du brauchst ${CREDIT_LIMITS.BLOG_GENERATE}, hast aber nur ${creditState.balance}.`,
        creditsRemaining: creditState.balance,
        cost: CREDIT_LIMITS.BLOG_GENERATE,
      },
      402,
    );
  }

  const lang = language === "en" ? "English" : "German";
  const toneOfVoice = profile.brand_kit?.toneOfVoice || "";

  let productContext = "";
  if (products.length > 0) {
    const productLines = products
      .map((p, i) => {
        const imgTags = (p.images || [])
          .slice(0, 2)
          .map(
            (img) =>
              `<img src="${img.src}" alt="${img.alt}" style="max-width:100%;border-radius:12px;margin:16px 0" />`,
          )
          .join("\n");
        return `Product ${i + 1}: "${p.title}"\nDescription: ${p.description || "N/A"}\nImage HTML to embed:\n${imgTags}`;
      })
      .join("\n\n");
    productContext = `\n\nIMPORTANT — The user has selected these products from their shop. You MUST organically mention and feature them in the blog post. Embed the product images using the exact <img> tags provided below. Weave the products naturally into the content as recommendations.\n\n${productLines}`;
  }

  const systemPrompt = `You are an expert e-commerce SEO blog writer. Write in ${lang}.
${toneOfVoice ? `Tone of voice: ${toneOfVoice}` : "Use a professional yet engaging tone."}

Generate a complete blog post as valid HTML for a Shopify blog.
The blog post should be:
- 800-1200 words
- SEO optimized with proper headings (h2, h3)
- Include an engaging intro, 3-5 main sections, and a conclusion
${products.length > 0 ? "- Organically feature the selected products with their REAL images using the exact <img> tags provided" : "- Include image placeholders as: <div class=\"blog-image-placeholder\" data-alt=\"[descriptive alt text]\">[Bild: descriptive text]</div>"}
- Include internal linking suggestions as comments: <!-- LINK: suggested anchor text -> /collections/... -->
- End with a call-to-action${productContext}

Return JSON: { "title": "...", "body_html": "...", "seo_title": "...", "seo_description": "...", "tags": "tag1,tag2,tag3" }`;

  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekKey) {
    return json({ error: "KI-Service nicht konfiguriert." }, 500);
  }

  let aiRes;
  try {
    aiRes = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekKey}`,
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
  } catch (err) {
    console.error("[blog/generate-by-key] fetch fail:", err);
    return json({ error: "KI-Service nicht erreichbar." }, 502);
  }

  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => "");
    console.error("[blog/generate-by-key] DeepSeek error:", errText);
    return json({ error: "KI-Generierung fehlgeschlagen." }, 502);
  }

  const aiData = await aiRes.json();
  const content: string = aiData.choices?.[0]?.message?.content || "";

  let blogData: {
    title: string;
    body_html: string;
    seo_title?: string;
    seo_description?: string;
    tags?: string;
  };
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    blogData = JSON.parse(jsonMatch[0]);
  } catch {
    return json({ error: "KI-Antwort konnte nicht verarbeitet werden." }, 500);
  }

  const deduction = await deductCredits(rowIndex, profile, CREDIT_LIMITS.BLOG_GENERATE);
  if (!deduction.success) {
    return json(
      {
        error: `Nicht genug Credits — du brauchst ${CREDIT_LIMITS.BLOG_GENERATE}.`,
        creditsRemaining: deduction.remaining,
      },
      402,
    );
  }

  return json({
    ok: true,
    blog: {
      title: blogData.title,
      body_html: blogData.body_html,
      seo_title: blogData.seo_title || blogData.title,
      seo_description: blogData.seo_description || "",
      tags: blogData.tags || "",
    },
    creditsRemaining: deduction.remaining,
    cost: CREDIT_LIMITS.BLOG_GENERATE,
  });
}
