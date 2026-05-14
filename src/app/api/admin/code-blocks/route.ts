// ─── /api/admin/code-blocks ──────────────────────────────────────
// Admin CRUD for the Shopify custom-liquid snippet library.
// GET    → list all blocks (admins see inactive too)
// POST   → create a block
// PATCH  → update a block (rowIndex required)
// DELETE → remove a block (rowIndex required)

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllCodeBlocks,
  addCodeBlock,
  updateCodeBlock,
  deleteCodeBlock,
  type CodeBlock,
  type CodeBlockOption,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

function sanitizeOptions(input: unknown): CodeBlockOption[] {
  if (!Array.isArray(input)) return [];
  const out: CodeBlockOption[] = [];
  for (let i = 0; i < input.length; i++) {
    const o = input[i];
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const original = typeof r.original === "string" ? r.original : "";
    if (!original) continue;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id : `opt_${Date.now()}_${i}`,
      label: typeof r.label === "string" && r.label ? r.label : `Option ${i + 1}`,
      type: r.type === "color" ? "color" : "text",
      original,
    });
  }
  return out;
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.isAdmin) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const blocks = await getAllCodeBlocks();
    blocks.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[CodeBlocks] GET error:", error);
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
    const code = String(body.code || "");
    if (!title) return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });
    if (!code) return NextResponse.json({ error: "Code fehlt" }, { status: 400 });

    const block: Omit<CodeBlock, "rowIndex"> = {
      id: `cb_${Date.now()}`,
      title,
      description: String(body.description || ""),
      code,
      previewImageUrl: String(body.previewImageUrl || ""),
      options: sanitizeOptions(body.options),
      active: body.active !== false,
      createdAt: new Date().toISOString(),
    };
    await addCodeBlock(block);
    return NextResponse.json({ success: true, block });
  } catch (error) {
    console.error("[CodeBlocks] POST error:", error);
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
    const rowIndex = Number(body.rowIndex);
    if (!rowIndex) return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });

    const patch: Partial<Omit<CodeBlock, "rowIndex" | "id" | "createdAt">> = {};
    if (body.title !== undefined) patch.title = String(body.title);
    if (body.description !== undefined) patch.description = String(body.description);
    if (body.code !== undefined) patch.code = String(body.code);
    if (body.previewImageUrl !== undefined) patch.previewImageUrl = String(body.previewImageUrl);
    if (body.options !== undefined) patch.options = sanitizeOptions(body.options);
    if (body.active !== undefined) patch.active = !!body.active;

    await updateCodeBlock(rowIndex, patch);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CodeBlocks] PATCH error:", error);
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
    await deleteCodeBlock(Number(rowIndex));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CodeBlocks] DELETE error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
