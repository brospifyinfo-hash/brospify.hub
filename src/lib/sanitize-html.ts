// ─── Tiny HTML sanitiser ─────────────────────────────────────────
// We let admins author StartTasks bodies with a few safe inline tags
// (links, line breaks, basic emphasis). This sanitiser strips
// everything else and protects against javascript: URLs.
//
// Not a general-purpose sanitiser — it's the minimal surface we need
// for one feature, no DOMPurify dependency. If the surface grows,
// swap for a real library.

const ALLOWED_TAGS = new Set(["a", "br", "strong", "em", "b", "i"]);

function isSafeHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (/^https?:\/\//i.test(trimmed)) return true;
  return false;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sanitizeTaskHtml(input: string): string {
  if (!input) return "";
  // Walk through token-by-token: text segments stay (with entity escaping),
  // tags are validated against the allow-list.
  let out = "";
  let i = 0;
  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(input.slice(i));
      break;
    }
    out += escapeText(input.slice(i, lt));
    const gt = input.indexOf(">", lt);
    if (gt === -1) {
      // Stray "<" with no closing — escape it and bail.
      out += escapeText(input.slice(lt));
      break;
    }
    const raw = input.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (!raw) continue;
    const isClose = raw.startsWith("/");
    const body = isClose ? raw.slice(1).trim() : raw;
    const spaceIdx = body.search(/\s/);
    const tagName = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) continue;
    if (isClose) {
      if (tagName === "br") continue;
      out += `</${tagName}>`;
      continue;
    }
    if (tagName === "br") {
      out += "<br />";
      continue;
    }
    if (tagName === "a") {
      // Extract href only — drop every other attribute.
      const hrefMatch = body.match(/href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const hrefRaw = hrefMatch?.[2] ?? hrefMatch?.[3] ?? hrefMatch?.[4] ?? "";
      if (!isSafeHref(hrefRaw)) continue;
      out += `<a href="${escapeAttr(hrefRaw)}" target="_blank" rel="noopener noreferrer">`;
      continue;
    }
    // strong / em / b / i — no attributes preserved.
    out += `<${tagName}>`;
  }
  return out;
}
