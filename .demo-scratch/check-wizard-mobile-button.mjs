import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const shotDir = path.resolve(".ui-shots");
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: -6.2, longitude: 106.816 },
  permissions: [],
});
const page = await context.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("reporter@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/reporter/, { timeout: 20000 });

await page.goto("http://localhost:3000/reporter/laporan/baru", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilih Event Bencana", { timeout: 15000 });
await page.screenshot({ path: path.join(shotDir, "wiz-01-event.png") });

// Step 1: pick event
const eventCard = page.locator("text=Banjir Jakarta Selatan").first();
await eventCard.click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(shotDir, "wiz-01b-after-event.png") });
await page.locator('button:has-text("Lanjut")').click();
await page.waitForTimeout(400);

// Step 2: photo (upload a test file)
await page.waitForSelector('input[type="file"]', { timeout: 10000 });
const testImgPath = path.resolve("test-photo.jpg");
if (!fs.existsSync(testImgPath)) {
  fs.writeFileSync(testImgPath, Buffer.from("/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=", "base64"));
}
await page.setInputFiles('input[type="file"]', testImgPath);
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shotDir, "wiz-02-photo.png") });
const nextBtn = page.locator('button:has-text("Lanjut")');
if (await nextBtn.count() > 0) {
  await nextBtn.click();
  await page.waitForTimeout(400);
}

// Step 3: preview -> next
await page.screenshot({ path: path.join(shotDir, "wiz-03-preview.png") });
if (await page.locator('button:has-text("Lanjut")').count() > 0) {
  await page.locator('button:has-text("Lanjut")').click();
  await page.waitForTimeout(600);
}

// Step 4: GPS step -> use manual fallback link
await page.screenshot({ path: path.join(shotDir, "wiz-04-gps.png") });
const manualLink = page.locator('button:has-text("Gunakan Peta / Alamat Manual")');
if (await manualLink.count() > 0) {
  await manualLink.click();
  await page.waitForTimeout(800);
}

// Step 5: manual location - THIS is the step in question
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(shotDir, "wiz-05-manual-location-FULL.png"), fullPage: true });
await page.screenshot({ path: path.join(shotDir, "wiz-05-manual-location-VIEWPORT.png"), fullPage: false });

const lanjutCount = await page.locator('button:has-text("Lanjut")').count();
console.log("Lanjut button count on manual_location step:", lanjutCount);
if (lanjutCount > 0) {
  const btn = page.locator('button:has-text("Lanjut")').first();
  console.log("Visible:", await btn.isVisible());
  console.log("Bounding box:", await btn.boundingBox());
}

console.log("Console errors:", errors);
await browser.close();
