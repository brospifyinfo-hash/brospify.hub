import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllProdukte, addProdukt, updateProdukt, deleteProdukt } from "@/lib/sheets";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  return session.isLoggedIn && session.isAdmin;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const produkte = await getAllProdukte();
    return NextResponse.json({ produkte });
  } catch (error) {
    console.error("Admin products fetch error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// ─── Shared helpers to extract data from any body format ────────
// The admin frontend sends: { extra: { stats, finances, images }, bildUrl, preis, ... }
// Bulk import sends:        { stats, finances, images, ... }
// We must handle BOTH formats.

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Build the extra JSON object from the request body.
 * Admin UI sends:   { extra: { stats, finances, images, links, ads, linkStatus }, ... }
 * Bulk import sends: { stats, finances, images, ... }
 * We handle BOTH by checking body.extra first, then top-level.
 */
function buildExtra(body: Record<string, unknown>): {
  stats?: { trendScore: number; viralScore: number; impulseBuyFactor: number; problemSolverIndex: number; marketSaturation: number };
  finances?: { buyPrice: number; recommendedSellPrice: number; profitMargin: number };
  images?: string[];
  links?: Record<string, unknown>;
  ads?: Record<string, unknown>;
  linkStatus?: Record<string, unknown>;
  deepStats?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  adStrategy?: Record<string, unknown>;
} {
  const nested = body.extra as Record<string, unknown> | undefined;

  // Stats: prefer nested, fall back to top-level
  const stats = (nested?.stats || body.stats || undefined) as any;

  // Finances: prefer nested, fall back to top-level
  const finances = (nested?.finances || body.finances || undefined) as any;

  // Images: prefer nested, fall back to top-level — ensure it's a real array of strings
  const rawImages = nested?.images || body.images;
  let images: string[] | undefined;
  if (Array.isArray(rawImages) && rawImages.length > 0) {
    images = rawImages.filter((u: any) => typeof u === "string" && u.length > 0);
    if (images.length === 0) images = undefined;
  }

  // Strukturierte Felder durchreichen — Admin UI editiert sie nicht
  // direkt, aber sie müssen erhalten bleiben (Linkstatus pflegt der
  // Cron, Ads kommen aus der KI-Discovery).
  const pickObj = (v: unknown): Record<string, unknown> | undefined =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

  const links = pickObj(nested?.links) || pickObj(body.links);
  const ads = pickObj(nested?.ads) || pickObj(body.ads);
  const linkStatus = pickObj(nested?.linkStatus) || pickObj(body.linkStatus);
  const deepStats = pickObj(nested?.deepStats) || pickObj(body.deepStats);
  const audience = pickObj(nested?.audience) || pickObj(body.audience);
  const adStrategy = pickObj(nested?.adStrategy) || pickObj(body.adStrategy);

  console.log("[buildExtra] nested?.images:", JSON.stringify(nested?.images));
  console.log("[buildExtra] body.images:", JSON.stringify(body.images));
  console.log("[buildExtra] final images:", JSON.stringify(images));
  console.log(
    "[buildExtra] structured present?",
    !!links, !!ads, !!linkStatus, !!deepStats, !!audience, !!adStrategy,
  );

  return { stats, finances, images, links, ads, linkStatus, deepStats, audience, adStrategy };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function extractBildUrl(body: Record<string, unknown>): string {
  const extra = body.extra as Record<string, unknown> | undefined;
  const topImages = body.images as string[] | undefined;
  const extraImages = extra?.images as string[] | undefined;
  return topImages?.[0] || extraImages?.[0] || (body.bildUrl as string) || "";
}

function extractPreis(body: Record<string, unknown>): string {
  const extra = body.extra as Record<string, unknown> | undefined;
  const topFin = body.finances as Record<string, number> | undefined;
  const extraFin = extra?.finances as Record<string, number> | undefined;
  const price = topFin?.recommendedSellPrice || extraFin?.recommendedSellPrice || body.preis || "";
  return String(price);
}

// Auto-ID-Pattern: alles was wie `prod_<digits>` aussieht. NIEMALS
// als titel akzeptieren.
const AUTO_ID_PATTERN = /^prod[_-]\d/i;

/**
 * Sanity-Check + Auto-Repair fuer den Body bevor wir speichern.
 *
 * Wir haben den Bug beobachtet dass manchmal trotz korrektem Frontend-
 * Code titel mit der ID gefuellt wird. Hier ist die LAST LINE OF DEFENSE:
 *
 *   - Wenn titel verdaechtig aussieht (matched AUTO_ID_PATTERN), pruefen
 *     wir alternative Felder: preis, beschreibung, body.title, body.name.
 *     Sobald wir was Brauchbares finden → das wird der titel.
 *   - Wenn preis selbst kein Zahlenwert ist und wir titel von preis
 *     uebernommen haben → preis leeren (war ja eh kein Preis).
 *   - Wenn nichts brauchbares zu finden ist → 400 mit klarer Meldung.
 *
 * So GARANTIEREN wir dass eine Auto-ID nie als Titel gespeichert wird.
 */
function repairBodyTitelPreis(
  rawTitel: string,
  rawPreis: string,
  body: Record<string, unknown>,
): { titel: string; preis: string; warning?: string } | { error: string } {
  const titel = (rawTitel || "").trim();
  const preis = (rawPreis || "").trim();

  // Happy path: titel sieht NICHT wie eine ID aus.
  if (titel && !AUTO_ID_PATTERN.test(titel)) {
    return { titel, preis };
  }

  // titel ist leer ODER sieht wie eine ID aus. Wir suchen einen echten
  // Titel in alternativen Quellen.
  const candidates: Array<{ value: string; source: string }> = [
    { value: preis, source: "preis" },
    { value: String(body.title || "").trim(), source: "body.title" },
    { value: String(body.name || "").trim(), source: "body.name" },
  ];

  for (const c of candidates) {
    if (!c.value) continue;
    if (AUTO_ID_PATTERN.test(c.value)) continue; // selbst eine ID
    if (/^[\d.,]+$/.test(c.value)) continue; // reine Zahl
    if (c.value.length < 4) continue; // zu kurz
    // Treffer! Den nehmen wir als titel.
    const newTitel = c.value;
    // Wenn der Titel aus dem preis-Feld kam, preis leeren (war kein Preis).
    const newPreis = c.source === "preis" ? "" : preis;
    return {
      titel: newTitel,
      preis: newPreis,
      warning: `Titel war suspekt ("${titel || "leer"}") — automatisch aus ${c.source} uebernommen.`,
    };
  }

  // Nichts gefunden — hartes 400.
  return {
    error: titel
      ? `Titel sieht aus wie eine ID ("${titel}") und kein anderes Feld liefert einen echten Titel. Bitte echten Produktnamen eingeben.`
      : "Titel ist erforderlich. Speichern abgebrochen.",
  };
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();

    // VOLLES BODY-LOGGING (bewusst), damit wir bei kommenden Bugreports
    // sofort sehen WAS rein kam.
    console.log("=== [Admin POST] FULL BODY ===");
    console.log(JSON.stringify(body, null, 2));

    // Build extra: prefer body.extra (from admin UI), fall back to top-level fields (bulk import)
    const extra = buildExtra(body);
    const bildUrl = extractBildUrl(body);
    const rawPreis = extractPreis(body);
    const rawTitel = String(body.title || body.titel || "");

    // SAFETY NET: titel darf nie ID sein. repairBodyTitelPreis tauscht
    // automatisch wenn moeglich, sonst hartes 400.
    const repaired = repairBodyTitelPreis(rawTitel, rawPreis, body);
    if ("error" in repaired) {
      console.warn("[Admin POST] rejected:", repaired.error);
      return NextResponse.json({ error: repaired.error }, { status: 400 });
    }
    if (repaired.warning) console.warn("[Admin POST] auto-repair:", repaired.warning);
    const titel = repaired.titel;
    const preis = repaired.preis;

    const id = String(body.id || `prod_${Date.now()}`);
    console.log("=== [Admin POST] BACKEND EMPFANGEN ===");
    console.log("[Admin POST] id:", id, "titel:", titel, "preis:", preis);
    console.log("[Admin POST] bildUrl:", bildUrl);
    console.log("[Admin POST] built extra keys:", Object.keys(extra).join(","));

    await addProdukt({
      id,
      sku: body.sku || "",
      monat: body.monat || "",
      titel,
      bildUrl,
      beschreibung: body.description || body.beschreibung || "",
      preis,
      aliExpressLink: body.links?.aliexpressLink || body.aliExpressLink || "",
      extra,
    });
    // Antwort enthaelt was wir TATSAECHLICH geschrieben haben, damit
    // das Frontend sofort verifizieren kann.
    return NextResponse.json({
      success: true,
      saved: { id, titel, preis, bildUrl },
      warning: repaired.warning,
    });
  } catch (error) {
    console.error("Admin add product error:", error);
    return NextResponse.json({ error: "Fehler beim Hinzufügen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const body = await req.json();
    if (!body.rowIndex) {
      return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    }

    console.log("=== [Admin PUT] FULL BODY ===");
    console.log(JSON.stringify(body, null, 2));

    // Build extra: prefer body.extra (from admin UI), fall back to top-level fields (bulk import)
    const extra = buildExtra(body);
    const bildUrl = extractBildUrl(body);
    const rawPreis = extractPreis(body);
    const rawTitel = String(body.title || body.titel || "");

    // SAFETY NET wie im POST.
    const repaired = repairBodyTitelPreis(rawTitel, rawPreis, body);
    if ("error" in repaired) {
      console.warn("[Admin PUT] rejected:", repaired.error);
      return NextResponse.json({ error: repaired.error }, { status: 400 });
    }
    if (repaired.warning) console.warn("[Admin PUT] auto-repair:", repaired.warning);
    const titel = repaired.titel;
    const preis = repaired.preis;

    console.log("=== [Admin PUT] BACKEND EMPFANGEN ===");
    console.log("[Admin PUT] row:", body.rowIndex, "titel:", titel, "preis:", preis);
    console.log("[Admin PUT] bildUrl:", bildUrl);
    console.log("[Admin PUT] built extra keys:", Object.keys(extra).join(","));

    await updateProdukt(body.rowIndex, {
      id: body.id,
      sku: body.sku || "",
      monat: body.monat || "",
      titel,
      bildUrl,
      beschreibung: body.description || body.beschreibung || "",
      preis,
      aliExpressLink: body.links?.aliexpressLink || body.aliExpressLink || "",
      extra,
    });
    return NextResponse.json({
      success: true,
      saved: { id: body.id, titel, preis, bildUrl },
      warning: repaired.warning,
    });
  } catch (error) {
    console.error("Admin update product error:", error);
    return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
  try {
    const { rowIndex } = await req.json();
    if (!rowIndex) return NextResponse.json({ error: "rowIndex fehlt" }, { status: 400 });
    await deleteProdukt(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin delete product error:", error);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
