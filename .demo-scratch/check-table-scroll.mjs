import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("coordinator@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/command/, { timeout: 20000 });
await page.goto("http://localhost:3000/command/analitik", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('Analitik')", { timeout: 15000 });
await page.waitForTimeout(1000);

const info = await page.evaluate(() => {
  const table = document.querySelector("table");
  const scrollParent = table.closest(".overflow-x-auto");
  return { scrollWidth: scrollParent.scrollWidth, clientWidth: scrollParent.clientWidth };
});
console.log(info);
await browser.close();
