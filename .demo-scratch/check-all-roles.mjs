import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const roles = [
  { email: "verifier@mboyo.demo", urlPattern: /verifier/, name: "verifier" },
  { email: "coordinator@mboyo.demo", urlPattern: /command/, name: "coordinator" },
  { email: "admin@mboyo.demo", urlPattern: /admin/, name: "admin" },
  { email: "auditor@mboyo.demo", urlPattern: /audit/, name: "auditor" },
];

try {
  for (const r of roles) {
    await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
    await page.click(`button:has-text("${r.email}")`);
    await page.click('button[type="submit"]');
    await page.waitForURL(r.urlPattern, { timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shotDir, `sidebar-${r.name}.png`), fullPage: false });
    console.log("Captured", r.name);
    await page.context().clearCookies();
  }
} catch (err) {
  console.error("FAILED:", err.message);
} finally {
  await browser.close();
}
