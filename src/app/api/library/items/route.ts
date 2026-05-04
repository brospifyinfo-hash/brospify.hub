// ─── /api/library/items ──────────────────────────────────────────
// User-owned media vault.
//
//   GET    → list current user's items (newest first)
//   POST   → save an item; body shape depends on `mode`:
//              { mode: "image-url",  ...metadata }   reingests a remote URL
//                                                     (Upscaler / BG / AI-Studio
//                                                      already produced one)
//              { mode: "email",      ...metadata }   stores liquid + subject
//   DELETE → { rowIndex }   purge one row + its blobs
//
// Auth: any logged-in non-admin (admins skip — they aren't end-users).
// Cap: persistLibraryItem evicts oldest items past LIBRARY_MAX_ITEMS.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getLibraryItems,
  type LibraryItem,
  type LibrarySource,
} from "@/lib/sheets";
import {
  ingestRemoteImage,
  persistLibraryItem,
  purgeLibraryItem,
} from "@/lib/library";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOWED_SOURCES: LibrarySource[] = [
  "upscaler", "bg-remover", "ai-studio", "email-templates", "other",
];

function userKey(session: { lizenzschluessel?: string; isAdmin?: boolean }): string | null {
  if (session.isAdmin) return null;
  return session.lizenzschluessel?.trim() || null;
}

// ─── GET ────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const key = userKey(session);
  if (!key) {
    // Admins: nothing to surface. Return empty list rather than 403.
    return NextResponse.json({ items: [] });
  }
  const items = await getLibraryItems(key);
  // Newest first
  items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return NextResponse.json({ items });
}

// ─── POST ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const key = userKey(session);
  if (!key) {
    return NextResponse.json(
      { error: "Mediathek ist nur für Kunden verfügbar." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const mode = String(body.mode || "");
  const source = ALLOWED_SOURCES.includes(body.source as LibrarySource)
    ? (body.source as LibrarySource)
    : "other";
  const title = String(body.title || "").slice(0, 200) || "Unbenannt";
  const meta = (body.meta && typeof body.meta === "object")
    ? (body.meta as Record<string, unknown>)
    : {};

  // ── Image mode: re-ingest a remote URL through sharp + blob ──
  if (mode === "image-url") {
    const remoteUrl = String(body.remoteUrl || "");
    if (!/^https?:\/\//.test(remoteUrl)) {
      return NextResponse.json(
        { error: "remoteUrl fehlt oder ungültig." },
        { status: 400 },
      );
    }
    const keepAlpha = source === "bg-remover" || body.keepAlpha === true;
    const baseName = (typeof body.basename === "string" && body.basename) ||
      title || source;

    let prepared;
    try {
      prepared = await ingestRemoteImage(remoteUrl, baseName, keepAlpha);
    } catch (err) {
      console.error("[library] ingest failed:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Bild konnte nicht gespeichert werden: ${err.message}`
              : "Bild konnte nicht gespeichert werden.",
        },
        { status: 502 },
      );
    }

    const item = await persistLibraryItem(key, {
      type: "image",
      source,
      title,
      assetUrl: prepared.assetUrl,
      thumbnailUrl: prepared.thumbnailUrl,
      meta: {
        ...meta,
        width: prepared.width || meta.width,
        height: prepared.height || meta.height,
        bytes: prepared.bytes,
      },
    });

    return NextResponse.json({ success: true, item });
  }

  // ── Email mode: store liquid + subject as inline text ──
  if (mode === "email") {
    const liquid = String(body.liquid || "");
    const subject = String(body.subject || "");
    if (!liquid) {
      return NextResponse.json(
        { error: "liquid fehlt." },
        { status: 400 },
      );
    }
    const item = await persistLibraryItem(key, {
      type: "email",
      source: "email-templates",
      title: subject || title,
      assetUrl: "",
      thumbnailUrl: "",
      body: liquid,
      meta: {
        ...meta,
        subject,
      },
    });
    return NextResponse.json({ success: true, item });
  }

  return NextResponse.json(
    { error: `Unbekannter mode "${mode}".` },
    { status: 400 },
  );
}

// ─── DELETE ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const key = userKey(session);
  if (!key) {
    return NextResponse.json({ error: "Nicht erlaubt." }, { status: 403 });
  }

  let body: { rowIndex?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }
  const rowIndex = Number(body.rowIndex);
  if (!rowIndex) {
    return NextResponse.json({ error: "rowIndex fehlt." }, { status: 400 });
  }

  // Make sure the row belongs to this user — re-read and filter.
  const items = await getLibraryItems(key);
  const target: LibraryItem | undefined = items.find((it) => it.rowIndex === rowIndex);
  if (!target) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden." },
      { status: 404 },
    );
  }

  await purgeLibraryItem(target);
  return NextResponse.json({ success: true });
}
