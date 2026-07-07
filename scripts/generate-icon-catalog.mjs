// Generiert src/lib/theme-icon-catalog.ts aus lucide-react (node_modules) +
// scripts/lucide-tags.json (offizielle Lucide-Suchbegriffe).
// Alle SVG-Primitive werden zu Pfad-d-Strings normalisiert, damit Preview,
// Buybox-Plan, Liquid-Snippet und Runtime denselben einfachen paths-Vertrag
// nutzen wie die handgepflegten THEME_ICONS (24x24, Stroke).
// Ausführen: node scripts/generate-icon-catalog.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const ICON_DIR = path.join(repo, "node_modules", "lucide-react", "dist", "esm", "icons");
const TAGS_FILE = path.join(here, "lucide-tags.json");
const OUT = path.join(repo, "src", "lib", "theme-icon-catalog.ts");

const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v) => r3(typeof v === "string" ? parseFloat(v) : v);

// SVG-Primitiv → Pfad-d-String (Stroke-Semantik bleibt identisch).
function toPath(tag, a) {
  switch (tag) {
    case "path":
      return a.d;
    case "line":
      return `M${num(a.x1)} ${num(a.y1)}L${num(a.x2)} ${num(a.y2)}`;
    case "polyline": {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      let d = `M${r3(pts[0])} ${r3(pts[1])}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${r3(pts[i])} ${r3(pts[i + 1])}`;
      return d;
    }
    case "polygon": {
      const pts = String(a.points).trim().split(/[\s,]+/).map(Number);
      let d = `M${r3(pts[0])} ${r3(pts[1])}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${r3(pts[i])} ${r3(pts[i + 1])}`;
      return d + "Z";
    }
    case "circle": {
      const cx = num(a.cx), cy = num(a.cy), r = num(a.r);
      return `M${r3(cx - r)} ${cy}a${r} ${r} 0 1 0 ${r3(r * 2)} 0a${r} ${r} 0 1 0 ${r3(-r * 2)} 0`;
    }
    case "ellipse": {
      const cx = num(a.cx), cy = num(a.cy), rx = num(a.rx), ry = num(a.ry);
      return `M${r3(cx - rx)} ${cy}a${rx} ${ry} 0 1 0 ${r3(rx * 2)} 0a${rx} ${ry} 0 1 0 ${r3(-rx * 2)} 0`;
    }
    case "rect": {
      const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
      const rx = a.rx != null ? num(a.rx) : 0;
      const ry = a.ry != null ? num(a.ry) : rx;
      if (!rx && !ry) return `M${x} ${y}h${w}v${h}h${r3(-w)}Z`;
      return (
        `M${r3(x + rx)} ${y}h${r3(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${rx} ${ry}` +
        `v${r3(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${r3(-rx)} ${ry}h${r3(-(w - 2 * rx))}` +
        `a${rx} ${ry} 0 0 1 ${r3(-rx)} ${r3(-ry)}v${r3(-(h - 2 * ry))}a${rx} ${ry} 0 0 1 ${rx} ${r3(-ry)}Z`
      );
    }
    default:
      return null;
  }
}

const tags = JSON.parse(fs.readFileSync(TAGS_FILE, "utf8"));
const files = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith(".js") && !f.endsWith(".map"));

const entries = [];
let skipped = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(ICON_DIR, f), "utf8");
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);\nconst /);
  if (!m) { skipped++; continue; } // Alias-Re-Exports haben kein __iconNode
  let nodes;
  try {
    nodes = (0, eval)(m[1]); // Quelle: node_modules (Build-Zeit-Skript)
  } catch { skipped++; continue; }
  const id = f.replace(/\.js$/, "");
  const paths = [];
  let ok = true;
  for (const [tag, attrs] of nodes) {
    const d = toPath(tag, attrs);
    if (!d) { ok = false; break; }
    paths.push(d);
  }
  if (!ok || paths.length === 0) { skipped++; continue; }
  const nameWords = id.split("-");
  const tagWords = Array.isArray(tags[id]) ? tags[id] : [];
  const search = Array.from(new Set([...nameWords, ...tagWords.flatMap((t) => String(t).toLowerCase().split(/\s+/))]))
    .filter((w) => w.length > 1)
    .join(" ");
  entries.push({ id, search, paths });
}

entries.sort((a, b) => a.id.localeCompare(b.id));

const lines = entries.map(
  (e) => `  [${JSON.stringify(e.id)}, ${JSON.stringify(e.search)}, ${JSON.stringify(e.paths)}],`,
);
const out = `// AUTOGENERIERT durch scripts/generate-icon-catalog.mjs — NICHT von Hand editieren.
// Quelle: lucide-react ${JSON.parse(fs.readFileSync(path.join(repo, "node_modules", "lucide-react", "package.json"), "utf8")).version} (ISC-Lizenz) + scripts/lucide-tags.json.
// Format: [id, suchbegriffe, pfade] — 24x24-Stroke-Pfade (Primitive zu d-Strings normalisiert).

export type CatalogIconTuple = [id: string, search: string, paths: string[]];

export const ICON_CATALOG: CatalogIconTuple[] = [
${lines.join("\n")}
];
`;
fs.writeFileSync(OUT, out);
console.log(`geschrieben: ${OUT}`);
console.log(`icons: ${entries.length}, uebersprungen (aliase/unparsbar): ${skipped}, groesse: ${(out.length / 1024).toFixed(0)} KB`);
