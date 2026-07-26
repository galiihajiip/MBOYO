import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

await page.locator("section").first().screenshot({ path: path.join(shotDir, "sec-hero.png") });

const impactHeading = page.locator("h2:has-text('Kenapa Kecepatan Melapor')");
await impactHeading.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await impactHeading.locator("xpath=ancestor::section[1]").screenshot({ path: path.join(shotDir, "sec-impact.png") });

const problemHeading = page.locator("h2:has-text('Cara Melapor Bencana')");
await problemHeading.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await problemHeading.locator("xpath=ancestor::section[1]").screenshot({ path: path.join(shotDir, "sec-problem.png") });

await browser.close();
