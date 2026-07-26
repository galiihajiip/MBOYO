import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
  await page.click('button:has-text("coordinator@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/command/, { timeout: 20000 });

  await page.goto("http://localhost:3000/command/analitik", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Analitik", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, "command-analitik-01.png"), fullPage: true });

  console.log("Errors:", errors);
} catch (err) {
  console.error("TEST FAILED:", err);
  await page.screenshot({ path: path.join(shotDir, "command-analitik-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
