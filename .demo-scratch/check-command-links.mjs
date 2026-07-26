import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("coordinator@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/command/, { timeout: 20000 });
await page.waitForSelector("text=Selamat datang", { timeout: 15000 });

// Click "Tugas Aktif" metric card
await page.click('text=Tugas Aktif');
await page.waitForURL(/tugas\?status=in_progress/, { timeout: 10000 });
console.log("Metric card link OK:", page.url());

// Go back, click a report card
await page.goto("http://localhost:3000/command", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Laporan Terbaru", { timeout: 15000 });
const firstCard = page.locator('a[href*="/command/tugas/baru?reportId="]').first();
await firstCard.click();
await page.waitForURL(/tugas\/baru\?reportId=/, { timeout: 10000 });
console.log("Report card link OK:", page.url());

await browser.close();
