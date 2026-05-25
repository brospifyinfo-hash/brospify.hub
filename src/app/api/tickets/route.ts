import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllTickets,
  getTicketsByCustomer,
  getTicketById,
  addTicket,
  updateTicket,
  findKundeByKey,
} from "@/lib/sheets";
import type { TicketMessage } from "@/lib/sheets";
import { sendAdminTicketAlert } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET - List tickets (admin: all, customer: own)
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const ticketId = req.nextUrl.searchParams.get("ticketId");

    // Fetch single ticket
    if (ticketId) {
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
      }
      // Customers can only view their own tickets
      if (!session.isAdmin && ticket.customerKey !== session.lizenzschluessel) {
        return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
      }
      return NextResponse.json({ ticket });
    }

    // List tickets
    if (session.isAdmin) {
      const tickets = await getAllTickets();
      return NextResponse.json({ tickets });
    } else {
      const tickets = await getTicketsByCustomer(session.lizenzschluessel || "");
      return NextResponse.json({ tickets });
    }
  } catch (error) {
    console.error("[Tickets] GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}

// POST - Create a new ticket or add a message
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const body = await req.json();

    // Add message to existing ticket
    if (body.ticketId && body.message) {
      const ticket = await getTicketById(body.ticketId);
      if (!ticket) {
        return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
      }

      // Check access
      if (!session.isAdmin && ticket.customerKey !== session.lizenzschluessel) {
        return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
      }

      const newMsg: TicketMessage = {
        sender: session.isAdmin ? "admin" : "customer",
        name: session.isAdmin ? "Support" : (body.senderName || "Kunde"),
        content: body.message,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...ticket.messages, newMsg];
      await updateTicket(ticket.rowIndex, {
        messages: updatedMessages,
        updatedAt: new Date().toISOString(),
        status: session.isAdmin ? "open" : ticket.status,
      });

      return NextResponse.json({ success: true, message: newMsg });
    }

    // Create new ticket
    const { subject, initialMessage, aiHistory, customerName } = body;

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Betreff erforderlich" }, { status: 400 });
    }

    const messages: TicketMessage[] = [];

    // Include AI chat history in the ticket
    if (aiHistory && Array.isArray(aiHistory)) {
      for (const msg of aiHistory) {
        messages.push({
          sender: msg.role === "user" ? "customer" : "ai",
          name: msg.role === "user" ? (customerName || "Kunde") : "KI-Agent",
          content: msg.content,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (initialMessage?.trim()) {
      messages.push({
        sender: "customer",
        name: customerName || "Kunde",
        content: initialMessage.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    const now = new Date().toISOString();
    const ticket = {
      id: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      customerKey: session.lizenzschluessel || "unknown",
      customerName: customerName || session.googleName || "Kunde",
      subject: subject.trim(),
      status: "open" as const,
      createdAt: now,
      updatedAt: now,
      messages,
    };

    try {
      await addTicket(ticket);
    } catch (sheetErr) {
      console.error("[Tickets] Google Sheets write failed:", sheetErr);
      return NextResponse.json(
        { error: "Ticket konnte nicht in der Datenbank gespeichert werden. Bitte versuche es erneut." },
        { status: 500 }
      );
    }

    console.log("[Tickets] Created:", ticket.id, "for", ticket.customerKey, "subject:", ticket.subject);

    // Admin-Email-Benachrichtigung. Frueher fire-and-forget (void),
    // aber Vercel serverless killt das Promise nachdem die Response
    // raus ist -> Mail wurde nie verschickt. Jetzt AWAITED damit der
    // Send wirklich durchlaeuft, bevor wir antworten. Kosten: 300-800ms
    // extra Latenz beim Ticket-Submit, dafuer kommt die Mail garantiert.
    let emailStatus = "skipped";
    let emailError: string | undefined;
    try {
      let customerEmail = session.googleEmail || "";
      if (session.lizenzschluessel) {
        const k = await findKundeByKey(session.lizenzschluessel);
        if (k?.kundenEmail) customerEmail = k.kundenEmail;
      }
      const sendResult = await sendAdminTicketAlert({
        ticketId: ticket.id,
        subject: ticket.subject,
        customerName: ticket.customerName,
        customerEmail,
        customerKey: ticket.customerKey,
        initialMessage: initialMessage?.trim() || undefined,
      });
      if (sendResult.sent) {
        emailStatus = "sent";
        console.log("[Tickets] admin email sent ok:", sendResult.id);
      } else {
        emailStatus = "failed";
        emailError = sendResult.error;
        console.warn("[Tickets] admin email NOT sent:", sendResult.error);
      }
    } catch (e) {
      emailStatus = "exception";
      emailError = e instanceof Error ? e.message : String(e);
      console.error("[Tickets] admin email threw:", e);
    }

    return NextResponse.json({ success: true, ticket, emailStatus, emailError });
  } catch (error) {
    console.error("[Tickets] POST error:", error);
    return NextResponse.json({ error: "Fehler beim Erstellen des Tickets." }, { status: 500 });
  }
}

// PUT - Update ticket status (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nur Admin" }, { status: 403 });
    }

    const { ticketId, status } = await req.json();
    if (!ticketId || !status) {
      return NextResponse.json({ error: "ticketId und status erforderlich" }, { status: 400 });
    }

    const ticket = await getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    await updateTicket(ticket.rowIndex, {
      status,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Tickets] PUT error:", error);
    return NextResponse.json({ error: "Fehler." }, { status: 500 });
  }
}
