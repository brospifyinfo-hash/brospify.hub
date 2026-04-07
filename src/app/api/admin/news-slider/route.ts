import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllNewsSlides, addNewsSlide, deleteNewsSlide } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET — list all slides (available to all logged-in users)
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const slides = await getAllNewsSlides();
    const active = slides.filter((s) => s.active);
    return NextResponse.json({ slides: active });
  } catch (error) {
    console.error("[News Slider] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST — create a new slide (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { title, subtitle, imageUrl, linkUrl } = await req.json();
    if (!title) {
      return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
    }

    const slide = {
      id: `slide_${Date.now()}`,
      title,
      subtitle: subtitle || "",
      imageUrl: imageUrl || "",
      linkUrl: linkUrl || "",
      active: true,
      createdAt: new Date().toISOString(),
    };

    await addNewsSlide(slide);
    return NextResponse.json({ success: true, slide });
  } catch (error) {
    console.error("[News Slider] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}

// DELETE — remove a slide (admin only)
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

    await deleteNewsSlide(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[News Slider] DELETE error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
