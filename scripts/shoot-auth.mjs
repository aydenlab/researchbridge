import { chromium } from "playwright";

const [, , state, url, out, opts = ""] = process.argv;
const full = opts.includes("full");
const width = Number((opts.match(/w=(\d+)/) || [])[1] || 1440);
const height = Number((opts.match(/h=(\d+)/) || [])[1] || 950);

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: state, viewport: { width, height } });
const page = await context.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: out, fullPage: full });
console.log("shot", out, page.url());
await browser.close();
