// ─── /api/admin/coaching ─────────────────────────────────────────
// Admin CRUD for the Gold "Privates Coaching" tip feed, plus the
// WhatsApp contact number (stored in the Settings sheet).
//
// GET    → { tips, whatsapp }
// POST   → create a tip
// PATCH  → update a tip (rowIndex) OR update whatsapp ({ whatsapp })
// DELETE → remove a tip (rowIndex)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllCoachingTips,
  addCoachingTip,
  updateCoachingTip,
  deleteCoachingTip,
  getAdminSetting,
  setAdminSetting,
  type CoachingTip,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

const WHATSAPP_KEY = "coaching_whatsapp";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const [tips, whatsapp] = await Promise.all([
      getAllCoachingTips(),
      getAdminSetting(WHATSAPP_KEY),
    ]);
    tips.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json({ tips, whatsapp: whatsapp || "" });
  } catch (error) {
    console.error("[Coaching] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });

    const tip: Omit<CoachingTip, "rowIndex"> = {
      id: `tip_${Date.now()}`,
      title,
      body: String(body.body || ""),
      mediaUrl: String(body.mediaUrl || ""),
      author: body.author === "ai" ? "ai" : "admin",
      active: body.active !== false,
      createdAt: new Date().toISOString(),
    };
    await addCoachingTip(tip);
    return NextResponse.json({ success: true, tip });
  } catch (error) {
    console.error("[Coaching] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const body = await req.json();

    // WhatsApp number update path
    if (body.whatsapp !== undefined) {
      await setAdminSetting(WHATSAPP_KEY, String(body.whatsapp || "").trim());
      return NextResponse.json({ success: true, whatsapp: String(body.whatsapp || "").trim() });
    }

    const rowIndex = Number(body.rowIndex);
    if (!rowIndex) return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });

    const patch: Partial<Omit<CoachingTip, "rowIndex" | "id" | "createdAt">> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.body !== undefined) patch.body = String(body.body);
    if (body.mediaUrl !== undefined) patch.mediaUrl = String(body.mediaUrl);
    if (body.author !== undefined) patch.author = body.author === "ai" ? "ai" : "admin";
    if (body.active !== undefined) patch.active = !!body.active;

    await updateCoachingTip(rowIndex, patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Coaching] PATCH error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const { rowIndex } = await req.json();
    if (!rowIndex) return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    await deleteCoachingTip(Number(rowIndex));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Coaching] DELETE error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
