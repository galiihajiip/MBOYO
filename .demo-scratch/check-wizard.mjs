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

  await page.goto("http://localhost:3000/reporter/laporan/baru", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Pilih Event Bencana", { timeout: 15000 });
  await page.screenshot({ path: path.join(shotDir, "wizard-1-event.png"), fullPage: true });

  await page.click("text=Banjir Jakarta Selatan");
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);

  // step 2 photo
  await page.waitForSelector('input[type="file"]', { timeout: 10000 });
  const testImgPath = path.resolve("test-photo.jpg");
  fs.writeFileSync(testImgPath, Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=", "base64"));
  await page.setInputFiles('input[type="file"]', testImgPath);
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);

  // step 3 preview
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(500);

  // step 4 gps - skip to manual
  await page.screenshot({ path: path.join(shotDir, "wizard-4-gps.png"), fullPage: true });
  const gpsBtn = page.locator('button:has-text("Ambil Lokasi")');
  await page.click('button:has-text("Lanjut")');
  await page.waitForTimeout(800);

  // should now be on manual_location step (since gps likely denied in headless)
  await page.screenshot({ path: path.join(shotDir, "wizard-5-manual-location.png"), fullPage: true });

  console.log("Errors:", errors.length ? errors : "none");
} catch (err) {
  console.error("FAILED:", err.message);
  await page.screenshot({ path: path.join(shotDir, "wizard-ERROR.png"), fullPage: true });
} finally {
  await browser.close();
}
