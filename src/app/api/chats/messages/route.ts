import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getChatMessages,
  getAllPendingMessages,
  addChatMessage,
  updateMessageStatus,
  getAllChatRooms,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

// GET - List messages for a chat room
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const chatId = req.nextUrl.searchParams.get("chatId");
    const pending = req.nextUrl.searchParams.get("pending");

    // Admin: get all pending messages across all rooms
    if (pending === "true" && session.isAdmin) {
      const messages = await getAllPendingMessages();
      return NextResponse.json({ messages });
    }

    if (!chatId) {
      return NextResponse.json({ error: "chatId fehlt" }, { status: 400 });
    }

    const includeHidden = session.isAdmin;
    const allMessages = await getChatMessages(chatId, includeHidden);

    // Non-admin: filter out pending messages from other customers
    const messages = session.isAdmin
      ? allMessages
      : allMessages.filter(
          (m) => m.messageStatus === "approved" || (m.messageStatus === "pending" && m.senderId === session.lizenzschluessel)
        );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[Messages] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}

// POST - Create a new message
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const { chatId, content, imageUrl, imageBgColor, senderName } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: "chatId fehlt" }, { status: 400 });
    }
    if (!content?.trim() && !imageUrl) {
      return NextResponse.json({ error: "Nachricht oder Bild erforderlich" }, { status: 400 });
    }

    // Check if room allows customer messages (if not admin)
    if (!session.isAdmin) {
      const rooms = await getAllChatRooms();
      const room = rooms.find((r) => r.id === chatId);
      if (!room) {
        return NextResponse.json({ error: "Raum nicht gefunden" }, { status: 404 });
      }
      if (!room.allowCustomerMessages) {
        return NextResponse.json({ error: "Nachrichten in diesem Raum nicht erlaubt" }, { status: 403 });
      }
    }

    const isAdmin = session.isAdmin;
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      chatId,
      senderType: isAdmin ? "admin" : "customer",
      senderId: isAdmin ? "admin" : (session.lizenzschluessel || "unknown"),
      senderName: isAdmin ? "BrospifyHub" : (senderName || "Kunde"),
      content: content?.trim() || "",
      imageUrl: imageUrl || "",
      imageBgColor: imageBgColor || "",
      messageStatus: isAdmin ? "approved" : "pending",
      createdAt: new Date().toISOString(),
    };

    await addChatMessage(msg);

    return NextResponse.json({ success: true, message: msg });
  } catch (error) {
    console.error("[Messages] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Senden." }, { status: 500 });
  }
}

// PUT - Approve, reject, or hide a message (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin-Zugriff" }, { status: 403 });
    }

    const { messageId, chatId, status } = await req.json();
    if (!messageId || !status) {
      return NextResponse.json({ error: "messageId und status erforderlich" }, { status: 400 });
    }

    if (!["approved", "hidden", "pending"].includes(status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    // Find the message to get its row index
    const messages = await getChatMessages(chatId || "", true);
    const msg = messages.find((m) => m.id === messageId);

    if (!msg) {
      // Search across all rooms
      const rooms = await getAllChatRooms();
      for (const room of rooms) {
        const roomMsgs = await getChatMessages(room.id, true);
        const found = roomMsgs.find((m) => m.id === messageId);
        if (found) {
          await updateMessageStatus(found.rowIndex, status);
          return NextResponse.json({ success: true });
        }
      }
      return NextResponse.json({ error: "Nachricht nicht gefunden" }, { status: 404 });
    }

    await updateMessageStatus(msg.rowIndex, status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Messages] PUT error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren." }, { status: 500 });
  }
}
