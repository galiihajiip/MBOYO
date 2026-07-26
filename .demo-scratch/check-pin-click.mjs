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
await page.screenshot({ path: path.join(shotDir, "pin-debug-01-map-loaded.png") });

// Try clicking on canvas at various points where pins might be
const canvas = page.locator(".maplibregl-canvas");
const box = await canvas.boundingBox();
console.log("Canvas box:", box);

// Get marker DOM elements (cluster markers use maplibregl.Marker -> real DOM divs)
const markerCount = await page.locator(".maplibregl-marker").count();
console.log("maplibregl-marker count (cluster pins):", markerCount);

if (markerCount > 0) {
  await page.locator(".maplibregl-marker").first().click();
  await page.waitForTimeout(1000);
  console.log("URL after clicking cluster marker:", page.url());
}

console.log("Console errors so far:", errors);
await browser.close();
