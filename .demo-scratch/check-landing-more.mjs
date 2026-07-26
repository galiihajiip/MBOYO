import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

const techHeading = page.locator("h3:has-text('Teknologi yang Kami Pakai')");
await techHeading.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await techHeading.locator("xpath=ancestor::section[1]").screenshot({ path: path.join(shotDir, "sec-tech-metrics.png") });

const roleHeading = page.locator("h2:has-text('5 Peran, 5 Batas Akses')");
await roleHeading.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await roleHeading.locator("xpath=ancestor::section[1]").screenshot({ path: path.join(shotDir, "sec-roles.png") });

await browser.close();
