import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("coordinator@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/command/, { timeout: 20000 });

await page.goto("http://localhost:3000/command/peta", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('Peta Krisis')", { timeout: 15000 });
await page.waitForTimeout(2500);

// Query the actual rendered features on the unclustered layer via map API
const featureInfo = await page.evaluate(() => {
  // maplibregl map instance isn't globally exposed, so grab canvas and try a queryRenderedFeatures via a hack:
  // Instead, let's find the container and check if window has any map ref exposed
  return { hasWindowMapLibre: typeof window.maplibregl !== "undefined" };
});
console.log(featureInfo);

// Zoom in significantly to un-cluster points, then try clicking
for (let i = 0; i < 6; i++) {
  await page.mouse.move(970, 600);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(shotDir, "pin-debug-02-zoomed.png") });

const markerCountAfterZoom = await page.locator(".maplibregl-marker").count();
console.log("cluster markers after zoom:", markerCountAfterZoom);

await browser.close();
