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

// Revoke the Verifikator role we just granted, leaving only Auditor
const revokeLinks = page.locator('button:has-text("Cabut")');
const count = await revokeLinks.count();
for (let i = 0; i < count; i++) {
  const text = await page.locator("tbody tr td:nth-child(4)").innerText();
  if (text.includes("Verifikator")) {
    await page.locator('button[aria-label="Cabut peran Verifikator"]').click();
    await page.waitForTimeout(1200);
    break;
  }
}

const badges = await page.locator("tbody tr td:nth-child(4) span").allTextContents();
console.log("Badges after cleanup revoke:", badges.filter(b => b.trim()));
await browser.close();
