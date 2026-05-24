// ─── /api/products/vote ──────────────────────────────────────
// User stimmt mit Pfeil hoch/runter ab. Pro User + Produkt nur eine
// Stimme. Erneutes Klicken desselben Pfeils = Stimme zuruecknehmen.
// Wechsel von up auf down (oder umgekehrt) = vorherige Stimme weg,
// neue Stimme zaehlt.
//
// Body: { produktId: string, direction: "up" | "down" }
// Response: { ups, downs, manualBoost, score, userVote: "up"|"down"|null }

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  findKundeByKey,
  getAllProdukte,
  updateProduktExtra,
  updateKundeProfile,
  type ProduktVotes,
} from "@/lib/sheets";

export const dynamic = "force-dynamic";

function score(v: ProduktVotes | undefined): number {
  const ups = v?.ups ?? 0;
  const downs = v?.downs ?? 0;
  const boost = v?.manualBoost ?? 0;
  return ups - downs + boost;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || session.isAdmin) {
    return NextResponse.json(
      { error: "Nicht autorisiert — als User einloggen." },
      { status: 401 },
    );
  }
  if (!session.lizenzschluessel) {
    return NextResponse.json({ error: "Keine Sitzung." }, { status: 401 });
  }

  let produktId = "";
  let direction: "up" | "down" = "up";
  try {
    const body = await req.json();
    produktId = String(body?.produktId || "").trim();
    if (body?.direction === "down") direction = "down";
    else if (body?.direction === "up") direction = "up";
    else return NextResponse.json({ error: "Ungueltige direction (erwartet up|down)." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Body unleserlich." }, { status: 400 });
  }
  if (!produktId) {
    return NextResponse.json({ error: "produktId fehlt." }, { status: 400 });
  }

  try {
    const kunde = await findKundeByKey(session.lizenzschluessel);
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden." }, { status: 404 });
    }

    const all = await getAllProdukte();
    const prod = all.find((p) => p.id === produktId);
    if (!prod) {
      return NextResponse.json({ error: "Produkt nicht gefunden." }, { status: 404 });
    }

    const prevVotedMap = { ...(kunde.profile.votedProducts || {}) };
    const prevVote = prevVotedMap[produktId];
    const currentVotes: ProduktVotes = prod.extra?.votes || { ups: 0, downs: 0 };
    let ups = currentVotes.ups ?? 0;
    let downs = currentVotes.downs ?? 0;

    // Toggle: gleiche Richtung nochmal -> Stimme zuruecknehmen.
    if (prevVote === direction) {
      if (direction === "up") ups = Math.max(0, ups - 1);
      else downs = Math.max(0, downs - 1);
      delete prevVotedMap[produktId];
    } else {
      // Wechsel oder neue Stimme.
      if (prevVote === "up") ups = Math.max(0, ups - 1);
      else if (prevVote === "down") downs = Math.max(0, downs - 1);
      if (direction === "up") ups += 1;
      else downs += 1;
      prevVotedMap[produktId] = direction;
    }

    const nextVotes: ProduktVotes = {
      ups,
      downs,
      manualBoost: currentVotes.manualBoost,
    };
    const nextExtra = { ...prod.extra, votes: nextVotes };

    // Beide Schreibvorgaenge parallel
    await Promise.all([
      updateProduktExtra(prod.rowIndex, nextExtra),
      updateKundeProfile(kunde.rowIndex, {
        ...kunde.profile,
        votedProducts: prevVotedMap,
      }),
    ]);

    return NextResponse.json({
      ups,
      downs,
      manualBoost: currentVotes.manualBoost ?? 0,
      score: score(nextVotes),
      userVote: prevVotedMap[produktId] || null,
    });
  } catch (err) {
    console.error("[vote] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Vote fehlgeschlagen." },
      { status: 500 },
    );
  }
}
