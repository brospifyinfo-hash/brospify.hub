import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [name, w, h] of [["h1024", 1024, 900], ["h1440", 1440, 950], ["m390", 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto("http://localhost:3315/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `/tmp/shots/${name}.png` });
  await p.close();
}
await b.close();
