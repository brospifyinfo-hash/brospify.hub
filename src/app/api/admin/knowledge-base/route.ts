import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminSetting, setAdminSetting } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET - Fetch current knowledge base
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin" }, { status: 403 });
    }

    const content = await getAdminSetting("ai_knowledge_base");
    return NextResponse.json({ content });
  } catch (error) {
    console.error("[KnowledgeBase] GET error:", error);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}

// POST - Update knowledge base
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin" }, { status: 403 });
    }

    const { content } = await req.json();
    if (typeof content !== "string") {
      return NextResponse.json({ error: "Content erforderlich" }, { status: 400 });
    }

    await setAdminSetting("ai_knowledge_base", content);
    console.log("[KnowledgeBase] Updated, length:", content.length);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[KnowledgeBase] POST error:", error);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}
