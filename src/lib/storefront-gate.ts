import "server-only";
import { findKundeByKey } from "@/lib/sheets";
import { CANCEL_STATUS, INACTIVE_STATUS } from "@/lib/tiers-shared";

// ─── Storefront-Abo-Gate (geteilt) ─────────────────────────────────
// EIN Verdikt für die öffentlichen Storefront-Endpunkte, die pro Sync-Code
// über den Design-Besitzer gaten (Asset-Serving, Buybox-Plan). Die
// Kill-Word-/Kündigungs-Logik ist identisch zu /api/license/validate und
// /api/storefront/status: Die Wortlisten kommen aus tiers-shared (einzige
// Wahrheit), das Prädikat liegt hier — nicht erneut lokal kopieren.
//
// INVARIANTE (fail-open): Ein Sheets-/Infrastruktur-Fehler darf NIE einen
// zahlenden Shop sperren. Fail-open-Verdikte tragen failOpen:true und
// dürfen von Aufrufern NICHT gecacht werden (weder Lambda-Map noch CDN
// mit langer s-maxage).

/** Besitzer, deren Designs immer offen sind (Demo/Test/Master). */
export const STOREFRONT_MASTER_OWNERS = new Set(["admin", "Hat-Jonas"]);

type Kunde = Awaited<ReturnType<typeof findKundeByKey>>;

const norm = (s: string) => (s || "").normalize("NFKC").trim().toLowerCase();

/** Abo aktiv? — blocked, harte Kill-Words, Kündigung nur mit bezahlter
 *  Restlaufzeit (subscriptionEndsAt in der Zukunft), Ablauf-Check. */
export function licenseActiveForKunde(kunde: Kunde): boolean {
  if (!kunde) return false;
  if (kunde.profile?.blocked === true) return false;
  const status = norm(kunde.status);
  if (INACTIVE_STATUS.has(status) && !CANCEL_STATUS.has(status)) return false;
  const endsAt = kunde.profile?.subscriptionEndsAt ? Date.parse(kunde.profile.subscriptionEndsAt) : NaN;
  const paidFuture = Number.isFinite(endsAt) && endsAt > Date.now();
  if (CANCEL_STATUS.has(status) && !paidFuture) return false;
  if (Number.isFinite(endsAt) && endsAt < Date.now()) return false;
  return true;
}

export interface OwnerVerdict {
  active: boolean;
  /** true = kein belastbares Verdikt (Sheets-Ausfall / Owner unbekannt) →
   *  bewusst NICHT gesperrt. Solche Verdikte nie cachen. */
  failOpen: boolean;
}

/** Verdikt für einen Design-/Plan-Besitzer (lizenzschluessel oder
 *  "admin"). Leerer Owner = Altbestand ohne Zuordnung → fail-open, damit
 *  kein zahlender Shop an einem Datenlücken-Detail hängt. */
export async function storefrontOwnerVerdict(owner: string): Promise<OwnerVerdict> {
  const clean = (owner || "").trim();
  if (!clean) return { active: true, failOpen: true };
  if (STOREFRONT_MASTER_OWNERS.has(clean)) return { active: true, failOpen: false };
  try {
    const kunde = await findKundeByKey(clean);
    return { active: licenseActiveForKunde(kunde), failOpen: false };
  } catch {
    // Sheets-Ausfall → NICHT sperren (fail-open).
    return { active: true, failOpen: true };
  }
}
