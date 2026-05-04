import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllNewsPosts,
  addNewsPost,
  updateNewsPost,
  deleteNewsPost,
  type NewsPost,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET — list all active news posts (any logged-in user)
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const posts = await getAllNewsPosts();
    // Admins see everything (incl. inactive) so they can manage; users see only active.
    const filtered = session.isAdmin ? posts : posts.filter((p) => p.active);
    // Newest first
    filtered.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json({ posts: filtered });
  } catch (error) {
    console.error("[News] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST — create a news post (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const type: NewsPost["type"] = body.type === "video" ? "video" : "text";
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
    }

    const post: Omit<NewsPost, "rowIndex"> = {
      id: `news_${Date.now()}`,
      type,
      title,
      body: String(body.body || ""),
      imageUrl: String(body.imageUrl || ""),
      youtubeUrl: String(body.youtubeUrl || ""),
      previewImageUrl: String(body.previewImageUrl || ""),
      active: body.active !== false,
      createdAt: new Date().toISOString(),
    };

    await addNewsPost(post);
    return NextResponse.json({ success: true, post });
  } catch (error) {
    console.error("[News] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}

// PATCH — update an existing news post (admin only)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();
    const rowIndex = Number(body.rowIndex);
    if (!rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    }

    const patch: Partial<NewsPost> = {};
    if (body.type !== undefined) patch.type = body.type === "video" ? "video" : "text";
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.body !== undefined) patch.body = String(body.body);
    if (body.imageUrl !== undefined) patch.imageUrl = String(body.imageUrl);
    if (body.youtubeUrl !== undefined) patch.youtubeUrl = String(body.youtubeUrl);
    if (body.previewImageUrl !== undefined) patch.previewImageUrl = String(body.previewImageUrl);
    if (body.active !== undefined) patch.active = !!body.active;

    await updateNewsPost(rowIndex, patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[News] PATCH error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

// DELETE — remove a news post (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { rowIndex } = await req.json();
    if (!rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    }

    await deleteNewsPost(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[News] DELETE error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
