import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllChatRooms, addChatRoom, updateChatRoom } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET - List all active chat rooms
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const rooms = await getAllChatRooms();
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error("[Chats] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden der Chats." }, { status: 500 });
  }
}

// POST - Create a new chat room (admin only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin-Zugriff" }, { status: 403 });
    }

    const { name, description, allowCustomerMessages } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
    }

    const room = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description?.trim() || "",
      createdAt: new Date().toISOString(),
      createdBy: "admin",
      allowCustomerMessages: !!allowCustomerMessages,
      status: "active",
    };

    await addChatRoom(room);

    return NextResponse.json({ success: true, room });
  } catch (error) {
    console.error("[Chats] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen." }, { status: 500 });
  }
}

// PUT - Update a chat room (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin-Zugriff" }, { status: 403 });
    }

    const { roomId, name, description, allowCustomerMessages, status } = await req.json();
    if (!roomId) {
      return NextResponse.json({ error: "roomId fehlt" }, { status: 400 });
    }

    const rooms = await getAllChatRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      return NextResponse.json({ error: "Raum nicht gefunden" }, { status: 404 });
    }

    const updated = {
      id: room.id,
      name: name?.trim() || room.name,
      description: description !== undefined ? description.trim() : room.description,
      createdAt: room.createdAt,
      createdBy: room.createdBy,
      allowCustomerMessages: allowCustomerMessages !== undefined ? !!allowCustomerMessages : room.allowCustomerMessages,
      status: status || room.status,
    };

    await updateChatRoom(room.rowIndex, updated);

    return NextResponse.json({ success: true, room: updated });
  } catch (error) {
    console.error("[Chats] PUT error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 });
  }
}
