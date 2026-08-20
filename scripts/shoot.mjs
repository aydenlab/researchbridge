import { chromium } from "playwright";

const [, , url, out, opts = ""] = process.argv;
const full = opts.includes("full");
const width = Number((opts.match(/w=(\d+)/) || [])[1] || 1440);
const height = Number((opts.match(/h=(\d+)/) || [])[1] || 900);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1400);
if (full) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log("shot", out);
