// ─── POST /api/bookings ───────────────────────────────────
// Nimmt eine Terminanfrage entgegen. Jede Eingabe wird serverseitig
// geprüft: Dropdown-Werte müssen aus den Katalogen stammen, Freitexte
// werden gekappt, und der Slot muss zum Zeitpunkt des Absendens noch
// frei sein — die Reservierung passiert atomar im Store, damit zwei
// gleichzeitige Anfragen nicht denselben Termin bekommen.

import { NextRequest, NextResponse } from "next/server";
import { createBooking, readData } from "@/lib/store";
import { notifyCustomer, notifyStudio } from "@/lib/notify";
import {
  BUDGET_OPTIONS,
  COLOR_OPTIONS,
  PLACEMENT_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
  type Option,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Spam-Bremse: max. 5 Anfragen pro IP und Stunde ──────────────
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;
const rate = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rate.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  rate.set(ip, hits);
  return hits.length > RATE_MAX;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function inCatalog(options: Option[], value: string): boolean {
  return options.some((o) => o.value === value);
}

// Absichtlich pragmatisch: ein Zeichen, ein @, ein Punkt in der Domain.
// Strengere Regexe lehnen regelmäßig gültige Adressen ab — die echte
// Prüfung ist ohnehin, ob die Bestätigungsmail ankommt.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte melde dich telefonisch." },
        { status: 429 },
      );
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

    // Honeypot: ein für Menschen unsichtbares Feld. Bots füllen es aus.
    // Wir antworten trotzdem mit 200, damit der Bot nichts dazulernt.
    if (str(body.website, 200)) return NextResponse.json({ ok: true });

    const slotId = str(body.slotId, 64);
    const name = str(body.name, 80);
    const email = str(body.email, 160).toLowerCase();
    const phone = str(body.phone, 40);
    const style = str(body.style, 40);
    const size = str(body.size, 40);
    const placement = str(body.placement, 40);
    const colorMode = str(body.colorMode, 40);
    const budget = str(body.budget, 40);
    const idea = str(body.idea, 2000);
    const referenceUrl = str(body.referenceUrl, 500);
    const isFirstTattoo = body.isFirstTattoo === true;
    const consent = body.consent === true;

    const errors: Record<string, string> = {};
    if (!slotId) errors.slotId = "Bitte wähle einen Termin.";
    if (name.length < 2) errors.name = "Bitte gib deinen Namen an.";
    if (!EMAIL_RE.test(email)) errors.email = "Bitte gib eine gültige E-Mail-Adresse an.";
    if (phone.replace(/\D/g, "").length < 6) errors.phone = "Bitte gib eine erreichbare Telefonnummer an.";
    if (!inCatalog(STYLE_OPTIONS, style)) errors.style = "Bitte wähle einen Stil.";
    if (!inCatalog(SIZE_OPTIONS, size)) errors.size = "Bitte wähle eine Größe.";
    if (!inCatalog(PLACEMENT_OPTIONS, placement)) errors.placement = "Bitte wähle eine Körperstelle.";
    if (!inCatalog(COLOR_OPTIONS, colorMode)) errors.colorMode = "Bitte wähle Schwarz-Grau oder Farbe.";
    if (!inCatalog(BUDGET_OPTIONS, budget)) errors.budget = "Bitte wähle einen Budgetrahmen.";
    if (idea.length < 10) errors.idea = "Beschreib dein Motiv in ein, zwei Sätzen.";
    if (referenceUrl && !/^https?:\/\//i.test(referenceUrl)) {
      errors.referenceUrl = "Bitte einen vollständigen Link mit https:// angeben.";
    }
    if (!consent) errors.consent = "Ohne Einwilligung können wir die Anfrage nicht speichern.";

    if (Object.keys(errors).length) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const result = await createBooking({
      slotId, name, email, phone, style, size, placement, colorMode, budget,
      idea, isFirstTattoo,
      referenceUrl: referenceUrl || undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "slot-taken"
              ? "Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen."
              : "Dieser Termin existiert nicht mehr. Bitte wähle einen anderen.",
          reason: result.reason,
        },
        { status: 409 },
      );
    }

    // Mails bewusst VOR der Antwort abwarten: eine Serverless-Function
    // kann nach dem Response abgeräumt werden, ein „fire and forget"
    // würde die Benachrichtigung verlieren. Beide Sender fangen ihre
    // Fehler selbst ab — die Anfrage ist ohnehin schon gespeichert.
    const { slots } = await readData();
    const slot = slots.find((s) => s.id === slotId);
    if (slot) {
      await Promise.allSettled([
        notifyStudio(result.booking, slot),
        notifyCustomer(result.booking, slot),
      ]);
    }

    return NextResponse.json({ ok: true, bookingId: result.booking.id });
  } catch (error) {
    console.error("[bookings] POST failed", error);
    return NextResponse.json(
      { error: "Da ist etwas schiefgelaufen. Bitte versuch es erneut." },
      { status: 500 },
    );
  }
}
