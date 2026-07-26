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
  await page.click('button:has-text("reporter@mboyo.demo")');
  await page.click('button[type="submit"]');
  await page.waitForURL(/reporter/, { timeout: 20000 });

  // Submit a report through the wizard to populate the queue
  await page.goto("http://localhost:3000/reporter/laporan/baru", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilih Event Bencana", { timeout: 15000 });
  await page.click("text=Banjir Jakarta Selatan");
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);

  await page.waitForSelector('input[type="file"]', { timeout: 10000 });
  const testImgPath = path.resolve("test-photo.jpg");
  fs.writeFileSync(testImgPath, Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=", "base64"));
  await page.setInputFiles('input[type="file"]', testImgPath);
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Lanjut")'); // preview
  await page.waitForTimeout(500);
  await page.click('button:has-text("Lanjut")'); // gps -> manual location
  await page.waitForTimeout(800);
  await page.click('button:has-text("Lanjut")'); // manual location -> description
  await page.waitForTimeout(500);

  await page.locator('input[placeholder*="Rumah roboh"]').fill("UI test: antrean offline redesign");
  const desc = page.locator("textarea");
  if (await desc.count()) await desc.first().fill("Deskripsi uji tampilan antrean.");
  await page.click('button:has-text("Kerusakan Berat")');
  await page.click('button:has-text("Lanjut")'); // -> consent
  await page.waitForTimeout(500);

  const checkboxes = page.locator('button[role="checkbox"], input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  for (let i = 0; i < cbCount; i++) await checkboxes.nth(i).click();
  await page.click('button:has-text("Lanjut")'); // -> review
  await page.waitForTimeout(500);
  await page.click('button:has-text("Lanjut")'); // -> submit
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Kirim")').first().click();
  await page.waitForTimeout(1000);

  // Now go straight to Antrean Offline before background sync completes
  await page.goto("http://localhost:3000/reporter/antrean", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, "antrean-offline-new.png"), fullPage: true });

  console.log("Errors:", errors.length ? errors : "none");
} catch (err) {
  console.error("FAILED:", err.message);
  await page.screenshot({ path: path.join(shotDir, "antrean-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
