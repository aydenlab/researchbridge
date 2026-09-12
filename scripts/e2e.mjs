import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const LOG = process.env.RB_DEV_LOG;
const results = [];
const errors = [];

/**
 * Repeatable rows are added client side, so a click can land before the page
 * has hydrated and do nothing. Retry until the row the click should have made
 * exists.
 */
async function addRow(page, buttonText, rowSelector) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.click(`button:has-text("${buttonText}")`);
    try {
      await page.locator(rowSelector).waitFor({ state: "attached", timeout: 15000 });
      return;
    } catch {
      if (attempt === 3) throw new Error(`${buttonText} never produced ${rowSelector}`);
    }
  }
}

function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function signIn(context, email) {
  const page = await context.newPage();
  const before = fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").length : 0;
  await page.goto(`${BASE}/signin`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.click('form:has(#email) button[type="submit"]');
  await page.waitForSelector("#code", { timeout: 90000 });
  await page.waitForTimeout(900);
  const log = fs.readFileSync(LOG, "utf8").slice(before);
  const code = [...log.matchAll(/verification code is (\d{6})/g)].pop()?.[1];
  if (!code) throw new Error(`no code for ${email}`);
  await page.fill("#code", code);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/signin"), { timeout: 90000 }),
    page.click('form:has(#code) button[type="submit"]'),
  ]);
  await page.waitForTimeout(600);
  return page;
}

const browser = await chromium.launch();


async function fresh() {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  context.setDefaultTimeout(90000);
  context.setDefaultNavigationTimeout(120000);
  context.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    p.on("response", (r) => {
      if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
    });
  });
  return context;
}

try {
  const studentCtx = await fresh();
  const student = await signIn(studentCtx, "obrienk@example.edu");
  step("student signs in and lands on the dashboard", student.url().includes("/dashboard"), student.url());

  await student.goto(`${BASE}/opportunities`, { waitUntil: "domcontentloaded" });
  const total = await student.locator("article h3").count();
  step("opportunity discovery lists published positions", total > 0, `${total} cards`);

  await student.goto(`${BASE}/opportunities?compensation=paid`, { waitUntil: "domcontentloaded" });
  const paidCount = await student.locator("article h3").count();
  step("compensation filter narrows results", paidCount > 0 && paidCount < total, `${paidCount} paid of ${total}`);

  await student.goto(`${BASE}/opportunities?field=microbiology`, { waitUntil: "domcontentloaded" });
  const fieldCount = await student.locator("article h3").count();
  step("research field filter works", fieldCount > 0 && fieldCount <= total, `${fieldCount} in microbiology`);

  await student.goto(`${BASE}/opportunities?compensation=paid&flag=beginner&field=neuroscience&q=zzzznothing`, { waitUntil: "domcontentloaded" });
  const emptyCopy = await student.locator("text=No opportunities match every selected filter.").count();
  step("empty search state explains what to do", emptyCopy > 0);

  await student.goto(`${BASE}/opportunities`, { waitUntil: "domcontentloaded" });
  const cards = student.locator("article");
  let targetHref = null;
  for (let i = 0; i < (await cards.count()); i += 1) {
    const card = cards.nth(i);
    if ((await card.innerText()).includes("Applied")) continue;
    targetHref = await card.locator('h3 a[href*="/opportunities/"]').getAttribute("href");
    break;
  }
  step("found a position this student has not applied to", Boolean(targetHref), targetHref ?? "none");
  await student.goto(BASE + targetHref, { waitUntil: "domcontentloaded" });
  const hasCompensation = (await student.locator("text=Compensation").count()) > 0;
  const hasCriteria = (await student.locator("text=Who this researcher is looking for").count()) > 0;
  step("opportunity detail shows compensation and criteria before applying", hasCompensation && hasCriteria);

  const overlapPanel = await student.locator("text=Your profile overlaps with several things").count();
  step("student sees transparent overlap rather than a score", overlapPanel > 0);
  const scoreLeak = await student.locator("text=/\\d+% match|AI Score|AI says/i").count();
  step("no percentage match or AI score is shown to the student", scoreLeak === 0);

  await student.click('form:has(input[name="opportunityId"]) button:has-text("Save opportunity")');
  await student.waitForTimeout(1200);
  await student.goto(`${BASE}/saved`, { waitUntil: "domcontentloaded" });
  const savedCount = await student.locator("article h3").count();
  step("saving an opportunity persists to the saved page", savedCount > 0, `${savedCount} saved`);

  await student.goto(BASE + targetHref, { waitUntil: "domcontentloaded" });
  await Promise.all([
    student.waitForURL(/\/applications\/.*\/edit/, { timeout: 90000 }),
    student.click('button:has-text("Apply to this project")'),
  ]);
  await student.waitForTimeout(500);
  step("starting an application creates a draft", student.url().includes("/edit"), student.url());

  const profileIncluded = await student.locator("text=Your ResearchBridge profile will be included").count();
  step("application states that the profile is included", profileIncluded > 0);

  const textareas = student.locator('form textarea[name^="q_"]');
  const textareaCount = await textareas.count();
  for (let i = 0; i < textareaCount; i += 1) {
    await textareas.nth(i).fill(
      "I am in first year and have not done research before. What draws me to this project is that the questions are answerable with data that already exists, and I would like to learn how that data is actually assembled before I assume anything about what it shows.",
    );
  }
  const numbers = student.locator('form input[type="number"][name^="q_"]');
  for (let i = 0; i < (await numbers.count()); i += 1) await numbers.nth(i).fill("8");
  const selects = student.locator('form select[name^="q_"]');
  for (let i = 0; i < (await selects.count()); i += 1) await selects.nth(i).selectOption({ index: 1 });
  const shortInputs = student.locator('form input[type="text"][name^="q_"], form input:not([type])[name^="q_"]');
  for (let i = 0; i < (await shortInputs.count()); i += 1) await shortInputs.nth(i).fill("Fall and Winter");

  // A resume lives on the profile, and the seed does not give anyone one, so
  // the first application is where it gets uploaded.
  if ((await student.locator("#applicationResume").count()) > 0) {
    await student.setInputFiles("#applicationResume", {
      name: "student-resume.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 minimal fixture used only by the end to end suite. %%EOF"),
    });
    await student.click('button:has-text("Upload resume")');
    await student.waitForSelector("text=Resume attached", { timeout: 90000 });
  }
  const resumeAttached = await student.locator("text=Resume attached").count();
  step("a resume can be attached from the application itself", resumeAttached > 0);

  let draftSaved = false;
  try {
    await student.waitForSelector("text=Draft saved", { timeout: 90000 });
    draftSaved = true;
  } catch {
    draftSaved = false;
  }
  step("draft autosaves while typing", draftSaved);

  const applicationUrl = student.url();
  await Promise.all([
    student.waitForURL(/\/applications\/[^/]+\?submitted=1/, { timeout: 90000 }),
    student.click('button:has-text("Submit application")'),
  ]);
  await student.waitForTimeout(500);
  const confirmed = await student.locator("text=Application submitted").count();
  step("submitting shows a quiet confirmation", confirmed > 0);

  await student.goto(applicationUrl, { waitUntil: "domcontentloaded" });
  step("a submitted application can no longer be edited", !student.url().includes("/edit"), student.url());

  await student.goto(`${BASE}/applications`, { waitUntil: "domcontentloaded" });
  const listed = await student.locator("li h3").count();
  step("application appears on the applications page", listed > 0, `${listed} listed`);

  await student.goto(BASE + targetHref, { waitUntil: "domcontentloaded" });
  const alreadyApplied = await student.locator('a:has-text("View your application")').count();
  step("re-applying is blocked once submitted", alreadyApplied > 0);

  const adminBlocked = await student.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  step(
    "student is sent to a clean forbidden page for the admin panel",
    adminBlocked.status() === 200 && student.url().endsWith("/forbidden"),
    `${adminBlocked.status()} ${student.url()}`,
  );

  const researcherBlocked = await student.goto(`${BASE}/researcher/opportunities`, { waitUntil: "domcontentloaded" });
  step(
    "student is sent to a clean forbidden page for researcher pages",
    researcherBlocked.status() === 200 && student.url().endsWith("/forbidden"),
    `${researcherBlocked.status()} ${student.url()}`,
  );

  await studentCtx.close();

  const researcherCtx = await fresh();
  const researcher = await signIn(researcherCtx, "okonjoa@example.edu");
  step("researcher signs in and lands on their dashboard", researcher.url().includes("/researcher"), researcher.url());

  // Posting is one page and one submission. Everything the wizard used to walk
  // through in nine screens is either asked for here or added afterwards by
  // editing the position, which is what the rest of this block checks.
  await researcher.goto(`${BASE}/researcher/opportunities/new`, { waitUntil: "domcontentloaded" });
  await researcher.fill("#title", "Undergraduate Research Assistant, Respiratory Outcomes");
  await researcher.fill(
    "#summary",
    "Analyze routinely collected respiratory admission data to understand readmission patterns after discharge.",
  );
  await researcher.fill("#department", "Health Research Methods, Evidence, and Impact");
  await researcher.fill("#deadline", "2026-11-30");
  await researcher.locator('input[name="researchFieldId"]').first().check();
  await researcher.locator('input[name="outcomes"][value="authorship"]').check();
  await researcher.locator('input[name="skillName"][value="Python"]').check();
  await researcher.locator('input[name="preferredDurations"][value="one_semester"]').check();
  await researcher.locator('input[name="locationMode"][value="hybrid"]').check();
  await researcher.locator('input[name="compensation"][value="paid"]').check();
  await researcher.check('input[name="beginnerFriendly"]');

  await researcher.locator("#weightGpa").fill("20");
  await researcher.locator("#weightExtracurriculars").fill("0");
  await researcher.locator("#weightSkills").fill("90");
  await Promise.all([
    // The student-facing listing, not the researcher route the form lives on.
    researcher.waitForURL((url) => /^\/opportunities\/[^/]+$/.test(url.pathname), { timeout: 90000 }),
    researcher.click('button:has-text("Post opportunity")'),
  ]);
  step("the one page form publishes a listing in one submission", !researcher.url().includes("/researcher/"), researcher.url());

  const liveTitle = await researcher.locator("text=Undergraduate Research Assistant, Respiratory Outcomes").count();
  const queued = await researcher.locator("text=It is visible to you because you manage it").count();
  step("the posted listing is live rather than queued", liveTitle > 0 && queued === 0);

  const outcomeShown = await researcher.locator("text=Authorship").count();
  step("project outcomes reach the listing", outcomeShown > 0);

  // The sliders are the form's only account of what matters, so they have to
  // come out the other side as criteria rather than as a discarded input.
  const criteriaHeading = await researcher.locator("text=Who this researcher is looking for").count();
  const skillCriterion = await researcher.locator("text=High importance").count();
  const droppedWeight = await researcher.locator("text=Extracurricular involvement").count();
  step(
    "the weight sliders become criteria, and a slider at zero becomes nothing",
    criteriaHeading > 0 && skillCriterion > 0 && droppedWeight === 0,
    `${skillCriterion} weighted criteria`,
  );

  await researcher.goto(`${BASE}/researcher/opportunities`, { waitUntil: "domcontentloaded" });
  const postedRow = researcher.locator('li:has-text("Respiratory Outcomes")').first();
  const editHref = await postedRow.locator('a:has-text("Edit listing")').first().getAttribute("href");
  const opportunityId = editHref.split("/researcher/opportunities/")[1].split("/")[0];
  step("a posted position can be opened for editing", Boolean(opportunityId), editHref);

  // What the short form leaves out has to be reachable afterwards, because the
  // form tells the researcher it is.
  await researcher.goto(`${BASE}/researcher/opportunities/${opportunityId}/edit?step=4`, { waitUntil: "domcontentloaded" });
  const carriedCriterion = await researcher.locator('input[value="Python"]').count();
  step("the criteria editor opens on what the sliders wrote", carriedCriterion > 0);

  // Added alongside what the sliders wrote rather than on top of it: saving
  // this step rewrites every criterion from the form, so the existing rows have
  // to survive the round trip.
  const weightedRows = await researcher.locator('select[name="criterionType"]').count();
  await addRow(researcher, "Add criterion", `#criterionType-${weightedRows}`);
  await researcher.selectOption(`#criterionType-${weightedRows}`, "availability");
  await researcher.selectOption(`#criterionImportance-${weightedRows}`, "required");
  await researcher.fill(`#criterionLabel-${weightedRows}`, "Availability of at least 6 hours per week");
  await researcher.fill(`#criterionConfig-${weightedRows}`, "6");
  await Promise.all([researcher.waitForURL(/step=5/, { timeout: 90000 }), researcher.click('button:has-text("Save and continue")')]);
  step("a screening criterion can be added after posting", researcher.url().includes("step=5"));

  await researcher.goto(`${BASE}/researcher/opportunities/${opportunityId}/edit?step=4`, { waitUntil: "domcontentloaded" });
  const rowsAfterSave = await researcher.locator('select[name="criterionType"]').count();
  step(
    "editing criteria keeps the ones the sliders wrote",
    rowsAfterSave === weightedRows + 1,
    `${rowsAfterSave} of an expected ${weightedRows + 1}`,
  );
  await researcher.goto(`${BASE}/researcher/opportunities/${opportunityId}/edit?step=5`, { waitUntil: "domcontentloaded" });

  await addRow(researcher, "Add question", "#questionPrompt-0");
  await researcher.fill("#questionPrompt-0", "What interests you about respiratory outcomes research?");
  await Promise.all([researcher.waitForURL(/step=6/, { timeout: 90000 }), researcher.click('button:has-text("Save and continue")')]);

  await researcher.fill("#materialTitle", "Discharge documentation and ninety-day respiratory readmission");
  await researcher.fill("#materialUrl", "https://example.org/respiratory-readmission");
  await researcher.check('input[name="includePaperQuestion"]');
  await Promise.all([researcher.waitForURL(/step=7/, { timeout: 90000 }), researcher.click('button:has-text("Save and continue")')]);
  step("a paper and its prompt can be attached after posting", researcher.url().includes("step=7"));

  await Promise.all([researcher.waitForURL(/step=8/, { timeout: 90000 }), researcher.click('button:has-text("Save and continue")')]);
  const previewTitle = await researcher.locator("text=Undergraduate Research Assistant, Respiratory Outcomes").count();
  const previewNotice = await researcher.locator("text=This is the student-facing listing exactly as it will appear.").count();
  step("the preview shows the student-facing listing", previewTitle > 0 && previewNotice > 0);

  await researcher.goto(`${BASE}/opportunities?q=Respiratory`, { waitUntil: "domcontentloaded" });
  const visibleToStudents = await researcher.locator("text=Undergraduate Research Assistant, Respiratory Outcomes").count();
  step("the published position appears in student discovery", visibleToStudents > 0);

  await researcher.goto(`${BASE}/researcher/opportunities/${opportunityId}/applicants`, { waitUntil: "domcontentloaded" });
  const emptyApplicants = await researcher.locator("text=No applications yet.").count();
  step("a position with no applicants shows an honest empty state", emptyApplicants > 0);

  await researcher.goto(`${BASE}/researcher/opportunities`, { waitUntil: "domcontentloaded" });
  const rows = researcher.locator("li:has(a:has-text(\"Review applicants\"))");
  let reviewHref = null;
  for (let i = 0; i < (await rows.count()); i += 1) {
    const row = rows.nth(i);
    const text = (await row.innerText()).replace(/\s+/g, " ");
    if (/(^| )0 applications( |$)/.test(text)) continue;
    reviewHref = await row.locator('a:has-text("Review applicants")').getAttribute("href");
    break;
  }
  step("found one of the researcher's positions that has applicants", Boolean(reviewHref), reviewHref ?? "none");

  await researcher.goto(BASE + reviewHref, { waitUntil: "domcontentloaded" });
  const applicantLink = await researcher.locator('aside a[href*="/applicants/"]').first().getAttribute("href");
  await researcher.goto(BASE + applicantLink, { waitUntil: "domcontentloaded" });
  await researcher.waitForTimeout(900);



  const alignment = await researcher.locator("text=Criteria alignment").count();
  const evidenceLine = await researcher.locator("text=Requested:").count();
  step("candidate review shows criterion evidence", alignment > 0 && evidenceLine > 0, `${evidenceLine} criteria`);

  const noPenaltyLanguage = await researcher.locator("text=/lost \\d+ points|deducted/i").count();
  step("no point-deduction language appears anywhere in review", noPenaltyLanguage === 0);

  await researcher.fill("#note", "Strong on the missingness question. Ask about the Wednesday meeting before deciding.");
  await researcher.click('button:has-text("Save note")');
  await researcher.waitForTimeout(1500);
  const noteSaved = await researcher.locator("text=Strong on the missingness question").count();
  step("researcher can add a private note", noteSaved > 0);

  await researcher.click('button:has-text("Shortlisted")');
  await researcher.waitForTimeout(1800);
  const shortlisted = await researcher.locator("text=Marked shortlisted").count();
  step("researcher can update the application status", shortlisted > 0);

  await researcher.click('button:has-text("Contact student")');
  await researcher.waitForTimeout(400);
  await researcher.click('button:has-text("Send and mark as contacted")');
  await researcher.waitForTimeout(2200);
  const contacted = await researcher.locator("text=The student has been notified").count();
  step("researcher can contact a student", contacted > 0);

  const nextButton = await researcher.locator('a:has-text("Next")').count();
  step("applicant navigation offers next and previous", nextButton > 0);

  await researcher.goto(`${BASE}/researcher/opportunities`, { waitUntil: "domcontentloaded" });
  await researcher.locator('form:has(input[value="closed"]) button:has-text("Close position")').first().click();
  await researcher.waitForTimeout(1800);
  const closed = await researcher.locator("text=Position closed").count();
  step("researcher can close a position", closed > 0);

  const otherApplicants = await researcher.goto(`${BASE}/researcher/opportunities/00000000-0000-4000-8000-000000000000/applicants`, {
    waitUntil: "networkidle",
  });
  step("researcher cannot open applicants for a position they do not own", otherApplicants.status() >= 400, `${otherApplicants.status()}`);

  await researcherCtx.close();

  const adminCtx = await fresh();
  const admin = await signIn(adminCtx, "admin@myresearchbridge.com");
  step("admin signs in and lands on the overview", admin.url().includes("/admin"), admin.url());

  const placements = await admin.locator("text=Confirmed placements").count();
  const notMeasurable = await admin.locator("text=Not yet measurable").count();
  const timingPanel = await admin.locator("text=Time to first researcher action").count();
  step(
    "pilot metrics render every section",
    placements > 0 && timingPanel > 0,
    `${placements} placement labels, ${timingPanel} timing labels`,
  );
  step("metrics mark what cannot be measured yet instead of estimating", notMeasurable > 0, `${notMeasurable} marked unknown`);
  const negative = await admin.locator("text=/-\d+(\.\d+)? (hours|days)/").count();
  step("no metric reports a negative duration", negative === 0);

  await admin.goto(`${BASE}/admin/researchers`, { waitUntil: "domcontentloaded" });
  const awaitingPanel = admin.locator("section:has(h2:text-is('Awaiting review'))");
  const pendingBefore = await awaitingPanel.locator("li").count();
  step("pending researcher accounts are listed for approval", pendingBefore > 0, `${pendingBefore} pending`);

  await awaitingPanel.locator('button:has-text("Approve")').first().click();
  await admin.waitForTimeout(2500);
  const pendingAfter = await awaitingPanel.locator("li").count();
  step("admin can approve a researcher", pendingAfter < pendingBefore, `${pendingBefore} to ${pendingAfter} awaiting`);

  await admin.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
  const userRows = await admin.locator("table tbody tr").count();
  step("admin can inspect users", userRows > 0, `${userRows} rows`);

  await admin.goto(`${BASE}/admin/opportunities`, { waitUntil: "domcontentloaded" });
  const listingRows = await admin.locator("table tbody tr").count();
  step("admin can inspect every listing", listingRows > 0, `${listingRows} rows`);

  await admin.goto(`${BASE}/admin/institutions`, { waitUntil: "domcontentloaded" });
  const institutionForms = await admin.locator('input[name="domains"]').count();
  step("admin can manage institutions and their email domains", institutionForms > 0);

  await admin.goto(`${BASE}/admin/taxonomies`, { waitUntil: "domcontentloaded" });
  const taxonomyAdd = await admin.locator("#add-skill").count();
  step("admin can manage the skill and field taxonomies", taxonomyAdd > 0);

  await admin.goto(`${BASE}/admin/system`, { waitUntil: "domcontentloaded" });
  const flagCount = await admin.locator('input[name="key"]').count();
  step("admin can see and toggle feature flags", flagCount >= 5, `${flagCount} flags`);

  const systemText = await admin.locator("body").innerText();
  step(
    "admin can see Claude spend against its budget",
    /Spend today[\s\S]*?\$/.test(systemText) && /Spend this month[\s\S]*?\$/.test(systemText),
    systemText.match(/Spend today\s*\S+ of \S+/)?.[0] ?? "not found",
  );
  step(
    "admin can see the prompt cache hit rate and budget state",
    /Prompt cache hit rate/.test(systemText) && /(Within limits|limit reached)/.test(systemText),
    systemText.match(/Prompt cache hit rate\s*[^\n]+/)?.[0] ?? "not found",
  );

  const exportResponse = await admin.request.get(`${BASE}/api/admin/export?dataset=applications`);
  const csv = await exportResponse.text();
  step(
    "admin can export pilot data as CSV",
    exportResponse.ok() && csv.split("\r\n").length > 1 && csv.startsWith("opportunity_title,"),
    `${csv.split("\r\n").length - 1} rows`,
  );

  await adminCtx.close();

  const anonCtx = await fresh();
  const anon = await anonCtx.newPage();
  for (const path of ["/", "/about", "/how-it-works", "/for-researchers", "/faq", "/contact", "/privacy", "/terms", "/accessibility", "/waitlist", "/researchers/interest", "/opportunities"]) {
    const response = await anon.goto(BASE + path, { waitUntil: "domcontentloaded" });
    step(`public page ${path} renders`, response.status() === 200, `${response.status()}`);
  }

  await anon.goto(`${BASE}/waitlist`, { waitUntil: "domcontentloaded" });
  await anon.fill("#firstName", "Priya");
  await anon.fill("#lastName", "Raghunathan");
  await anon.fill("#email", `waitlist-${Date.now()}@example.edu`);
  await anon.fill("#program", "Bachelor of Health Sciences");
  await anon.check('input[name="contactConsent"]');
  await anon.click('button:has-text("Join the pilot waitlist")');
  await anon.waitForTimeout(2200);
  const waitlisted = await anon.locator("text=You are on the list").count();
  step("public waitlist accepts a submission", waitlisted > 0);

  const dashboardRedirect = await anon.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  step("signed out visitors are redirected away from the dashboard", anon.url().includes("/signin"), anon.url());

  const healthResponse = await anon.request.get(`${BASE}/api/health`);
  const healthBody = await healthResponse.text();
  const health = JSON.parse(healthBody);
  const leaks = /postgres|railway\.internal|password|sslmode|ENOTFOUND|ECONNREFUSED|at .*\.ts:|node_modules/i;
  step(
    "health endpoint stays up and reports database reachability",
    healthResponse.status() === 200 && health.status === "ok" && health.database === "connected",
    `${healthResponse.status()} ${healthBody}`,
  );
  step("health endpoint leaks no infrastructure detail", !leaks.test(healthBody), healthBody);

  const readyResponse = await anon.request.get(`${BASE}/api/ready`);
  const readyBody = await readyResponse.text();
  step("readiness endpoint reports ready when the database is migrated", readyResponse.status() === 200, readyBody);
  step("readiness endpoint leaks no infrastructure detail to anonymous callers", !leaks.test(readyBody), readyBody);

  const robots = await (await anon.request.get(`${BASE}/robots.txt`)).text();
  step("robots excludes authenticated areas", robots.includes("/admin") && robots.includes("/applications"));

  const sitemap = await (await anon.request.get(`${BASE}/sitemap.xml`)).text();
  step("sitemap lists public pages and published positions", sitemap.includes("/opportunities/") && sitemap.includes("/faq"));

  await anonCtx.close();
} catch (error) {
  step("suite completed without throwing", false, String(error).slice(0, 300));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (errors.length > 0) {
  console.log(`\nRuntime errors observed (${errors.length}):`);
  for (const e of [...new Set(errors)].slice(0, 12)) console.log("  " + e);
}
if (failed.length > 0) process.exitCode = 1;
