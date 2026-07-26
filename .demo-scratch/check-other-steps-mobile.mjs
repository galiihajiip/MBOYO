import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("reporter@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/reporter/, { timeout: 20000 });

await page.goto("http://localhost:3000/reporter/laporan/baru", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilih Event Bencana", { timeout: 15000 });
await page.screenshot({ path: path.join(shotDir, "step-event.png") });

await page.locator("text=Banjir Jakarta Selatan").first().click();
await page.waitForTimeout(300);
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, "step-photo.png") });

await page.waitForSelector('input[type="file"]', { timeout: 10000 });
await page.setInputFiles('input[type="file"]', path.resolve("test-photo.jpg"));
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shotDir, "step-photo-after-upload.png") });
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, "step-preview.png") });

await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(shotDir, "step-gps.png") });

await browser.close();
