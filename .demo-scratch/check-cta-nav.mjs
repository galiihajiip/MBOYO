import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.click('a:has-text("Buat Laporan Sekarang")');
await page.waitForURL(/masuk/, { timeout: 10000 });
console.log("Landed on:", page.url());
await browser.close();
