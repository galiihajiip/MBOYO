import { chromium } from "playwright";
import path from "node:path";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("admin@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/admin/, { timeout: 20000 });
await page.goto("http://localhost:3000/admin/pengguna", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('Manajemen Pengguna')", { timeout: 15000 });
await page.fill('input[aria-label="Cari pengguna"]', "Siti");
await page.waitForTimeout(300);
await page.screenshot({ path: path.resolve(".ui-shots/admin-pengguna-03-search-match.png"), fullPage: false });

// Test role filter dropdown
await page.fill('input[aria-label="Cari pengguna"]', "");
await page.click('[aria-label="Filter berdasarkan peran"]');
await page.waitForTimeout(200);
await page.click('text=Verifikator');
await page.waitForTimeout(300);
await page.screenshot({ path: path.resolve(".ui-shots/admin-pengguna-04-role-filter.png"), fullPage: false });
await browser.close();
