import { chromium } from "playwright";
import path from "node:path";
const shotDir = path.resolve(".ui-shots");

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

// Public landing page footer
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator("footer").scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(shotDir, "team-01-landing-footer.png") });

// Login page
await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, "team-02-login.png"), fullPage: true });

// Methodology page
await page.goto("http://localhost:3000/methodology", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(shotDir, "team-03-methodology.png"), fullPage: true });

await browser.close();
