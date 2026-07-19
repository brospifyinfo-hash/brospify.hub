// ─── /api/admin/users/tier ───────────────────────────────────────
// Manual tier override. Body: { key, tier, cancel?, remove? }
// - tier:   one of TIER_KEYS to set/upgrade/downgrade. Reaktiviert den
//           Account vollständig (Kündigungs-Marker weg, abgelaufene
//           Laufzeit weg, Status-Spalte zurück auf "aktiv").
// - cancel:true → soft-cancel (sets tierCanceledAt; Zugang ist damit
//           sofort zu, weil resolvePlan den Marker prüft)
// - remove:true → Plan KOMPLETT entfernen: profile.tier + SKU-Spalte
//           leeren, damit auch der SKU-Fallback nicht mehr greift
//           („Kein Plan" im Admin war vorher wirkungslos).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  cancelUserTier,
  findKundeByKey,
  getKundeProfile,
  logSystemEvent,
  removeUserTier,
  setUserTier,
  updateKundeField,
  updateKundeProfile,
} from "@/lib/sheets";
import { TIER_KEYS, type TierKey } from "@/lib/tiers";
import { isInactiveStatus } from "@/lib/tiers-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTierKey(v: unknown): v is TierKey {
  return typeof v === "string" && (TIER_KEYS as readonly string[]).includes(v);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.isAdmin) {
    return NextResponse.json({ error: "Nur für Admins." }, { status: 403 });
  }

  let body: { key?: string; tier?: string; cancel?: boolean; remove?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const key = String(body.key || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key fehlt." }, { status: 400 });
  }

  const kunde = await findKundeByKey(key);
  if (!kunde) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const profile = await getKundeProfile(kunde.rowIndex);
  const actor = session.googleEmail || session.lizenzschluessel || "admin";

  if (body.remove) {
    await removeUserTier(kunde.rowIndex, profile, kunde.sku || undefined);
    // SKU-Spalte leeren — sonst würde resolvePlan über den SKU-Fallback
    // (z. B. "abo" → pro) den Plan sofort wieder herleiten.
    if (kunde.sku) {
      try {
        await updateKundeField(kunde.rowIndex, "I", "");
      } catch (e) {
        console.error("[admin/users/tier] SKU-Spalte leeren fehlgeschlagen:", e);
      }
    }
    void logSystemEvent({
      level: "audit",
      actor,
      action: "tier.remove",
      target: kunde.lizenzschluessel,
      details: { tier: profile.tier || "", sku: kunde.sku || "", email: kunde.kundenEmail },
    });
    return NextResponse.json({ success: true, removed: true });
  }

  if (body.cancel) {
    await cancelUserTier(kunde.rowIndex, profile);
    void logSystemEvent({
      level: "audit",
      actor,
      action: "tier.cancel",
      target: kunde.lizenzschluessel,
      details: { tier: profile.tier || "" },
    });
    return NextResponse.json({ success: true, canceled: true });
  }

  if (!isTierKey(body.tier)) {
    return NextResponse.json(
      { error: `tier muss einer von: ${TIER_KEYS.join(", ")}` },
      { status: 400 },
    );
  }

  const prev = profile.tier || "";
  const granted = await setUserTier(kunde.rowIndex, profile, body.tier);

  // Plan-Grant = volle Freischaltung: auch eine Konto-Sperre aufheben,
  // sonst blockt resolvePlan (blocked wird ZUERST geprüft) und der Admin
  // sieht einen Erfolg, der nirgends wirkt.
  if (granted.blocked === true) {
    try {
      await updateKundeProfile(kunde.rowIndex, { ...granted, blocked: undefined, blockedAt: undefined });
    } catch (e) {
      console.error("[admin/users/tier] Entsperren fehlgeschlagen:", e);
    }
  }

  // Vollständige Reaktivierung: eine Status-Spalte mit Kill-Word
  // ("gekündigt"/"abgelaufen"/…) würde den frisch gesetzten Plan über
  // resolvePlan UND die Theme-Lizenz weiter sperren.
  if (isInactiveStatus(kunde.status)) {
    try {
      await updateKundeField(kunde.rowIndex, "C", "aktiv");
    } catch (e) {
      console.error("[admin/users/tier] Status-Reaktivierung fehlgeschlagen:", e);
    }
  }

  void logSystemEvent({
    level: "audit",
    actor,
    action: "tier.set",
    target: kunde.lizenzschluessel,
    details: { prev, next: body.tier, email: kunde.kundenEmail, statusRevived: isInactiveStatus(kunde.status) },
  });

  return NextResponse.json({ success: true, tier: body.tier, prev });
}
