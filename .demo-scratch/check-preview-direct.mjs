import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("http://localhost:3000/masuk", { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Pilihan Akun Demo Instan", { timeout: 15000 });
await page.click('button:has-text("verifier@mboyo.demo")');
await page.click('button[type="submit"]');
await page.waitForURL(/verifier/, { timeout: 20000 });

await page.goto("http://localhost:3000/verifier/antrean", { waitUntil: "domcontentloaded" });
await page.waitForSelector("table tbody tr", { timeout: 15000 });

const reportId = await page.evaluate(() => {
  // no data-id on row; call the API list instead
  return null;
});

const res = await page.evaluate(async () => {
  const listRes = await fetch("/api/verifier/reports?pageSize=1");
  const listJson = await listRes.json();
  const id = listJson?.data?.items?.[0]?.id;
  if (!id) return { error: "no id found", listJson };
  const previewRes = await fetch(`/api/verifier/reports/${id}/preview`);
  const previewJson = await previewRes.json();
  return { id, status: previewRes.status, previewJson };
});

console.log(JSON.stringify(res, null, 2));
await browser.close();
