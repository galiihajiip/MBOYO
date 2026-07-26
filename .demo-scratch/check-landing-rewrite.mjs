import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shotDir, "landing-01-full.png"), fullPage: true });

// Click "AI & Petugas" tab and "Keamanan & Data" tab to check ArchitectureHub content
const aiTab = page.locator('button:has-text("AI & Petugas")');
if (await aiTab.count() > 0) {
  await aiTab.click();
  await page.waitForTimeout(300);
  await page.locator("#keamanan-data").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(shotDir, "landing-02-ai-tab.png") });
}

const securityTab = page.locator('button:has-text("Keamanan & Data")');
if (await securityTab.count() > 0) {
  await securityTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shotDir, "landing-03-security-tab.png") });
}

// Test the "Buat Laporan Sekarang" CTA link actually resolves
const heroCta = page.locator('a:has-text("Buat Laporan Sekarang")');
const href = await heroCta.getAttribute("href");
console.log("Hero CTA href:", href);

console.log("Console errors:", errors);
await browser.close();
