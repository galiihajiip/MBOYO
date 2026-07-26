import { chromium } from "playwright";
import path from "node:path";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.resolve(".ui-shots/landing-mobile-hero.png") });
await browser.close();
