import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllStartTasks,
  addStartTask,
  updateStartTask,
  deleteStartTask,
  type StartTask,
} from "@/lib/sheets";
import { sanitizeTaskHtml } from "@/lib/sanitize-html";

export const dynamic = "force-dynamic";

// GET — admins see everything (incl. inactive), users see active only.
export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const tasks = await getAllStartTasks();
    const filtered = session.isAdmin ? tasks : tasks.filter((t) => t.active);
    return NextResponse.json({ tasks: filtered });
  } catch (err) {
    console.error("[StartTasks] GET error:", err);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST — admin creates a new task.
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
    }
    // Append to the end by default — pick a sort > current max so the
    // new task lands at the bottom of the visible list.
    const existing = await getAllStartTasks();
    const nextSort = existing.length === 0
      ? 10
      : Math.max(...existing.map((t) => t.sort)) + 10;
    const task: Omit<StartTask, "rowIndex"> = {
      id: `task_${Date.now()}`,
      title,
      bodyHtml: sanitizeTaskHtml(String(body.bodyHtml || "")),
      sort: typeof body.sort === "number" ? body.sort : nextSort,
      active: body.active !== false,
      createdAt: new Date().toISOString(),
    };
    await addStartTask(task);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    console.error("[StartTasks] POST error:", err);
    return NextResponse.json({ error: "Fehler beim Erstellen" }, { status: 500 });
  }
}

// PATCH — admin edits / reorders / toggles a task.
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
    const patch: Partial<StartTask> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.bodyHtml !== undefined) patch.bodyHtml = sanitizeTaskHtml(String(body.bodyHtml));
    if (body.sort !== undefined) patch.sort = Number(body.sort) || 0;
    if (body.active !== undefined) patch.active = !!body.active;
    await updateStartTask(rowIndex, patch);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[StartTasks] PATCH error:", err);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

// DELETE — admin removes a task.
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
    await deleteStartTask(Number(rowIndex));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[StartTasks] DELETE error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
