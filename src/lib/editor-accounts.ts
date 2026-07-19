// ─── Editor-Konten: Selbst-Registrierung der Standalone-Editor-Website ──
// Die Editor-Website (/start → /editor) lässt Nutzer sich mit Google,
// Shopify oder E-Mail-Link anmelden. Unbekannte Nutzer bekommen beim
// ersten Login automatisch ein GRATIS-Konto:
//   - eigener Lizenzschlüssel (normales Kunden-Row in der Kunden-Tabelle)
//   - sku "editor-free" — bewusst KEIN Abo-SKU (SKU_TO_TIER kennt es nicht,
//     das Konto zählt also nirgends als aktives Abo)
//   - EDITOR_STARTER_CREDITS statt der 1500 Hub-Starter-Credits
//     (starterGranted wird direkt auf true gesetzt, damit weder Login-
//     Grant noch der tägliche Backfill-Cron die 1500 nachschieben)
//   - noRecurringGrant: true — kein 28-Tage-Top-up
//   - hasCompletedOnboarding: true — Editor-Nutzer durchlaufen NICHT das
//     Hub-Onboarding
// Bestehende Kunden (egal wie entstanden) werden einfach wiedererkannt
// und eingeloggt — es entsteht nie ein Duplikat.

import {
  findKundeByGoogleEmail,
  findKundeByShopDomain,
  findKundeByKey,
  findKundeByUsername,
  generateLicenseKey,
  upsertKundeByKey,
  type Kunde,
  type KundeProfile,
} from "@/lib/sheets";
import { isActiveSubFromKunde, resolvePlan } from "@/lib/tiers-shared";
import { EDITOR_STARTER_CREDITS } from "@/lib/credit-costs";

export type EditorAuthProvider = "google" | "shopify" | "email";

// Ein Konto gilt als "geschützt", wenn es Admin-Rechte hat ODER ein
// aktives Abo trägt. Solche Konten dürfen NIEMALS über den schwächeren
// Editor-Selbstregistrierungs-Weg (E-Mail-Link, Shopify-shop.email)
// eingeloggt/übernommen werden — nur über echte OAuth-Verifikation
// (Google) oder den Lizenzschlüssel-Login des Hubs.
export function isProtectedAccount(k: Kunde): boolean {
  if (k.profile.role === "admin") return true;
  // JEDES Plan-Signal schützt — auch gekündigt/abgelaufen/blockiert.
  // Ein zahlender Kunde, dessen Abo gerade ausgelaufen ist, darf nicht
  // plötzlich über den schwachen E-Mail-/Shopify-Weg übernehmbar sein.
  return resolvePlan({ status: k.status, sku: k.sku, profile: k.profile }).baseTier !== null;
}

export interface EditorAccountInput {
  provider: EditorAuthProvider;
  /** Verifizierte E-Mail des Nutzers (Google/E-Mail-Link) bzw. des Shops. */
  email?: string;
  /** *.myshopify.com-Domain (nur Shopify-Login). */
  shopDomain?: string;
  /** Offline-Access-Token aus dem Shopify-OAuth (nur Shopify-Login). */
  shopifyToken?: string;
  /** Anzeigename (Google-Profil / Shop-Name). */
  displayName?: string;
  /** Nur bei E-Mail-Registrierung mit Passwort: gewählter (validierter,
   *  kleingeschriebener) Username. Wird nur auf NEUE oder bislang
   *  username-lose Konten gesetzt, nie überschrieben. */
  username?: string;
  /** Nur bei E-Mail-Registrierung mit Passwort: FERTIGER scrypt-Hash
   *  (Klartext-Passwort erreicht diese Schicht nie). Wird nur auf NEUE
   *  oder passwortlose Konten gesetzt, nie über ein bestehendes Passwort. */
  passwordHash?: string;
}

export type EditorAccountResult =
  | { ok: true; kunde: Kunde; created: boolean }
  | { ok: false; error: "blocked" | "invalid" | "server" | "use_primary_login" | "username_taken" };

/** Bestandskonto wiederfinden — bewusst PROVIDER-abhängig, weil die
 *  Login-Wege unterschiedlich stark beweisen, wem ein Konto gehört:
 *   - shopify: Der OAuth-Flow beweist nur die Kontrolle über GENAU DIESE
 *     *.myshopify.com-Domain. Die vom Shop gelieferte `shop.email` ist
 *     fremd-gesteuert und darf NIE ein Hub-Konto matchen → nur Domain.
 *   - google/email: verifizierte E-Mail (Google-OAuth bzw. Magic-Link-
 *     Inbox-Besitz) → Match über kundenEmail ODER linkedGoogleEmail. */
async function findExisting(input: EditorAccountInput): Promise<Kunde | null> {
  if (input.provider === "shopify") {
    return input.shopDomain ? await findKundeByShopDomain(input.shopDomain) : null;
  }
  return input.email ? await findKundeByGoogleEmail(input.email) : null;
}

export async function findOrCreateEditorKunde(
  input: EditorAccountInput,
): Promise<EditorAccountResult> {
  const email = (input.email || "").trim().toLowerCase();
  const shopDomain = (input.shopDomain || "").trim().toLowerCase();
  if (!email && !shopDomain) return { ok: false, error: "invalid" };
  const nowIso = new Date().toISOString();

  try {
    const existing = await findExisting({ ...input, email, shopDomain });
    if (existing) {
      if (existing.profile.blocked === true) return { ok: false, error: "blocked" };

      // Selbst-Registrierung darf ein geschütztes Konto (Admin / aktives
      // Abo) NIE über einen schwächeren Weg übernehmen. Google ist echte
      // OAuth-Verifikation der E-Mail (identisch zum Hub-Login) und darf
      // in jedes Konto; E-Mail-Link und Shopify beweisen keine Hub-Konto-
      // Inhaberschaft → auf geschützte Konten abweisen (Nutzer soll den
      // regulären Hub-Login / Lizenzschlüssel verwenden).
      if (input.provider !== "google" && isProtectedAccount(existing)) {
        return { ok: false, error: "use_primary_login" };
      }

      // Registrierung mit Passwort auf ein passwortloses Bestandskonto:
      // der Code-Verify hat die E-Mail-Inhaberschaft bewiesen, also darf
      // hier ein Passwort (+ Username) NACHGETRAGEN werden — aber NIE ein
      // vorhandenes Passwort überschrieben (dann bloß einloggen).
      if (input.passwordHash && !existing.profile.passwordHash) {
        const patch: Partial<KundeProfile> = { passwordHash: input.passwordHash, passwordSetAt: nowIso };
        if (input.username && !existing.profile.username) {
          const taken = await findKundeByUsername(input.username);
          if (taken && taken.lizenzschluessel !== existing.lizenzschluessel) {
            return { ok: false, error: "username_taken" };
          }
          patch.username = input.username;
        }
        await upsertKundeByKey({ lizenzschluessel: existing.lizenzschluessel, profilePatch: patch });
        const fresh = await findKundeByKey(existing.lizenzschluessel);
        if (fresh) return { ok: true, kunde: fresh, created: false };
      }

      // Shopify-Login auf ein Bestandskonto: frisch erhaltene Shop-Daten
      // nachtragen, falls sie fehlen (Spalten A/D) — niemals vorhandene
      // Werte überschreiben (könnte eine aktive Hub-Verbindung kappen).
      if (input.provider === "shopify" && shopDomain && input.shopifyToken) {
        const patch: Parameters<typeof upsertKundeByKey>[0] = {
          lizenzschluessel: existing.lizenzschluessel,
        };
        let dirty = false;
        if (!existing.shopDomain) { patch.shopDomain = shopDomain; dirty = true; }
        if (!existing.shopifyToken) { patch.shopifyToken = input.shopifyToken; dirty = true; }
        if (dirty) {
          await upsertKundeByKey(patch);
          const fresh = await findKundeByKey(existing.lizenzschluessel);
          if (fresh) return { ok: true, kunde: fresh, created: false };
        }
      }
      return { ok: true, kunde: existing, created: false };
    }

    // ── Neues Gratis-Konto anlegen ──────────────────────────────────
    // Bei Passwort-Registrierung zuerst Username-Eindeutigkeit prüfen.
    if (input.username) {
      const taken = await findKundeByUsername(input.username);
      if (taken) return { ok: false, error: "username_taken" };
    }

    let key = generateLicenseKey();
    for (let i = 0; i < 3 && (await findKundeByKey(key)); i += 1) {
      key = generateLicenseKey();
    }

    const profilePatch: Partial<KundeProfile> = {
      editorFree: true,
      noRecurringGrant: true,
      hasCompletedOnboarding: true,
      role: "user",
      signupAt: nowIso,
      displayName: (input.displayName || "").trim() || undefined,
      linkedGoogleEmail: input.provider === "google" && email ? email : undefined,
      username: input.username || undefined,
      passwordHash: input.passwordHash || undefined,
      passwordSetAt: input.passwordHash ? nowIso : undefined,
      // Anker + Zähler gesetzt, damit ensureStarterGrant/-RecurringGrant
      // nichts "nachziehen"; starterGranted=true blockt Login-Grant UND
      // den täglichen Backfill-Cron.
      creditsStartedAt: nowIso,
      recurringPeriodsGranted: 0,
      credits: {
        balance: EDITOR_STARTER_CREDITS,
        totalPurchased: EDITOR_STARTER_CREDITS,
        totalUsed: 0,
        fulfilledOrders: [],
        redeemedCodes: {},
        starterGranted: true,
        log: [
          {
            ts: nowIso,
            type: "starter",
            delta: EDITOR_STARTER_CREDITS,
            balanceAfter: EDITOR_STARTER_CREDITS,
            reason: `Editor-Gratis-Start (${input.provider})`,
          },
        ],
        lastUpdated: nowIso,
      },
    };

    await upsertKundeByKey({
      lizenzschluessel: key,
      status: "aktiv",
      kundenEmail: email || undefined,
      shopDomain: shopDomain || undefined,
      shopifyToken: input.provider === "shopify" ? input.shopifyToken : undefined,
      // Marker statt Bestellnummer — Editor-Konten entstehen ohne Kauf.
      // Mit Key-Suffix eindeutig, damit findKundeByOrder nie mehrdeutig wird.
      bestellnummer: `EDITOR-${input.provider.toUpperCase()}-${key}`,
      sku: "editor-free",
      profilePatch,
    });

    const created = await findKundeByKey(key);
    if (!created) return { ok: false, error: "server" };
    return { ok: true, kunde: created, created: true };
  } catch (err) {
    console.error("[editor-accounts] findOrCreate failed:", err);
    return { ok: false, error: "server" };
  }
}
