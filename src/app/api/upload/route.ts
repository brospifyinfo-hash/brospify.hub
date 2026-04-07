import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    // Non-admins can only upload images (for chat), not zips
    const isAdmin = session.isAdmin;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei." }, { status: 400 });
    }

    // Allow images and zip files
    const isImage = file.type.startsWith("image/");
    const isZip = file.type === "application/zip" || file.type === "application/x-zip-compressed" || file.name.endsWith(".zip");

    if (!isImage && !isZip) {
      return NextResponse.json({ error: "Nur Bilder und ZIP-Dateien erlaubt." }, { status: 400 });
    }

    // Non-admins cannot upload ZIP files
    if (isZip && !isAdmin) {
      return NextResponse.json({ error: "ZIP-Upload nur für Admins." }, { status: 403 });
    }

    // Max 50MB for zip, 5MB for images
    const maxSize = isZip ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `Max. ${isZip ? "50" : "5"}MB pro Datei.` }, { status: 400 });
    }

    const folder = isZip ? "themes" : "products";
    const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload fehlgeschlagen. Stelle sicher, dass BLOB_READ_WRITE_TOKEN gesetzt ist." },
      { status: 500 }
    );
  }
}
