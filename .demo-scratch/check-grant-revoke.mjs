import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("admin@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/admin/, { timeout: 20000 });
await page.goto("http://localhost:3000/admin/pengguna", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('Manajemen Pengguna')", { timeout: 15000 });
await page.fill('input[aria-label="Cari pengguna"]', "Rina");
await page.waitForTimeout(300);

// Grant "Verifikator" role to Rina Wijaya (currently Auditor only)
await page.click('text=Berikan Peran');
await page.waitForTimeout(1500);

const badges = await page.locator("tbody tr td:nth-child(4) span").allTextContents();
console.log("Badges after grant:", badges.filter(b => b.trim()));
await browser.close();
