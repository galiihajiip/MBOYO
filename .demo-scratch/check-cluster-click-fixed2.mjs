import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("coordinator@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/command/, { timeout: 20000 });

await page.goto("http://localhost:3000/command/peta", { waitUntil: "domcontentloaded" });
await page.waitForSelector("h1:has-text('Peta Krisis')", { timeout: 15000 });
await page.waitForTimeout(2500);

for (let i = 0; i < 6; i++) {
  await page.mouse.move(970, 600);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(1000);

// Click cluster repeatedly to fully expand
for (let i = 0; i < 4; i++) {
  const clusters = await page.evaluate(() => {
    const canvas = document.querySelector(".maplibregl-canvas");
    return canvas ? { w: canvas.width, h: canvas.height } : null;
  });
  await page.mouse.click(770, 596);
  await page.waitForTimeout(1200);
}
await page.screenshot({ path: path.join(shotDir, "cluster-fix-03-fully-expanded.png") });

console.log("Errors:", errors);
await browser.close();
