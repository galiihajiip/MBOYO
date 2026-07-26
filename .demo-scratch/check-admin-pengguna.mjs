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
  await page.click('button:has-text("admin@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 20000 });

  await page.goto("http://localhost:3000/admin/pengguna", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1:has-text('Manajemen Pengguna')", { timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, "admin-pengguna-01.png"), fullPage: true });

  // Test search filter
  await page.fill('input[aria-label="Cari pengguna"]', "reporter");
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotDir, "admin-pengguna-02-search.png"), fullPage: false });

  console.log("Errors:", errors);
} catch (err) {
  console.error("TEST FAILED:", err);
  await page.screenshot({ path: path.join(shotDir, "admin-pengguna-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
