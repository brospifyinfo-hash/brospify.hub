import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllChatRooms, addChatRoom, updateChatRoom } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["general", "creatives", "qa"];

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
  // Step 1: Authenticate
  let session;
  try {
    session = await getSession();
  } catch (error) {
    console.error("[Chats] POST session error:", error);
    return NextResponse.json({ error: "Session konnte nicht geladen werden." }, { status: 500 });
  }

  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht eingeloggt. Bitte melde dich erneut an." }, { status: 401 });
  }
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Nur Admins können Channels erstellen." }, { status: 403 });
  }

  // Step 2: Parse body
  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error("[Chats] POST parse error:", error);
    return NextResponse.json({ error: "Ungültige Anfrage. JSON konnte nicht gelesen werden." }, { status: 400 });
  }

  const { name, description, allowCustomerMessages, category } = body;

  // Step 3: Validate fields
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Channel-Name ist erforderlich und darf nicht leer sein." }, { status: 400 });
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Channel-Name darf maximal 100 Zeichen lang sein." }, { status: 400 });
  }

  const sanitizedCategory = VALID_CATEGORIES.includes(category?.trim())
    ? category.trim()
    : "general";

  // Step 4: Build the room object matching Google Sheet columns exactly:
  // A=ID, B=Name, C=Description, D=CreatedAt, E=CreatedBy,
  // F=AllowCustomerMessages, G=Status, H=Category
  const room = {
    id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : "",
    createdAt: new Date().toISOString(),
    createdBy: session.lizenzschluessel || "admin",
    allowCustomerMessages: allowCustomerMessages === true,
    status: "active",
    category: sanitizedCategory,
  };

  // Step 5: Write to Google Sheets
  try {
    await addChatRoom(room);
    console.log("[Chats] Room created:", room.id, room.name, "category:", room.category);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Chats] POST Google Sheets write failed:", errMsg);

    if (errMsg.includes("Unable to parse range") || errMsg.includes("not found")) {
      return NextResponse.json({
        error: "Das 'Chats'-Sheet existiert nicht in der Google Tabelle. Bitte erstelle es manuell mit den Spalten: ID, Name, Description, CreatedAt, CreatedBy, AllowCustomerMessages, Status, Category.",
      }, { status: 500 });
    }

    return NextResponse.json({
      error: `Channel konnte nicht gespeichert werden: ${errMsg.slice(0, 120)}`,
    }, { status: 500 });
  }

  return NextResponse.json({ success: true, room });
}

// PUT - Update a chat room (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin-Zugriff" }, { status: 403 });
    }

    const body = await req.json();
    const { roomId, name, description, allowCustomerMessages, status, category } = body;

    if (!roomId) {
      return NextResponse.json({ error: "roomId fehlt in der Anfrage." }, { status: 400 });
    }

    const rooms = await getAllChatRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      return NextResponse.json({ error: `Raum mit ID '${roomId}' nicht gefunden.` }, { status: 404 });
    }

    const updated = {
      id: room.id,
      name: name?.trim() || room.name,
      description: description !== undefined ? description.trim() : room.description,
      createdAt: room.createdAt,
      createdBy: room.createdBy,
      allowCustomerMessages: allowCustomerMessages !== undefined ? !!allowCustomerMessages : room.allowCustomerMessages,
      status: status || room.status,
      category: category?.trim() || room.category || "general",
    };

    await updateChatRoom(room.rowIndex, updated);

    return NextResponse.json({ success: true, room: updated });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Chats] PUT error:", errMsg);
    return NextResponse.json({ error: `Fehler beim Aktualisieren: ${errMsg.slice(0, 120)}` }, { status: 500 });
  }
}
