// ─── /api/charts/draw ────────────────────────────────────────────
// Zufalls-Generator ("Produkt-Drop"). Ersetzt die alte Produkt-Charts.
//
//   GET  → liefert den aktuellen Stand: bereits gezogene Produkte,
//          wie viele es insgesamt gibt, wie viele noch übrig sind und
//          was ein Zug kostet. Kein Credit-Abzug.
//   POST → zieht EIN zufälliges Produkt, das der Account noch nie
//          gezogen hat, und zieht dafür CHARTS_DRAW Credits ab.
//
// Garantie "kein Doppel-Ziehen": die gezogenen Produkt-IDs liegen
// append-only auf `profile.drawnProducts`. Vor jedem Zug filtern wir
// die bereits gezogenen heraus; gezogene ID + Credit-Abzug werden in
// EINEM Profil-Write gespeichert (deductCredits schreibt den ganzen
// Profil-Datensatz), also keine halben Zustände.

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireFeature } from "@/lib/tier-guard";
import {
  deductCredits,
  findKundeByKey,
  getAllProdukte,
  getCreditsState,
  updateKundeProfile,
  type Produkt,
} from "@/lib/sheets";
import { getCreditCost } from "@/lib/credit-config-server";
import { localizeArray, localizeObject, type Lang } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zielsprache aus ?lang= lesen. Englisch → Produktinhalte werden per KI
// übersetzt (gecached); Deutsch = Originaltext, keine Übersetzung.
function langFrom(req: NextRequest): Lang {
  return req.nextUrl.searchParams.get("lang") === "en" ? "en" : "de";
}

// Volle Projektion fürs Frontend — exakt die Felder, die die alte
// Charts-Detailansicht gerendert hat (Stats, Finanzen, Ads, Links,
// LinkStatus, DeepStats, Audience, AdStrategy, Votes, Bilder). So
// zeigt das Detail-Modal im Generator wieder ALLE Produktinhalte.
function project(p: Produkt) {
  return {
    id: p.id,
    sku: p.sku,
    monat: p.monat || "",
    titel: p.titel,
    preis: p.preis,
    bildUrl: p.bildUrl,
    beschreibung: p.beschreibung,
    aliExpressLink: p.aliExpressLink,
    extra: p.extra || {},
  };
}

// ─── GET: aktueller Stand ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  const guard = await requireFeature(session, "chartsAnalytics");
  if (!guard.ok) return guard.response;

  const lang = langFrom(req);

  const DRAW_COST = await getCreditCost("CHARTS_DRAW");

  let all: Produkt[];
  try {
    all = (await getAllProdukte()).filter((p) => p.id);
  } catch (err) {
    console.error("[charts/draw] GET getAllProdukte failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  const totalCount = all.length;

  // Admins haben keinen Kundendatensatz — sie testen ohne Historie.
  if (session.isAdmin || !session.lizenzschluessel) {
    return NextResponse.json(
      { ok: true, drawn: [], drawnCount: 0, totalCount, remainingCount: totalCount, cost: DRAW_COST },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }

  const drawnIds = Array.isArray(kunde.profile.drawnProducts) ? kunde.profile.drawnProducts : [];
  const drawnSet = new Set(drawnIds);
  // In der Reihenfolge des Ziehens (neueste zuletzt gezogen → vorne).
  const byId = new Map(all.map((p) => [p.id, p]));
  const drawnRaw = drawnIds
    .map((id) => byId.get(id))
    .filter((p): p is Produkt => !!p)
    .reverse()
    .map(project);
  // Bei Englisch die Produktinhalte per KI übersetzen (gecached, fail-safe).
  const drawn = await localizeArray(drawnRaw, lang);
  const remainingCount = all.filter((p) => !drawnSet.has(p.id)).length;

  return NextResponse.json(
    {
      ok: true,
      drawn,
      drawnCount: drawn.length,
      totalCount,
      remainingCount,
      cost: DRAW_COST,
      balance: getCreditsState(kunde.profile).balance,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// ─── POST: einen Zug machen ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession();
  const guard = await requireFeature(session, "chartsAnalytics");
  if (!guard.ok) return guard.response;

  const lang = langFrom(req);

  const DRAW_COST = await getCreditCost("CHARTS_DRAW");

  let all: Produkt[];
  try {
    all = (await getAllProdukte()).filter((p) => p.id);
  } catch (err) {
    console.error("[charts/draw] POST getAllProdukte failed:", err);
    return NextResponse.json({ error: "Produkte konnten nicht geladen werden." }, { status: 500 });
  }
  const totalCount = all.length;
  if (totalCount === 0) {
    return NextResponse.json({ error: "Aktuell sind keine Produkte verfügbar." }, { status: 404 });
  }

  // Admin-Test: kostenloser Zufallszug ohne Historie/Abzug.
  if (session.isAdmin || !session.lizenzschluessel) {
    const pick = all[Math.floor(Math.random() * all.length)];
    return NextResponse.json(
      {
        ok: true,
        produkt: await localizeObject(project(pick), lang),
        creditsRemaining: undefined,
        drawnCount: 0,
        totalCount,
        remainingCount: totalCount,
        cost: 0,
        admin: true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const kunde = await findKundeByKey(session.lizenzschluessel);
  if (!kunde) {
    return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
  }
  const profile = kunde.profile;

  // 1) Genug Credits?
  const credits = getCreditsState(profile);
  if (credits.balance < DRAW_COST) {
    return NextResponse.json(
      {
        error: `Nicht genug Credits — ein Zug kostet ${DRAW_COST}. Du hast ${credits.balance}.`,
        creditsRemaining: credits.balance,
      },
      { status: 402 },
    );
  }

  // 2) Noch nicht gezogene Produkte bestimmen.
  const drawnIds = Array.isArray(profile.drawnProducts) ? profile.drawnProducts : [];
  const drawnSet = new Set(drawnIds);
  const available = all.filter((p) => !drawnSet.has(p.id));
  if (available.length === 0) {
    // Der Kunde wollte ziehen, hat aber bereits ALLE Produkte. Admin
    // EINMAL pro Erschöpfungs-Episode benachrichtigen (Debounce über
    // drawnAllNotifiedAt → kein Mail-Spam bei wiederholten Klicks).
    if (!profile.drawnAllNotifiedAt) {
      try {
        await updateKundeProfile(kunde.rowIndex, {
          ...profile,
          drawnAllNotifiedAt: new Date().toISOString(),
        });
        const { sendAdminAllDrawnAlert } = await import("@/lib/email");
        await sendAdminAllDrawnAlert({
          customerName:
            profile?.legal_data?.firmenname ||
            profile?.legal_data?.inhaber ||
            kunde.kundenEmail ||
            kunde.lizenzschluessel,
          customerEmail: kunde.kundenEmail,
          customerKey: kunde.lizenzschluessel,
          totalProducts: totalCount,
        });
      } catch (e) {
        console.warn("[charts/draw] all-drawn alert failed:", e);
      }
    }
    return NextResponse.json(
      {
        error: "Das ist aktuell leider nicht möglich, schau später wieder vorbei.",
        allDrawn: true,
        drawnCount: drawnIds.length,
        totalCount,
        remainingCount: 0,
      },
      { status: 409 },
    );
  }

  // 3) Zufällig EINS ziehen.
  const pick = available[Math.floor(Math.random() * available.length)];

  // 4) Credits abziehen UND Zug in EINEM Profil-Write speichern.
  //    deductCredits schreibt `{ ...profile, credits }`, also nimmt es
  //    unsere drawnProducts-Erweiterung mit. Schlägt der Abzug fehl
  //    (z.B. Race auf den Saldo), wird NICHTS geschrieben → kein Zug
  //    verbraucht.
  // drawnAllNotifiedAt zurücksetzen: sobald wieder ein Zug klappt (also
  // neue Produkte da sind), darf eine spätere Erschöpfung erneut mailen.
  const updatedProfile = {
    ...profile,
    drawnProducts: [...drawnIds, pick.id],
    drawnAllNotifiedAt: undefined,
  };
  let creditsRemaining: number;
  try {
    const result = await deductCredits(kunde.rowIndex, updatedProfile, DRAW_COST, "charts-draw");
    if (!result.success) {
      return NextResponse.json(
        {
          error: `Nicht genug Credits — ein Zug kostet ${DRAW_COST}.`,
          creditsRemaining: result.remaining,
        },
        { status: 402 },
      );
    }
    creditsRemaining = result.remaining;
  } catch (err) {
    console.error("[charts/draw] deduct failed:", err);
    return NextResponse.json({ error: "Zug konnte nicht gespeichert werden." }, { status: 500 });
  }

  const newDrawnCount = drawnIds.length + 1;
  return NextResponse.json(
    {
      ok: true,
      produkt: await localizeObject(project(pick), lang),
      creditsRemaining,
      drawnCount: newDrawnCount,
      totalCount,
      remainingCount: totalCount - newDrawnCount,
      cost: DRAW_COST,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
