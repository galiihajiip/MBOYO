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
  const heading = [...document.querySelectorAll("h2")].find(h => h.textContent.includes("Garis Waktu"));
  const section = heading?.closest("section");
  const chartWrapper = section?.querySelector(".h-56");
  const roleImg = section?.querySelector('[role="img"]');
  return {
    sectionRect: section?.getBoundingClientRect(),
    chartWrapperRect: chartWrapper?.getBoundingClientRect(),
    roleImgRect: roleImg?.getBoundingClientRect(),
    roleImgChildren: roleImg?.children.length,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
