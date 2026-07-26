import { chromium } from "playwright";
import path from "node:path";
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
await page.locator("text=Banjir Jakarta Selatan").first().click();
await page.waitForTimeout(300);
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(400);

await page.waitForSelector('input[type="file"]', { timeout: 10000 });
const testImgPath = path.resolve("test-photo.jpg");
await page.setInputFiles('input[type="file"]', testImgPath);
await page.waitForTimeout(800);
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(400);
if (await page.locator('button:has-text("Lanjut")').count() > 0) {
  await page.locator('button:has-text("Lanjut")').click();
  await page.waitForTimeout(600);
}
await page.locator('button:has-text("Gunakan Peta / Alamat Manual")').click();
await page.waitForTimeout(1000);

console.log("Step heading before click:", await page.locator("h1").innerText());
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(600);
console.log("Step heading after click:", await page.locator("h1").innerText());

await browser.close();
