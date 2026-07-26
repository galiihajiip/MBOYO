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
await page.waitForSelector("text=Selamat datang", { timeout: 15000 });
await page.waitForTimeout(2500);

// Click the cluster marker (DOM-based, should already work)
const clusterMarker = page.locator(".maplibregl-marker").first();
if (await clusterMarker.count() > 0) {
  await clusterMarker.click();
  await page.waitForTimeout(1000);
  console.log("URL after cluster marker click:", page.url());
}

await browser.close();
