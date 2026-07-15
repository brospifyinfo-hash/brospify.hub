// ─── Kopiert die benannten Env-Keys vom Vercel-Projekt "brospify-hub"
//     ins Projekt "brospify-editor" und deployt den Editor neu. ─────────
// Läuft komplett lokal über DEINE eingeloggte Vercel-CLI. Werte werden
// nie angezeigt; die temporäre .env-Datei wird am Ende sicher gelöscht.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDITOR_DIR = "C:\\Users\\Win11 Pro\\brospify-hub-work"; // mit brospify-editor verlinkt
const KEYS = [
  "GOOGLE_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ANTHROPIC_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SHOPIFY_CLIENT_ID",
  "SHOPIFY_CLIENT_SECRET",
];

function vercel(args, opts = {}) {
  const r = spawnSync("cmd", ["/c", "vercel", ...args], {
    encoding: "utf8",
    env: { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" },
    ...opts,
  });
  return r;
}

// dotenv-Zeile parsen: KEY="wert" (mit \n-Escapes) oder KEY=wert
function parseDotenv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
    out[m[1]] = v;
  }
  return out;
}

const tmp = mkdtempSync(join(tmpdir(), "hub-env-"));
const envFile = join(tmp, ".env.hub");
let fehler = 0;

try {
  console.log("1/4  Verbinde temporär mit brospify-hub ...");
  let r = vercel(["link", "--yes", "--project", "brospify-hub"], { cwd: tmp });
  if (r.status !== 0) throw new Error("vercel link fehlgeschlagen:\n" + (r.stderr || r.stdout));

  console.log("2/4  Lese Production-Umgebung des Hubs (Werte werden NICHT angezeigt) ...");
  r = vercel(["env", "pull", envFile, "--environment=production", "--yes"], { cwd: tmp });
  if (r.status !== 0 || !existsSync(envFile)) throw new Error("vercel env pull fehlgeschlagen:\n" + (r.stderr || r.stdout));
  const hub = parseDotenv(readFileSync(envFile, "utf8"));

  console.log("3/4  Übertrage Keys nach brospify-editor ...");
  for (const key of KEYS) {
    const val = hub[key];
    if (val === undefined || val === "") {
      console.log(`   – ${key}: im Hub nicht gesetzt → übersprungen`);
      continue;
    }
    // evtl. vorhandenen Eintrag ersetzen
    vercel(["env", "rm", key, "production", "--yes"], { cwd: EDITOR_DIR });
    r = vercel(["env", "add", key, "production"], { cwd: EDITOR_DIR, input: val });
    if (r.status === 0) console.log(`   ✓ ${key}`);
    else { fehler += 1; console.log(`   ✗ ${key}: ${(r.stderr || r.stdout || "").trim().slice(0, 160)}`); }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true }); // .env.hub sicher löschen
}

if (fehler > 0) {
  console.log(`\nACHTUNG: ${fehler} Key(s) konnten nicht gesetzt werden — Fenster offen lassen und Claude Bescheid geben.`);
}

console.log("4/4  Deploye brospify-editor neu (dauert ~2 Minuten) ...");
const d = vercel(["deploy", "--prod", "--yes"], { cwd: EDITOR_DIR, stdio: "inherit" });
if (d.status !== 0) throw new Error("Deploy fehlgeschlagen.");

console.log("\nFERTIG! Editor läuft mit allen Keys: https://brospify-editor.vercel.app");
