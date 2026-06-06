#!/usr/bin/env node
/**
 * ─── Brospify Hub → Shopify One-Click Setup ───────────────────────
 * Macht die komplette Hub-Integration ohne dass du in Shopify klicken
 * musst (außer 1x den Custom-App-Token holen).
 *
 * Was passiert hier:
 *   1.  Theme-Zip uploaden (Themes API)
 *   2.  Warten bis "processing" durch ist
 *   3.  22 Pages anlegen mit den Hub-Templates (Pages REST)
 *   4.  Customer-Metafield-Definition für brospify.license_key
 *       (GraphQL — REST kennt definitions nicht)
 *   5.  Hauptmenü-Eintrag „Mein Hub" hinzufügen (GraphQL menu)
 *
 * Verwendung:
 *   $env:SHOPIFY_SHOP_DOMAIN="brospify.com"          # oder *.myshopify.com
 *   $env:SHOPIFY_ADMIN_TOKEN="shpat_…"
 *   node setup-shopify.mjs
 *
 * Optional:
 *   --skip-theme          überspringt Theme-Upload (falls schon hochgeladen)
 *   --skip-pages          überspringt Pages-Anlage
 *   --skip-menu           überspringt Menü-Eintrag
 *   --publish             publiziert das Theme direkt (sonst nur Library)
 *   --theme-zip=PFAD      explizite Zip-Datei (Default: brospify-theme-2.20.zip)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────
const SHOP = (process.env.SHOPIFY_SHOP_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || "";
const API_VERSION = "2024-10";

const args = new Set(process.argv.slice(2));
const SKIP_THEME = args.has("--skip-theme");
const SKIP_PAGES = args.has("--skip-pages");
const SKIP_MENU = args.has("--skip-menu");
const PUBLISH = args.has("--publish");

const themeZipArg = process.argv.find((a) => a.startsWith("--theme-zip="));
const DEFAULT_ZIP = "C:\\Users\\preis\\Documents\\Geschäfte\\brospify arbeitsplatz\\brospify themes\\website (brospify.com)\\brospify-theme-2.20.zip";
const THEME_ZIP = themeZipArg ? themeZipArg.split("=")[1] : DEFAULT_ZIP;

// ─── Sanity-Checks ──────────────────────────────────────────────
function die(msg) {
  console.error("\n❌  " + msg + "\n");
  process.exit(1);
}
if (!SHOP) die("ENV SHOPIFY_SHOP_DOMAIN nicht gesetzt. Beispiel: brospify-test.myshopify.com");
if (!TOKEN) die("ENV SHOPIFY_ADMIN_TOKEN nicht gesetzt. Custom-App-Token holen → siehe README.");
if (!TOKEN.startsWith("shpat_")) die("Token sieht falsch aus — Custom-App-Tokens starten mit `shpat_`.");

const SHOP_URL = SHOP.includes(".myshopify.com") ? SHOP : `${SHOP}.myshopify.com`;
const BASE = `https://${SHOP_URL}/admin/api/${API_VERSION}`;

console.log("─".repeat(60));
console.log("  Brospify Hub → Shopify Setup");
console.log("─".repeat(60));
console.log("  Shop:     " + SHOP_URL);
console.log("  Theme:    " + (SKIP_THEME ? "übersprungen" : THEME_ZIP));
console.log("  Pages:    " + (SKIP_PAGES ? "übersprungen" : "22 Hub-Pages"));
console.log("  Menü:     " + (SKIP_MENU ? "übersprungen" : '"Mein Hub" wird ergänzt'));
console.log("  Publish:  " + (PUBLISH ? "ja (Live)" : "nein (Library)"));
console.log("─".repeat(60));

// ─── HTTP-Helpers ───────────────────────────────────────────────
async function rest(method, p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) {
    const e = new Error(`Shopify ${method} ${p} → ${r.status}: ${JSON.stringify(data)}`);
    e.status = r.status;
    e.data = data;
    throw e;
  }
  return data;
}

async function gql(query, variables = {}) {
  const r = await fetch(`https://${SHOP_URL}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await r.json();
  if (data.errors) throw new Error("GraphQL errors: " + JSON.stringify(data.errors));
  return data.data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Hub-Pages-Mapping ──────────────────────────────────────────
const HUB_PAGES = [
  { handle: "hub",              title: "Mein Hub",            suffix: "hub" },
  { handle: "hub-charts",       title: "Charts",              suffix: "hub-charts" },
  { handle: "hub-blog",         title: "Blog-Writer",         suffix: "hub-blog" },
  { handle: "hub-ai-studio",    title: "AI Studio",           suffix: "hub-ai-studio" },
  { handle: "hub-credits",      title: "Meine Credits",       suffix: "hub-credits" },
  { handle: "hub-tiers",        title: "Tarife",              suffix: "hub-tiers" },
  { handle: "hub-account",      title: "Mein Account",        suffix: "hub-account" },
  { handle: "hub-setup",        title: "Shop-Setup",          suffix: "hub-setup" },
  { handle: "hub-bg-remover",   title: "Background Remover",  suffix: "hub-bg-remover" },
  { handle: "hub-upscaler",     title: "HD-Upscaler",         suffix: "hub-upscaler" },
  { handle: "hub-emails",       title: "E-Mail-Templates",    suffix: "hub-emails" },
  { handle: "hub-code-blocks",  title: "Code-Blöcke",         suffix: "hub-code-blocks" },
  { handle: "hub-library",      title: "Library",             suffix: "hub-library" },
  { handle: "hub-coaching",     title: "Coaching",            suffix: "hub-coaching" },
  { handle: "hub-themes",       title: "Brospify Themes",     suffix: "hub-themes" },
  { handle: "hub-ai-support",   title: "AI Support",          suffix: "hub-ai-support" },
  { handle: "hub-seo",          title: "SEO-Audit",           suffix: "hub-seo" },
  { handle: "hub-chats",        title: "Chats",               suffix: "hub-chats" },
  { handle: "hub-profile",      title: "Profil",              suffix: "hub-profile" },
  { handle: "hub-settings",     title: "Hub-Einstellungen",   suffix: "hub-settings" },
  { handle: "hub-onboarding",   title: "Onboarding",          suffix: "hub-onboarding" },
  { handle: "hub-legal",        title: "Rechtstexte",         suffix: "hub-legal" },
];

// ─── 1) Theme upload ────────────────────────────────────────────
async function uploadTheme() {
  if (SKIP_THEME) { console.log("\n⏭  Theme-Upload übersprungen."); return null; }
  if (!fs.existsSync(THEME_ZIP)) die("Theme-Zip nicht gefunden: " + THEME_ZIP);

  console.log("\n📦  Lade Theme-Zip hoch …");

  // Shopify Themes API frisst entweder src=URL ODER attachment=base64.
  // Base64 ist sicherer (kein public hosting nötig) — aber das Zip ist
  // ~1.5 MB, kein Problem.
  const buf = fs.readFileSync(THEME_ZIP);
  const attachment = buf.toString("base64");

  const themeRes = await rest("POST", "/themes.json", {
    theme: {
      name: "Brospify Hub Integration v2.20",
      src: undefined,
      attachment,
      role: PUBLISH ? "main" : "unpublished",
    },
  });
  const themeId = themeRes.theme.id;
  console.log(`   ✓ Theme-ID ${themeId} (${themeRes.theme.name})`);

  // Warten bis "processing" → "unpublished" / "main"
  console.log("   ⏳ Warte auf Shopify-Processing …");
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    try {
      const r = await rest("GET", `/themes/${themeId}.json`);
      if (!r.theme.processing) {
        console.log(`   ✓ Theme bereit (Status: ${r.theme.role})`);
        return themeId;
      }
      process.stdout.write(".");
    } catch (e) {
      console.error("\n   ⚠  Theme-Check fehlgeschlagen:", e.message);
    }
  }
  console.warn("\n   ⚠  Theme noch in processing — fahre trotzdem mit Pages fort.");
  return themeId;
}

// ─── 2) Pages anlegen ───────────────────────────────────────────
async function createPages() {
  if (SKIP_PAGES) { console.log("\n⏭  Pages-Anlage übersprungen."); return; }

  console.log("\n📄  Lege Hub-Pages an …");

  // Existierende Pages cachen für Idempotenz
  const existing = new Map();
  let pageInfo = "/pages.json?limit=250&fields=id,handle,title,template_suffix";
  for (let page = 1; page <= 10; page++) {
    const r = await rest("GET", pageInfo);
    if (!r.pages || !r.pages.length) break;
    for (const p of r.pages) existing.set(p.handle, p);
    if (r.pages.length < 250) break;
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const def of HUB_PAGES) {
    try {
      const found = existing.get(def.handle);
      if (found) {
        // Wenn template_suffix nicht stimmt → updaten
        if (found.template_suffix !== def.suffix) {
          await rest("PUT", `/pages/${found.id}.json`, {
            page: { id: found.id, template_suffix: def.suffix },
          });
          console.log(`   ↻ ${def.handle.padEnd(20)} → template auf "${def.suffix}" gesetzt`);
          updated++;
        } else {
          console.log(`   ⏭ ${def.handle.padEnd(20)}   (existiert bereits, korrekt)`);
          skipped++;
        }
        continue;
      }
      await rest("POST", "/pages.json", {
        page: {
          title: def.title,
          handle: def.handle,
          body_html: `<!-- Brospify Hub: ${def.title}. Inhalt wird durch das Theme-Template (page.${def.suffix}) gerendert. -->`,
          template_suffix: def.suffix,
          published: true,
        },
      });
      console.log(`   ✓ ${def.handle.padEnd(20)} (${def.title})`);
      created++;
      // Sanftes Rate-Limit
      await sleep(120);
    } catch (e) {
      console.error(`   ✗ ${def.handle.padEnd(20)} → ${e.message.slice(0, 120)}`);
    }
  }
  console.log(`\n   Σ ${created} neu, ${updated} korrigiert, ${skipped} unverändert.`);
}

// ─── 3) Customer-Metafield-Definition ───────────────────────────
async function createMetafieldDefinition() {
  console.log("\n🏷  Lege Metafield-Definition customer.brospify.license_key an …");

  // GraphQL: metafieldDefinitionCreate
  try {
    const data = await gql(
      `mutation CreateLicenseMetafield($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition { id name namespace key }
          userErrors { field message code }
        }
      }`,
      {
        definition: {
          name: "Brospify Lizenzschlüssel",
          namespace: "brospify",
          key: "license_key",
          description: "Brospify-Hub-Lizenzschlüssel des Kunden. Wird vom Theme für Header-Credits-Pill, Charts, Blog-Writer und AI-Studio benutzt.",
          type: "single_line_text_field",
          ownerType: "CUSTOMER",
          access: {
            admin: "MERCHANT_READ_WRITE",
            storefront: "PUBLIC_READ",
          },
        },
      },
    );
    const res = data.metafieldDefinitionCreate;
    if (res.userErrors && res.userErrors.length) {
      const codes = res.userErrors.map((e) => e.code).join(",");
      if (codes.includes("TAKEN") || codes.includes("ALREADY_EXISTS")) {
        console.log("   ⏭ Definition existiert bereits.");
      } else {
        console.warn("   ⚠ ", JSON.stringify(res.userErrors));
      }
    } else {
      console.log(`   ✓ ${res.createdDefinition.namespace}.${res.createdDefinition.key} angelegt.`);
    }
  } catch (e) {
    console.warn("   ⚠ Metafield-Definition konnte nicht angelegt werden:", e.message.slice(0, 200));
  }
}

// ─── 4) Hauptmenü erweitern ─────────────────────────────────────
async function addToMainMenu() {
  if (SKIP_MENU) { console.log("\n⏭  Menü-Eintrag übersprungen."); return; }
  console.log("\n📋  Ergänze Hauptmenü-Eintrag „Mein Hub" …");

  try {
    const data = await gql(`{ menus(first: 20) { edges { node { id handle title items { id title url } } } } }`);
    const menus = data.menus.edges.map((e) => e.node);
    const main = menus.find((m) => m.handle === "main-menu") || menus.find((m) => /haupt|main/i.test(m.handle)) || menus[0];
    if (!main) { console.warn("   ⚠ Kein Menü gefunden."); return; }

    if (main.items.some((i) => /\/pages\/hub$/i.test(i.url))) {
      console.log("   ⏭ Eintrag existiert bereits in Menü „" + main.title + "\".");
      return;
    }

    const newItems = [
      ...main.items.map((i) => ({ title: i.title, url: i.url, type: "FRONTPAGE" })),
      { title: "Mein Hub", url: "/pages/hub", type: "HTTP" },
    ];

    // menuUpdate erwartet items mit type + url
    const upd = await gql(
      `mutation MenuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
          menu { id title }
          userErrors { field message }
        }
      }`,
      {
        id: main.id,
        title: main.title,
        handle: main.handle,
        items: main.items.map((i) => ({ title: i.title, type: "HTTP", url: i.url }))
          .concat([{ title: "Mein Hub", type: "HTTP", url: "/pages/hub" }]),
      },
    );
    if (upd.menuUpdate.userErrors && upd.menuUpdate.userErrors.length) {
      console.warn("   ⚠ MenuUpdate userErrors:", JSON.stringify(upd.menuUpdate.userErrors));
    } else {
      console.log(`   ✓ Eintrag in Menü „${main.title}" hinzugefügt.`);
    }
  } catch (e) {
    console.warn("   ⚠ Menü-Anpassung übersprungen:", e.message.slice(0, 200));
  }
}

// ─── Main ───────────────────────────────────────────────────────
(async () => {
  try {
    await uploadTheme();
    await createMetafieldDefinition();
    await createPages();
    await addToMainMenu();

    console.log("\n" + "─".repeat(60));
    console.log("✅  Setup abgeschlossen.");
    console.log("─".repeat(60));
    console.log("\nNächste Schritte:");
    if (!PUBLISH) {
      console.log("  1. Shopify-Admin → Online Store → Themes");
      console.log("     → das neue Theme „Brospify Hub Integration v2.20\" anschauen");
      console.log("     → wenn alles passt, „Publish\" klicken.");
    } else {
      console.log("  1. Theme ist bereits LIVE — direkt im Storefront öffnen.");
    }
    console.log("  2. Kunden-Lizenzschlüssel via Admin → Customers → Metafields setzen");
    console.log("     (oder per Make.com sync — bestehender Flow funktioniert).");
    console.log("  3. Hub auf Vercel: `git push origin main` damit die neuen");
    console.log("     /api/*/by-key /api/charts/public /api/blog/generate-by-key");
    console.log("     /api/ai-studio/public Endpoints live sind.\n");
  } catch (e) {
    console.error("\n❌  Setup fehlgeschlagen:");
    console.error(e.stack || e.message);
    process.exit(1);
  }
})();
