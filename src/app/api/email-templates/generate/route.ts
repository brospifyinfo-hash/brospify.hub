/**
 * POST /api/email-templates/generate
 *
 * Nimmt die Editor-Eingaben (Tonfall, Notizen) entgegen und ruft den
 * AI-Generator auf. Liefert generiertes Liquid + HTML zurück, das die UI
 * im Preview rendert und auf Wunsch über /deploy zu Shopify schickt.
 *
 * Body (JSON):
 *   {
 *     templateKey: EmailTemplateKey,    // siehe lib/email-templates.ts
 *     tone: "serioes" | "locker" | "luxurioes" | "freundlich",
 *     notes: string,                    // freier Hinweistext, max ~500 Zeichen
 *     brandName?: string,               // optional, Override für {{ shop.name }}
 *     accentColor?: string              // optional, Hex
 *   }
 *
 * Response:
 *   { subject: string, html: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  generateEmailTemplate,
  type BrandTone,
} from "@/lib/ai-email-generator";
import type { EmailTemplateKey } from "@/lib/email-templates";

const VALID_TONES: BrandTone[] = ["serioes", "locker", "luxurioes", "freundlich"];
const VALID_KEYS: EmailTemplateKey[] = [
  "order_confirmation",
  "shipping_confirmation",
  "abandoned_checkout",
  "customer_account_welcome",
  "order_refund",
  "shipping_update",
  "customer_account_activate",
  "customer_password_reset",
  "gift_card_notification",
  "order_invoice",
];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const { templateKey, tone, notes, brandName, accentColor } = body ?? {};

    if (!VALID_KEYS.includes(templateKey)) {
      return NextResponse.json(
        { error: "Ungültiger Template-Key." },
        { status: 400 }
      );
    }
    if (!VALID_TONES.includes(tone)) {
      return NextResponse.json(
        { error: "Ungültiger Tonfall." },
        { status: 400 }
      );
    }

    // Notizen begrenzen — verhindert XL-Eingaben Richtung LLM.
    const safeNotes = typeof notes === "string" ? notes.slice(0, 500) : "";

    const result = await generateEmailTemplate({
      templateKey,
      tone,
      notes: safeNotes,
      brandName: typeof brandName === "string" ? brandName.slice(0, 80) : undefined,
      accentColor:
        typeof accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(accentColor)
          ? accentColor
          : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("email-templates/generate error:", error);
    return NextResponse.json(
      { error: "Generierung fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
