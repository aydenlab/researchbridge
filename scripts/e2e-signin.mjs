import { chromium } from "playwright";
import fs from "node:fs";

const email = process.argv[2] ?? "adeyemij@mcmaster.ca";
const statePath = process.argv[3] ?? "scripts/.auth-student.json";
const logPath = process.argv[4] ?? "/tmp/rbdev.log";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();

const before = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").length : 0;

await page.goto("http://localhost:3000/signin", { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.click('button[type="submit"]');
await page.waitForSelector("#code", { timeout: 20000 });

await new Promise((r) => setTimeout(r, 1200));
const log = fs.readFileSync(logPath, "utf8").slice(before);
const match = [...log.matchAll(/verification code is (\d{6})/g)].pop();
if (!match) {
  console.error("NO CODE FOUND");
  console.error(log.slice(-2500));
  process.exit(1);
}
console.log("code", match[1]);

await page.fill("#code", match[1]);
await Promise.all([
  page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 30000 }),
  page.click('form:has(#code) button[type="submit"]'),
]);
await page.waitForLoadState("networkidle");
console.log("landed on", page.url());

await context.storageState({ path: statePath });
await browser.close();
