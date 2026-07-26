import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
  await page.click('button:has-text("coordinator@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/command/, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, "coordinator-home.png"), fullPage: true });

  await page.goto("http://localhost:3000/reporter", { waitUntil: "domcontentloaded" }).catch(() => {});
} catch (err) {
  console.error("FAILED:", err.message);
} finally {
  await browser.close();
}
