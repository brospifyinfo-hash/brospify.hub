// ─── Eigene Produkte (Theme-Editor) ─────────────────────────────────
// Nutzer sind nicht mehr an den Produkt-Katalog gebunden: ein "eigenes
// Produkt" (alle Felder optional) lebt im Kunden-Profil (customProducts)
// bzw. für Admins im Settings-Tab. `resolveEditorProduct` ist der EINE
// Resolver für alle Theme-Routen — Katalog-Produkt oder Custom-Produkt,
// inklusive Besitz-Prüfung und themeCopy-Persistenz am richtigen Ort.
// Server-only (importiert sheets).

import {
  getAllProdukte,
  findKundeByKey,
  updateKundeProfile,
  getAdminSetting,
  setAdminSetting,
  type Produkt,
  type CustomProduct,
} from "@/lib/sheets";
import type { SessionData } from "@/lib/session";

export const CUSTOM_PRODUCT_PREFIX = "cust_";
/** Cap pro Account — das Profil-JSON teilt sich EINE 50k-Sheet-Zelle. */
export const CUSTOM_PRODUCT_MAX = 20;
const ADMIN_SETTINGS_KEY = "adminCustomProducts";

// Google Sheets lehnt Zellen > 50.000 Zeichen ab — dann schlagen ALLE
// Profil-Writes fehl (auch Credit-Abzüge!). Deshalb hartes Budget mit
// Sicherheitsabstand + erkennbarer Fehler für die Route (→ 400 statt 500).
const PROFILE_BUDGET = 45_000;
export const PROFILE_FULL_ERROR = "PROFILE_FULL";
export function isProfileFullError(err: unknown): boolean {
  return err instanceof Error && err.message === PROFILE_FULL_ERROR;
}
/** KI-Texte pro Key deckeln, bevor sie ins Profil/Settings wandern. */
function capThemeCopy(copy: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(copy)) {
    if (typeof v === "string") out[k.slice(0, 60)] = v.slice(0, 600);
  }
  return out;
}

export function isCustomProductId(id: string | undefined | null): boolean {
  return typeof id === "string" && id.startsWith(CUSTOM_PRODUCT_PREFIX);
}

export function newCustomProductId(): string {
  return `${CUSTOM_PRODUCT_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const httpUrl = (v: unknown): string => {
  const s = str(v, 600);
  return /^https?:\/\//i.test(s) ? s : "";
};

/** Validiert/kürzt Nutzereingaben zu einem CustomProduct (alles optional). */
export function sanitizeCustomProduct(input: Record<string, unknown>, id: string): CustomProduct {
  const images = Array.isArray(input.images)
    ? (input.images as unknown[]).map((u) => httpUrl(u)).filter(Boolean).slice(0, 5)
    : undefined;
  const cp: CustomProduct = {
    id,
    titel: str(input.titel, 140) || undefined,
    bildUrl: httpUrl(input.bildUrl) || undefined,
    images: images?.length ? images : undefined,
    preis: str(input.preis, 40) || undefined,
    beschreibung: str(input.beschreibung, 2000) || undefined,
  };
  return cp;
}

/** Custom-Produkt in die Produkt-Form der Theme-Pipeline heben. */
export function customToProdukt(cp: CustomProduct): Produkt {
  return {
    rowIndex: -1,
    id: cp.id,
    sku: "",
    monat: "",
    titel: cp.titel?.trim() || "Dein Produkt",
    bildUrl: cp.bildUrl || "",
    beschreibung: cp.beschreibung || "",
    preis: cp.preis || "",
    aliExpressLink: "",
    extra: {
      images: cp.images,
      themeCopy: cp.themeCopy,
    },
  };
}

/** Eigene Produkte des eingeloggten Nutzers laden (Admin: Settings-Tab). */
export async function listCustomProducts(
  session: SessionData,
  preloadedKunde?: Awaited<ReturnType<typeof findKundeByKey>>,
): Promise<CustomProduct[]> {
  if (session.isAdmin) {
    try {
      const raw = await getAdminSetting(ADMIN_SETTINGS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as CustomProduct[]) : [];
    } catch {
      return [];
    }
  }
  if (!session.lizenzschluessel) return [];
  const kunde = preloadedKunde !== undefined ? preloadedKunde : await findKundeByKey(session.lizenzschluessel);
  return Array.isArray(kunde?.profile?.customProducts) ? kunde!.profile.customProducts! : [];
}

/** Eigene Produkte des Nutzers speichern (Admin: Settings-Tab).
 *  Wirft PROFILE_FULL_ERROR, wenn das Ziel-JSON das Zellen-Budget sprengt. */
export async function saveCustomProducts(
  session: SessionData,
  list: CustomProduct[],
  preloadedKunde?: Awaited<ReturnType<typeof findKundeByKey>>,
): Promise<void> {
  if (session.isAdmin) {
    const json = JSON.stringify(list);
    if (json.length > PROFILE_BUDGET) throw new Error(PROFILE_FULL_ERROR);
    await setAdminSetting(ADMIN_SETTINGS_KEY, json);
    return;
  }
  if (!session.lizenzschluessel) throw new Error("Kein Kundenkonto.");
  const kunde = preloadedKunde !== undefined ? preloadedKunde : await findKundeByKey(session.lizenzschluessel);
  if (!kunde) throw new Error("Kunde nicht gefunden.");
  const nextProfile = { ...kunde.profile, customProducts: list };
  if (JSON.stringify(nextProfile).length > PROFILE_BUDGET) throw new Error(PROFILE_FULL_ERROR);
  kunde.profile.customProducts = list;
  await updateKundeProfile(kunde.rowIndex, kunde.profile);
}

export interface ResolvedProduct {
  produkt: Produkt;
  isCustom: boolean;
  /** Geladener Kunde (nur non-admin; für Credits/Codes weiterverwendbar). */
  kunde: Awaited<ReturnType<typeof findKundeByKey>>;
  /** Darf der eingeloggte Nutzer dieses Produkt im Editor verwenden? */
  owned: boolean;
  /** Gibt es einen echten Titel als Basis für die KI-Text-Erstellung?
   *  (Eigene Produkte ohne Titel → keine Generierung, keine Kosten.) */
  hasTitle: boolean;
  /** Persistiert generierte KI-Texte am richtigen Ort (Katalog: Produkt-Extra,
   *  Custom: Profil/Settings). Nie fatal — Fehler nur loggen. */
  saveThemeCopy: (copy: Record<string, string>) => Promise<void>;
}

/**
 * Zentraler Produkt-Resolver für die Theme-Routen: Katalog-Produkt
 * (gezogen/Admin) ODER eigenes Produkt (aus dem eigenen Bestand).
 * Gibt null zurück, wenn es das Produkt nirgends gibt.
 */
export async function resolveEditorProduct(
  session: SessionData,
  productId: string,
): Promise<ResolvedProduct | null> {
  const kunde = !session.isAdmin && session.lizenzschluessel ? await findKundeByKey(session.lizenzschluessel) : null;

  if (isCustomProductId(productId)) {
    const list = await listCustomProducts(session, kunde);
    const cp = list.find((p) => p.id === productId);
    if (!cp) return null;
    return {
      produkt: customToProdukt(cp),
      isCustom: true,
      kunde,
      // Besitz = das Produkt liegt im EIGENEN Bestand (Liste oben).
      owned: true,
      hasTitle: !!cp.titel?.trim(),
      saveThemeCopy: async (copy) => {
        try {
          const capped = capThemeCopy(copy);
          const fresh = await listCustomProducts(session, kunde);
          const next = fresh.map((p) => (p.id === productId ? { ...p, themeCopy: capped } : p));
          // Cache-Write ist optional — sprengt er das Budget, wird er einfach
          // übersprungen (die Texte werden für DIESEN Build trotzdem genutzt).
          await saveCustomProducts(session, next, kunde);
        } catch (e) {
          console.warn("[custom-products] themeCopy-Persist fehlgeschlagen:", e);
        }
      },
    };
  }

  let produkt: Produkt | undefined;
  produkt = (await getAllProdukte()).find((p) => p.id === productId);
  if (!produkt) return null;
  const drawn = Array.isArray(kunde?.profile?.drawnProducts) ? kunde!.profile.drawnProducts! : [];
  return {
    produkt,
    isCustom: false,
    kunde,
    owned: session.isAdmin || drawn.includes(produkt.id),
    hasTitle: true,
    saveThemeCopy: async (copy) => {
      try {
        const { updateProduktExtra } = await import("@/lib/sheets");
        await updateProduktExtra(produkt!.rowIndex, { ...produkt!.extra, themeCopy: copy });
      } catch (e) {
        console.warn("[custom-products] themeCopy cache write failed:", e);
      }
    },
  };
}
