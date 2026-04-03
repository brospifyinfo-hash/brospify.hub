import { NextResponse } from "next/server";

// This route is no longer used - OAuth is now initiated via /api/setup/connect
// Keeping the file to prevent 404 on any stale references
export async function POST() {
  return NextResponse.json(
    { error: "Bitte nutze den neuen Verbindungsflow über /setup." },
    { status: 410 }
  );
}
