/**
 * Walks the video response and acceptance features through a real browser, on
 * both sides of the platform, against a freshly seeded development server:
 *
 *   BASE=http://localhost:3111 RB_DEV_LOG=path/to/dev.log SHOTS=path/to/dir \
 *     node scripts/e2e-video-acceptance.mjs
 *
 * RB_DEV_LOG is the server's stdout, where EMAIL_PROVIDER=console prints sign-in
 * codes. Uses installed Chrome because Playwright's own Chromium has no H.264, so
 * it could not play the MP4 a phone would produce. Never point this at production:
 * it accepts students and sends the emails that go with that.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3000";
const LOG = process.env.RB_DEV_LOG;
const SHOTS = process.env.SHOTS ?? "e2e-shots";
const WORK = path.join(SHOTS, "files");
fs.mkdirSync(WORK, { recursive: true });
if (/myresearchbridge\.com|railway\.app/.test(BASE)) throw new Error("This script must not run against production.");

const RESEARCHER = "okonjoa@example.edu";
const ADMIN = "admin@myresearchbridge.com";
const STUDENTS = { upload: "adeyemij@example.edu", youtube: "obrienk@example.edu", loom: "t.nakamura@example.edu" };
const POSITION_TITLE = "Clinical Chart Review Project Assistant";
const POSITION_SLUG = "clinical-chart-review-project-assistant-chart";
const YOUTUBE = "https://youtu.be/dQw4w9WgXcQ?si=trackingjunk";
const LOOM = "https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184";

const results = [];
const pageErrors = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}
const shot = (page, name, fullPage = true) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });

const browser = await chromium.launch({ channel: "chrome" });

async function signIn(email, viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  context.setDefaultTimeout(180000);
  context.setDefaultNavigationTimeout(240000);
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${email}: ${String(error).slice(0, 300)}`));
  const before = fs.readFileSync(LOG, "utf8").length;
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.click('form:has(#email) button[type="submit"]');
  await page.waitForSelector("#code");
  await page.waitForTimeout(1200);
  const code = [...fs.readFileSync(LOG, "utf8").slice(before).matchAll(/verification code is (\d{6})/g)].pop()?.[1];
  if (!code) throw new Error(`no code for ${email}`);
  await page.fill("#code", code);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/signin")),
    page.click('form:has(#code) button[type="submit"]'),
  ]);
  await page.waitForLoadState("domcontentloaded");
  return { context, page };
}

/** Records real clips with the browser's own encoder, so the files are ones a browser can really play. */
async function makeClips(page) {
  const record = (mimeType) =>
    page.evaluate(async (type) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const draw = canvas.getContext("2d");
      const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: type });
      const chunks = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const stopped = new Promise((resolve) => (recorder.onstop = resolve));
      recorder.start();
      const started = performance.now();
      await new Promise((resolve) => {
        const tick = () => {
          const elapsed = (performance.now() - started) / 1000;
          draw.fillStyle = `hsl(${(elapsed * 90) % 360} 60% 40%)`;
          draw.fillRect(0, 0, 320, 180);
          draw.fillStyle = "white";
          draw.font = "24px sans-serif";
          draw.fillText(`t=${elapsed.toFixed(1)}s`, 110, 95);
          if (elapsed < 3) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      recorder.stop();
      await stopped;
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(binary);
    }, mimeType);
  const mp4 = path.join(WORK, "my intro.mp4");
  const webm = path.join(WORK, "second-take.webm");
  fs.writeFileSync(mp4, Buffer.from(await record("video/mp4;codecs=avc1.42E01E"), "base64"));
  fs.writeFileSync(webm, Buffer.from(await record("video/webm;codecs=vp9"), "base64"));
  const fake = path.join(WORK, "actually-a-pdf.mp4");
  fs.writeFileSync(fake, "%PDF-1.7 this is not a video at all, whatever its name says");
  const resume = path.join(WORK, "resume.pdf");
  fs.writeFileSync(resume, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  return { mp4, webm, fake, resume };
}

/** Waits until a video element has really decoded metadata, and reports what it found. */
async function videoState(page, selector = "video") {
  const video = page.locator(selector).first();
  await video.waitFor({ state: "visible" });
  return video.evaluate(
    (element) =>
      new Promise((resolve) => {
        const done = () =>
          resolve({ duration: element.duration, width: element.videoWidth, error: element.error?.code ?? null, ready: element.readyState });
        if (element.readyState >= 1 || element.error) return done();
        element.addEventListener("loadedmetadata", done, { once: true });
        element.addEventListener("error", done, { once: true });
        setTimeout(done, 20000);
      }),
  );
}

async function openApplication(page, slug) {
  await page.goto(`${BASE}/opportunities/${slug}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Apply to this project|Continue your application/ }).first().click();
  await page.waitForURL(/\/applications\/[^/]+\/edit/);
  await page.waitForLoadState("networkidle");
  const resumeInput = page.locator('input[type="file"][name="resume"]');
  if (await resumeInput.count()) {
    await resumeInput.setInputFiles(resumePath);
    await page.locator('form:has(input[name="resume"]) button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: "networkidle" });
  }
  return page.url().match(/applications\/([^/]+)\/edit/)[1];
}

/** Written questions the seed attached to the position, answered so only the video is under test. */
async function answerWritten(page) {
  for (const box of await page.locator('form textarea[name^="q_"]').all()) await box.fill("A considered answer for the end to end test.");
  for (const input of await page.locator('form input[name^="q_"]:not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="checkbox"]):not([inputmode="url"])').all()) await input.fill("An answer.");
  for (const select of await page.locator('form select[name^="q_"]').all()) await select.selectOption({ index: 1 });
}

let resumePath;
try {
  // ── Researcher asks for a required video ─────────────────────────────────────
  const researcher = await signIn(RESEARCHER);
  const clips = await makeClips(researcher.page);
  resumePath = clips.resume;
  check("recorded real clips to upload", fs.statSync(clips.mp4).size > 1000 && fs.statSync(clips.webm).size > 1000, `mp4 ${fs.statSync(clips.mp4).size}b, webm ${fs.statSync(clips.webm).size}b`);

  await researcher.page.goto(`${BASE}/researcher/opportunities`, { waitUntil: "networkidle" });
  // A seeded position none of these three students has applied to.
  const listHtml = await researcher.page.content();
  const opportunityId = listHtml
    .slice(listHtml.indexOf(POSITION_TITLE) - 200)
    .match(/\/researcher\/opportunities\/([0-9a-f-]{36})/)?.[1];
  check("found a position to edit", Boolean(opportunityId));

  await researcher.page.goto(`${BASE}/researcher/opportunities/${opportunityId}/edit?step=7`, { waitUntil: "networkidle" });
  const enable = researcher.page.locator('input[name="videoResponseEnabled"]');
  if (!(await enable.isChecked())) await enable.check();
  await researcher.page.locator("#videoPrompt").fill("Tell us in a minute why this project in particular.");
  await researcher.page.locator('input[name="videoRequired"][value="true"]').check();
  await researcher.page.locator('form:has(#videoPrompt) button[type="submit"]').first().click();
  await researcher.page.waitForTimeout(2500);
  await shot(researcher.page, "01-researcher-requests-video");

  await researcher.page.goto(`${BASE}/researcher/opportunities/${opportunityId}/edit?step=7`, { waitUntil: "networkidle" });
  check("researcher's video request was saved", await researcher.page.locator('input[name="videoRequired"][value="true"]').isChecked());

  // ── Student uploads a file ───────────────────────────────────────────────────
  const uploader = await signIn(STUDENTS.upload);
  const slug = POSITION_SLUG;
  await uploader.page.goto(`${BASE}/opportunities/${slug}`, { waitUntil: "networkidle" });
  const listing = await uploader.page.locator("body").innerText();
  check("student sees the researcher's request on the listing", listing.includes("why this project in particular"));
  check("the listing says a file can be uploaded", listing.includes("Upload a video file"));
  await shot(uploader.page, "02-listing-shows-video-request");

  const uploadAppId = await openApplication(uploader.page, slug);
  const page = uploader.page;
  await answerWritten(page);
  const providerRadios = page.locator('input[type="radio"][name$="_provider"]');
  check("three ways to send a video are offered", (await providerRadios.count()) === 3);
  await shot(page, "03-application-three-options");

  // Refuses a file that is not a video, before sending it.
  await providerRadios.locator('nth=0').check();
  await page.locator('input[type="file"][aria-label="Choose a video file"]').setInputFiles(clips.fake);
  await page.getByText("not a video this can play").waitFor();
  check("a renamed PDF is refused in the browser", true);

  // A required video blocks submission.
  await page.locator('button[type="submit"]:has-text("Submit application")').click();
  await page.getByText(/Still needed: .*your video/).waitFor();
  check("submitting without the required video is refused", true);

  // A real upload, with visible progress and a working preview.
  const uploadRequests = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/video")) uploadRequests.push(request.url());
  });
  await page.locator('input[type="file"][aria-label="Choose a video file"]').setInputFiles(clips.mp4);
  await page.locator("video").first().waitFor({ state: "visible" });
  check("upload went up through its own route", uploadRequests.length === 1);
  let state = await videoState(page);
  check("uploaded MP4 plays in the student's preview", state.duration > 1 && state.width === 320 && state.error === null, JSON.stringify(state));
  check("file name and size are shown", (await page.locator("body").innerText()).includes("my_intro.mp4"));
  await shot(page, "04-student-uploaded-preview");

  // Survives a reload, and draft saves do not re-send it or lose it.
  await page.reload({ waitUntil: "networkidle" });
  state = await videoState(page);
  check("uploaded video is still there after reloading the draft", state.duration > 1, JSON.stringify(state));
  await page.getByRole("button", { name: "Save draft" }).click();
  await page.getByText("Draft saved").or(page.getByText("Saved")).first().waitFor();
  await page.reload({ waitUntil: "networkidle" });
  check("saving a draft keeps the video", (await page.locator("video").count()) === 1);

  // Half a link must not cost the student the file.
  await providerRadios.locator("nth=1").check();
  await page.locator('input[inputmode="url"]').fill("h");
  await page.waitForTimeout(3500);
  await page.reload({ waitUntil: "networkidle" });
  state = await videoState(page);
  check("autosaving half a typed link keeps the uploaded video", state.width === 320, JSON.stringify(state));

  // Replace it, then submit.
  await page.locator('input[type="file"][aria-label="Choose a video file"]').setInputFiles(clips.webm);
  await page.getByText("second-take.webm").waitFor();
  state = await videoState(page);
  check("replacing the video works, and WebM plays", state.width === 320 && state.error === null, JSON.stringify(state));

  await answerWritten(page);
  await page.locator('button[type="submit"]:has-text("Submit application")').click();
  await page.waitForURL(new RegExp(`/applications/${uploadAppId}\\?submitted=1`));
  state = await videoState(page);
  check("submitted application shows the student their video", state.width === 320, JSON.stringify(state));
  await shot(page, "05-student-submitted");

  // ── Students share links ─────────────────────────────────────────────────────
  async function applyWithLink(email, link, providerIndex) {
    const session = await signIn(email);
    const id = await openApplication(session.page, slug);
    await answerWritten(session.page);
    await session.page.locator('input[type="radio"][name$="_provider"]').nth(providerIndex).check();
    await session.page.locator('input[inputmode="url"]').fill(link);
    await session.page.locator('iframe[title="Preview of your video response"]').waitFor();
    await session.page.locator('button[type="submit"]:has-text("Submit application")').click();
    await session.page.waitForURL(new RegExp(`/applications/${id}\\?submitted=1`));
    return { ...session, id };
  }
  const youtubeStudent = await applyWithLink(STUDENTS.youtube, YOUTUBE, 2);
  check("YouTube link is accepted and previewed", (await youtubeStudent.page.locator("iframe").getAttribute("src")).includes("youtube-nocookie.com/embed/dQw4w9WgXcQ"));
  await youtubeStudent.page.waitForTimeout(3000);
  await shot(youtubeStudent.page, "06-student-youtube");
  const loomStudent = await applyWithLink(STUDENTS.loom, LOOM, 1);
  check("Loom link is accepted and previewed", (await loomStudent.page.locator("iframe").getAttribute("src")).includes("loom.com/embed/"));

  // ── Researcher watches all three ─────────────────────────────────────────────
  const reviewPage = researcher.page;
  const rangeResponses = [];
  reviewPage.on("response", (response) => {
    if (response.url().includes("/api/files/by-id/")) rangeResponses.push(response.status());
  });
  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${uploadAppId}`, { waitUntil: "networkidle" });
  state = await videoState(reviewPage);
  check("researcher can watch the uploaded file inside the platform", state.width === 320 && state.error === null, JSON.stringify(state));
  const played = await reviewPage.locator("video").first().evaluate(async (video) => {
    video.muted = true;
    await video.play();
    await new Promise((resolve) => setTimeout(resolve, 800));
    const during = video.currentTime;
    video.pause();
    return { during };
  });
  check("the video actually plays", played.during > 0.1, JSON.stringify(played));
  await shot(reviewPage, "07-researcher-watches-file");

  // Seeking needs Range. Fetch from the page, with the researcher's own cookie.
  const fileUrl = await reviewPage.locator("video").first().getAttribute("src");
  const ranged = await reviewPage.evaluate(async (url) => {
    const response = await fetch(url, { headers: { Range: "bytes=10-19" } });
    return { status: response.status, range: response.headers.get("content-range"), length: (await response.arrayBuffer()).byteLength };
  }, fileUrl);
  check("the file route answers Range requests", ranged.status === 206 && ranged.length === 10, JSON.stringify(ranged));
  const railHasVideo = await reviewPage.locator("aside").getByText("Video", { exact: true }).count();
  check("the applicant rail flags who sent a video", railHasVideo >= 3, `${railHasVideo} flagged`);

  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${youtubeStudent.id}`, { waitUntil: "networkidle" });
  const youtubeFrame = reviewPage.locator('iframe[src*="youtube-nocookie.com"]');
  check("researcher sees the YouTube video embedded", (await youtubeFrame.count()) === 1);
  await reviewPage.waitForTimeout(4000);
  const youtubeBody = await reviewPage.frameLocator('iframe[src*="youtube-nocookie.com"]').locator("body").innerText({ timeout: 15000 }).catch(() => "");
  check("the YouTube player really loaded in the frame", !/Error 15\d|refused to connect/i.test(youtubeBody) && youtubeBody.length > 0, youtubeBody.slice(0, 80).replace(/\s+/g, " "));
  await shot(reviewPage, "08-researcher-watches-youtube");

  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${loomStudent.id}`, { waitUntil: "networkidle" });
  check("researcher sees the Loom video embedded", (await reviewPage.locator('iframe[src*="loom.com/embed"]').count()) === 1);
  await reviewPage.waitForTimeout(3000);
  await shot(reviewPage, "09-researcher-watches-loom");

  // Another student must not be able to fetch the file.
  const outsider = await signIn("obrienk@example.edu");
  const denied = await outsider.page.evaluate(async (url) => (await fetch(url)).status, fileUrl);
  check("another student cannot open the uploaded video", denied === 403, `status ${denied}`);
  await outsider.context.close();

  // ── Accept ───────────────────────────────────────────────────────────────────
  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${uploadAppId}`, { waitUntil: "networkidle" });
  const acceptButton = reviewPage.getByRole("button", { name: /^Accept / });
  check("the Accept button is on the review page", await acceptButton.isVisible());
  await shot(reviewPage, "10-researcher-accept-button");
  const logBefore = fs.readFileSync(LOG, "utf8").length;
  await acceptButton.click();
  await reviewPage.locator("#accept-message").fill("Delighted to have you. We start the first week of May.");
  await shot(reviewPage, "11-researcher-accept-confirm");
  await reviewPage.getByRole("button", { name: "Confirm and accept" }).click();
  await reviewPage.getByText(/^You accepted /).waitFor();
  check("researcher sees the acceptance recorded", true);
  await shot(reviewPage, "12-researcher-accepted");
  await reviewPage.waitForTimeout(800);
  const mailLog = fs.readFileSync(LOG, "utf8").slice(logBefore);
  check("the acceptance email was sent", /You have been accepted/.test(mailLog));

  await reviewPage.reload({ waitUntil: "networkidle" });
  check("the status survives a reload", await reviewPage.getByText(/^You accepted /).isVisible());
  await reviewPage.locator("#applicant-filter").selectOption("accepted");
  await reviewPage.waitForTimeout(400);
  const railRows = await reviewPage.locator(`aside a[href*="/applicants/"]`).count();
  check("the rail can filter to accepted students", railRows === 1, `${railRows} shown`);

  // ── The student finds out ────────────────────────────────────────────────────
  await uploader.page.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
  check("the student has a notification", (await uploader.page.locator("body").innerText()).includes("You have been accepted"));
  await shot(uploader.page, "13-student-notification");
  await uploader.page.goto(`${BASE}/applications`, { waitUntil: "networkidle" });
  check("the student's list says Accepted", (await uploader.page.locator("body").innerText()).includes("Accepted"));
  await shot(uploader.page, "14-student-list");
  await uploader.page.goto(`${BASE}/applications/${uploadAppId}`, { waitUntil: "networkidle" });
  const studentBody = await uploader.page.locator("body").innerText();
  check("the student sees they were accepted", studentBody.includes("Congratulations, you have been accepted"));
  check("the student sees the researcher's note", studentBody.includes("first week of May"));
  await shot(uploader.page, "15-student-accepted");
  await uploader.page.getByRole("link", { name: /^Message / }).click();
  await uploader.page.waitForURL(/\/messages\//);
  await uploader.page.waitForLoadState("networkidle");
  check("the student can message the researcher", !(await uploader.page.locator("body").innerText()).includes("cannot message"));

  // Phone width, both sides of the new UI.
  const phone = await signIn(STUDENTS.upload, { width: 390, height: 844 });
  await phone.page.goto(`${BASE}/applications/${uploadAppId}`, { waitUntil: "networkidle" });
  const overflow = await phone.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check("the accepted page fits a phone", overflow <= 0, `${overflow}px overflow`);
  await shot(phone.page, "16-student-accepted-phone");
  await phone.context.close();

  // ── Mistakes and second thoughts ─────────────────────────────────────────────
  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${youtubeStudent.id}`, { waitUntil: "networkidle" });
  await reviewPage.getByRole("button", { name: /^Accept / }).click();
  await reviewPage.getByRole("button", { name: "Cancel" }).first().click();
  check("accepting can be cancelled before it is confirmed", await reviewPage.getByRole("button", { name: /^Accept / }).isVisible());
  await reviewPage.getByRole("button", { name: /^Accept / }).click();
  await reviewPage.getByRole("button", { name: "Confirm and accept" }).click();
  await reviewPage.getByText(/^You accepted /).waitFor();
  await reviewPage.getByRole("button", { name: "Accepted by mistake?" }).click();
  await reviewPage.getByRole("button", { name: "Withdraw the acceptance" }).click();
  await reviewPage.waitForTimeout(2500);
  await reviewPage.reload({ waitUntil: "networkidle" });
  check("a mistaken acceptance can be withdrawn", (await reviewPage.getByText(/^You accepted /).count()) === 0);
  await youtubeStudent.page.goto(`${BASE}/applications/${youtubeStudent.id}`, { waitUntil: "networkidle" });
  check("the student no longer sees an acceptance after that", !(await youtubeStudent.page.locator("body").innerText()).includes("Congratulations"));

  await reviewPage.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants/${loomStudent.id}`, { waitUntil: "networkidle" });
  await reviewPage.getByRole("button", { name: /^Accept / }).click();
  await reviewPage.getByRole("button", { name: "Confirm and accept" }).click();
  await reviewPage.getByText(/^You accepted /).waitFor();
  await loomStudent.page.goto(`${BASE}/applications/${loomStudent.id}`, { waitUntil: "networkidle" });
  await loomStudent.page.getByRole("button", { name: "Turn down this position" }).click();
  await loomStudent.page.getByText("You withdrew this application.").waitFor();
  check("an accepted student can turn the position down", true);

  // ── Our side ─────────────────────────────────────────────────────────────────
  const admin = await signIn(ADMIN);
  await admin.page.goto(`${BASE}/admin/acceptances`, { waitUntil: "networkidle" });
  const adminBody = await admin.page.locator("main, body").first().innerText();
  check("admin sees who was accepted, with contact details", adminBody.includes(STUDENTS.upload) && adminBody.includes(RESEARCHER));
  check("acceptances later reversed stay listed", adminBody.includes(STUDENTS.youtube) && adminBody.includes(STUDENTS.loom));
  await shot(admin.page, "17-admin-acceptances");
  const csv = await admin.page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, text: await response.text() };
  }, "/api/admin/export?dataset=acceptances");
  const header = csv.text.split(/\r?\n/)[0];
  check("the acceptances CSV downloads with who and when", csv.status === 200 && header.startsWith("accepted_at,current_status") && csv.text.includes(STUDENTS.upload), `${csv.text.split(/\r?\n/).length - 1} rows`);
  check("the CSV leaves out the private note", !csv.text.includes("first week of May"));
  // Reading a whole application is limited to one named operator, but the file route lets admins open files.
  const adminFile = await admin.page.evaluate(async (url) => (await fetch(url, { headers: { Range: "bytes=0-9" } })).status, fileUrl);
  check("an admin can open the uploaded video", adminFile === 206, `status ${adminFile}`);

  const researcherCsv = await reviewPage.evaluate(async () => (await fetch("/api/admin/export?dataset=acceptances")).status);
  check("a researcher cannot download the acceptances CSV", researcherCsv === 401 || researcherCsv === 403, `status ${researcherCsv}`);
  await reviewPage.goto(`${BASE}/admin/acceptances`, { waitUntil: "domcontentloaded" });
  check("a researcher cannot open the acceptances page", reviewPage.url().includes("/forbidden") || !(await reviewPage.locator("body").innerText()).includes(STUDENTS.upload));
} catch (caught) {
  check("the walkthrough finished", false, String(caught).slice(0, 600));
  for (const [index, context] of browser.contexts().entries()) {
    for (const [order, open] of context.pages().entries()) {
      await open.screenshot({ path: path.join(SHOTS, `failure-${index}-${order}.png`), fullPage: true }).catch(() => {});
      console.log(`  open at failure: ${open.url()}`);
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
if (pageErrors.length) console.log(`Page errors:\n  ${[...new Set(pageErrors)].join("\n  ")}`);
process.exit(failed.length || pageErrors.length ? 1 : 0);
