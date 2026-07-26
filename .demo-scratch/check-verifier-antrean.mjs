import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
  await page.click('button:has-text("verifier@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/verifier/, { timeout: 20000 });

  await page.goto("http://localhost:3000/verifier/antrean", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Antrean Verifikasi", { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(shotDir, "antrean-01-list.png"), fullPage: false });

  // Click first row to open inline preview panel
  const firstRow = page.locator("table tbody tr").first();
  await firstRow.click();
  await page.waitForSelector("text=Detail Preview", { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(shotDir, "antrean-02-preview-open.png"), fullPage: false });

  // Check decision panel is present
  const hasDecisionPanel = await page.locator("text=Keputusan Verifikasi").count();
  console.log("Decision panel visible:", hasDecisionPanel > 0);

  if (hasDecisionPanel > 0) {
    await page.click('button:has-text("Konfirmasi")');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(shotDir, "antrean-03-decision-selected.png"), fullPage: false });

    const submitBtn = page.locator('button:has-text("Simpan Keputusan")');
    const isDisabled = await submitBtn.isDisabled();
    console.log("Submit button disabled after selecting Konfirmasi:", isDisabled);

    if (!isDisabled) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(shotDir, "antrean-04-after-submit.png"), fullPage: false });
      const panelClosed = (await page.locator("text=Detail Preview").count()) === 0;
      console.log("Panel closed after decision submitted:", panelClosed);
    }
  }

  console.log("Console/page errors:", errors);
} catch (err) {
  console.error("TEST FAILED:", err);
  await page.screenshot({ path: path.join(shotDir, "antrean-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
