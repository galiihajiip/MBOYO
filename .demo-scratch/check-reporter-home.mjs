import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
  await page.click('button:has-text("reporter@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/reporter/, { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(shotDir, "reporter-home-new.png"), fullPage: true });
  console.log("Errors:", errors.length ? errors : "none");
} catch (err) {
  console.error("FAILED:", err.message);
  await page.screenshot({ path: path.join(shotDir, "reporter-home-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
