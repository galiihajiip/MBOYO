import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("verifier@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/verifier/, { timeout: 20000 });

await page.goto("http://localhost:3000/verifier/laporan/6aebc046-7585-45f2-9858-36aa1f603dd6", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
console.log("Title:", await page.title());
console.log("Body snippet:", (await page.locator("body").innerText()).slice(0, 500));
console.log("Errors:", errors);
await browser.close();
