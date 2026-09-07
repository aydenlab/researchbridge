/**
 * Creates one published demo opportunity, the institution it belongs to, a
 * fictional supervising researcher, and a fictional student account.
 *
 * This exists because src/db/seed.ts cannot run against a real deployment: it
 * deletes before it inserts and would destroy live accounts. Everything here is
 * additive and keyed on unique columns, so re-running is a no-op.
 *
 * Run with DEMO_CONTENT_ENABLED=true on boot, or `npm run db:demo` locally.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index";
import * as s from "../src/db/schema";

const INSTITUTION_SLUG = "mcmaster";
const RESEARCHER_EMAIL = "demo.researcher@mcmaster.ca";
const STUDENT_EMAIL = "demo.student@mcmaster.ca";
const OPPORTUNITY_SLUG = "wearable-sensors-for-post-stroke-gait-recovery-demo";

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

async function main() {
  // Institution ---------------------------------------------------------
  let institution = (
    await db.select().from(s.institutions).where(eq(s.institutions.slug, INSTITUTION_SLUG)).limit(1)
  )[0];

  if (!institution) {
    [institution] = await db
      .insert(s.institutions)
      .values({
        name: "McMaster University",
        slug: INSTITUTION_SLUG,
        shortName: "McMaster",
        location: "Hamilton, Ontario",
        gpaScaleName: "12 point",
        gpaScaleMax: "12",
        active: true,
        isPilot: true,
      })
      .returning();
    log("demo_institution_created", { id: institution.id });
  }

  const existingDomains = await db
    .select()
    .from(s.institutionEmailDomains)
    .where(eq(s.institutionEmailDomains.institutionId, institution.id));
  if (!existingDomains.some((row) => row.domain === "mcmaster.ca")) {
    await db.insert(s.institutionEmailDomains).values({ institutionId: institution.id, domain: "mcmaster.ca" });
  }

  // Faculties and departments -------------------------------------------
  const facultyNames = ["Health Sciences", "Science", "Engineering"];
  const existingFaculties = await db
    .select()
    .from(s.institutionFaculties)
    .where(eq(s.institutionFaculties.institutionId, institution.id));
  const missingFaculties = facultyNames.filter((name) => !existingFaculties.some((f) => f.name === name));
  if (missingFaculties.length > 0) {
    await db.insert(s.institutionFaculties).values(
      missingFaculties.map((name, index) => ({
        institutionId: institution.id,
        name,
        sortOrder: existingFaculties.length + index,
      })),
    );
  }
  const faculties = await db
    .select()
    .from(s.institutionFaculties)
    .where(eq(s.institutionFaculties.institutionId, institution.id));
  const healthSciences = faculties.find((f) => f.name === "Health Sciences");

  const existingDepartments = await db
    .select()
    .from(s.institutionDepartments)
    .where(eq(s.institutionDepartments.institutionId, institution.id));
  for (const name of ["Kinesiology", "Rehabilitation Science", "Health Research Methods"]) {
    if (!existingDepartments.some((d) => d.name === name)) {
      await db.insert(s.institutionDepartments).values({
        institutionId: institution.id,
        facultyId: healthSciences?.id ?? null,
        name,
      });
    }
  }

  // Courses --------------------------------------------------------------
  const courseSeeds: [string, string, string][] = [
    ["KINESIOL 2CC3", "Human Physiology", "Kinesiology"],
    ["KINESIOL 3E03", "Biomechanics", "Kinesiology"],
    ["STATS 2B03", "Statistical Methods for Science", "Statistics"],
    ["HTHSCI 2G03", "Introduction to Health Research Methods", "Health Sciences"],
    ["COMPSCI 1MD3", "Introduction to Programming", "Computing and Software"],
  ];
  const existingCourses = await db.select().from(s.courses).where(eq(s.courses.institutionId, institution.id));
  const missingCourses = courseSeeds.filter(([code]) => !existingCourses.some((c) => c.courseCode === code));
  if (missingCourses.length > 0) {
    await db.insert(s.courses).values(
      missingCourses.map(([courseCode, courseName, department]) => ({
        institutionId: institution.id,
        courseCode,
        courseName,
        department,
      })),
    );
  }
  const courses = await db.select().from(s.courses).where(eq(s.courses.institutionId, institution.id));
  const courseByCode = new Map(courses.map((c) => [c.courseCode, c.id]));

  // Taxonomy lookups -----------------------------------------------------
  const allFields = await db.select().from(s.researchFields);
  const fieldBySlug = new Map(allFields.map((f) => [f.slug, f.id]));
  const allSkills = await db.select().from(s.skills);
  const skillBySlug = new Map(allSkills.map((k) => [k.slug, k.id]));

  const requiredFieldSlugs = ["rehabilitation-science", "kinesiology", "neuroscience"];
  const missingFieldSlugs = requiredFieldSlugs.filter((slug) => !fieldBySlug.has(slug));
  if (missingFieldSlugs.length > 0) {
    throw new Error(
      `Research field taxonomy is missing ${missingFieldSlugs.join(", ")}. Apply migrations before running this.`,
    );
  }

  const now = new Date();

  // Researcher -----------------------------------------------------------
  let researcher = (await db.select().from(s.users).where(eq(s.users.email, RESEARCHER_EMAIL)).limit(1))[0];
  if (!researcher) {
    [researcher] = await db
      .insert(s.users)
      .values({
        email: RESEARCHER_EMAIL,
        role: "researcher",
        accountStatus: "active",
        institutionId: institution.id,
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
      })
      .returning();
    await db.insert(s.researcherProfiles).values({
      userId: researcher.id,
      firstName: "Priya",
      lastName: "Raman",
      researcherType: "faculty",
      title: "Associate Professor",
      department: "Kinesiology",
      faculty: "Health Sciences",
      labName: "Mobility and Recovery Lab",
      labWebsite: "https://example.mcmaster.ca/mobility-recovery-lab",
      biography:
        "Priya Raman studies how people relearn to walk after a stroke, and how wearable sensors can measure that recovery outside a clinic. This is a demonstration profile used to show how a ResearchBridge posting looks when it is fully filled in.",
      recruitingOnBehalfOf: "personally",
      verificationStatus: "verified",
      approvedAt: now,
      onboardingStep: 4,
    });
    await db.insert(s.researcherFields).values(
      ["rehabilitation-science", "kinesiology", "neuroscience"].map((slug) => ({
        researcherId: researcher.id,
        researchFieldId: fieldBySlug.get(slug) as string,
      })),
    );
    log("demo_researcher_created", { id: researcher.id });
  }

  // Student --------------------------------------------------------------
  let student = (await db.select().from(s.users).where(eq(s.users.email, STUDENT_EMAIL)).limit(1))[0];
  if (!student) {
    [student] = await db
      .insert(s.users)
      .values({
        email: STUDENT_EMAIL,
        role: "student",
        accountStatus: "active",
        institutionId: institution.id,
        emailVerifiedAt: now,
        onboardingCompletedAt: now,
      })
      .returning();
    await db.insert(s.studentProfiles).values({
      userId: student.id,
      firstName: "Jordan",
      lastName: "Whitfield",
      degreeLevel: "undergraduate",
      program: "Kinesiology",
      faculty: "Health Sciences",
      specialization: "Biomechanics",
      yearLevel: 3,
      graduationYear: now.getUTCFullYear() + 1,
      bio: "Third-year kinesiology student. Demonstration account used to show a completed ResearchBridge student profile.",
      researchInterestSummary:
        "Interested in how movement changes after neurological injury, and in the measurement problems that come with taking gait analysis out of the lab.",
      desiredStartDate: isoDate(30),
      weeklyHours: 10,
      semesters: ["Fall", "Winter"],
      summerAvailable: true,
      locationPreference: "in_person",
      distinctions: "Dean's Honour List, two consecutive years.",
      profileCompletion: 100,
      onboardingStep: 6,
    });

    // The "marks" a posting can screen on.
    await db.insert(s.studentAcademicRecords).values({
      studentId: student.id,
      metricType: "institution_scale",
      value: "10.50",
      scaleMax: "12",
      institutionScaleName: "12 point",
      label: "Cumulative average",
    });

    await db.insert(s.studentResearchInterests).values(
      ["rehabilitation-science", "kinesiology", "neuroscience"].map((slug) => ({
        studentId: student.id,
        researchFieldId: fieldBySlug.get(slug) as string,
      })),
    );

    const studentSkills: [string, "exposure" | "working" | "proficient" | "advanced"][] = [
      ["python", "working"],
      ["data-analysis", "working"],
      ["statistics", "exposure"],
      ["literature-reviews", "working"],
    ];
    const resolvedSkills = studentSkills.filter(([slug]) => skillBySlug.has(slug));
    if (resolvedSkills.length > 0) {
      await db.insert(s.studentSkills).values(
        resolvedSkills.map(([slug, level]) => ({
          studentId: student.id,
          skillId: skillBySlug.get(slug) as string,
          proficiency: level,
        })),
      );
    }

    const studentCourses: [string, string][] = [
      ["KINESIOL 2CC3", "A"],
      ["KINESIOL 3E03", "A-"],
      ["STATS 2B03", "B+"],
    ];
    const resolvedCourses = studentCourses.filter(([code]) => courseByCode.has(code));
    if (resolvedCourses.length > 0) {
      await db.insert(s.studentCourses).values(
        resolvedCourses.map(([code, grade]) => ({
          studentId: student.id,
          courseId: courseByCode.get(code) as string,
          grade,
          status: "completed" as const,
        })),
      );
    }
    log("demo_student_created", { id: student.id });
  }

  // Opportunity ----------------------------------------------------------
  const existingOpportunity = (
    await db.select().from(s.opportunities).where(eq(s.opportunities.slug, OPPORTUNITY_SLUG)).limit(1)
  )[0];
  if (existingOpportunity) {
    log("demo_opportunity_exists", { id: existingOpportunity.id });
    process.exit(0);
  }

  const [opportunity] = await db
    .insert(s.opportunities)
    .values({
      institutionId: institution.id,
      researcherId: researcher.id,
      title: "Wearable Sensors for Post-Stroke Gait Recovery",
      slug: OPPORTUNITY_SLUG,
      summary:
        "Help measure how stroke survivors relearn to walk, using wearable sensors recorded at home rather than in a gait lab.",
      description:
        "Our lab follows stroke survivors through the first year of rehabilitation. Participants wear small inertial sensors on the ankle and lower back during ordinary daily activity, and we compare what those sensors record at home against the formal gait assessments done in clinic. The gap between the two is the interesting part: people often walk quite differently once nobody is watching.\n\nYou would join a team of two graduate students and one other undergraduate. This is a demonstration posting created to show how a fully completed ResearchBridge opportunity appears.",
      responsibilities:
        "Process raw sensor recordings into per-session gait summaries using our existing Python pipeline.\nCross-check automatically detected walking bouts against video for a sample of sessions.\nMaintain the participant tracking sheet and flag missing or corrupted recordings.\nAttend the Wednesday afternoon lab meeting and present findings once per term.",
      projectGoals:
        "Establish whether at-home gait asymmetry predicts clinical recovery scores better than in-clinic measurement alone, and produce a cleaned dataset the lab can reuse for future analyses.",
      techniques:
        "Inertial measurement unit (IMU) data collection, signal filtering, gait event detection, Python and pandas, basic statistical comparison of paired measures.",
      expectedOutputs:
        "A cleaned and documented dataset, a short internal methods report, and co-authorship on a conference abstract if the analysis holds up.",
      learningOpportunities:
        "You will learn how a longitudinal clinical study is actually run, how to work with noisy sensor data, and how to tell a real signal from an artifact. Training is provided for everything technical.",
      department: "Kinesiology",
      labName: "Mobility and Recovery Lab",
      status: "published",
      numberOfOpenings: 2,
      locationMode: "hybrid",
      location: "Ivor Wynne Centre, McMaster University",
      startDate: isoDate(45),
      duration: "Two terms, with the option to continue into the summer",
      hoursPerWeekMin: 8,
      hoursPerWeekMax: 12,
      deadline: isoDate(28),
      compensationType: "paid",
      compensationDetails: "Paid at the standard undergraduate research assistant rate, 8 to 12 hours per week.",
      academicCreditAvailable: true,
      beginnerFriendly: true,
      priorResearchRequired: false,
      viewCount: 0,
      draftStep: 9,
      publishedAt: now,
    })
    .returning();

  await db
    .insert(s.opportunityDurations)
    .values((["two_semesters", "summer_only"] as const).map((duration) => ({ opportunityId: opportunity.id, duration })));

  await db.insert(s.opportunityFields).values(
    ["rehabilitation-science", "kinesiology", "neuroscience"].map((slug) => ({
      opportunityId: opportunity.id,
      researchFieldId: fieldBySlug.get(slug) as string,
    })),
  );

  const opportunitySkills: [string, "required" | "preferred" | "not_required"][] = [
    ["python", "preferred"],
    ["data-analysis", "preferred"],
    ["statistics", "not_required"],
    ["data-visualization", "not_required"],
  ];
  const resolvedOpportunitySkills = opportunitySkills.filter(([slug]) => skillBySlug.has(slug));
  if (resolvedOpportunitySkills.length > 0) {
    await db.insert(s.opportunitySkills).values(
      resolvedOpportunitySkills.map(([slug, requirementLevel]) => ({
        opportunityId: opportunity.id,
        skillId: skillBySlug.get(slug) as string,
        requirementLevel,
      })),
    );
  }

  await db.insert(s.opportunityCriteria).values([
    {
      opportunityId: opportunity.id,
      type: "academic_metric" as const,
      label: "Cumulative average of at least 9.0 on the 12 point scale",
      description:
        "This is a screening threshold, not a ranking. Everyone at or above it is read the same way.",
      required: true,
      importance: "required" as const,
      config: { metricType: "institution_scale", minValue: 9, scaleMax: 12 },
      sortOrder: 0,
    },
    {
      opportunityId: opportunity.id,
      type: "availability" as const,
      label: "Availability of at least 8 hours per week",
      description: "The Wednesday afternoon lab meeting is the one fixed commitment.",
      required: true,
      importance: "required" as const,
      config: { minHoursPerWeek: 8 },
      sortOrder: 1,
    },
    {
      opportunityId: opportunity.id,
      type: "year_level" as const,
      label: "Second year or beyond",
      description: "Enough coursework to have seen basic mechanics and statistics.",
      required: false,
      importance: "high" as const,
      config: { minYear: 2 },
      sortOrder: 2,
    },
    {
      opportunityId: opportunity.id,
      type: "skill" as const,
      label: "Python",
      description: "Enough to read an existing script and change it without breaking it. No need to write from scratch.",
      required: false,
      importance: "high" as const,
      config: { skillSlug: "python", skillName: "Python" },
      sortOrder: 3,
    },
    {
      opportunityId: opportunity.id,
      type: "coursework" as const,
      label: "Introductory statistics or biomechanics",
      description: "STATS 2B03 or KINESIOL 3E03, or an equivalent from another program.",
      required: false,
      importance: "medium" as const,
      config: { courseCodes: ["STATS 2B03", "KINESIOL 3E03"] },
      sortOrder: 4,
    },
    {
      opportunityId: opportunity.id,
      type: "research_interest" as const,
      label: "Interest in rehabilitation or movement science",
      description: null,
      required: false,
      importance: "medium" as const,
      config: { fieldSlugs: ["rehabilitation-science", "kinesiology"], keywords: ["gait", "stroke", "recovery"] },
      sortOrder: 5,
    },
  ]);

  await db.insert(s.opportunityQuestions).values([
    {
      opportunityId: opportunity.id,
      type: "long_text" as const,
      prompt: "What draws you to this project specifically, rather than research in general?",
      helpText: "A few sentences is plenty. We would rather read something honest than something polished.",
      required: true,
      config: { maxLength: 1200 },
      sortOrder: 0,
    },
    {
      opportunityId: opportunity.id,
      type: "long_text" as const,
      prompt:
        "Describe a time you worked with messy data or an experiment that did not go to plan. What did you do about it?",
      helpText: "Coursework, a personal project, or a job all count.",
      required: true,
      config: { maxLength: 1200 },
      sortOrder: 1,
    },
    {
      opportunityId: opportunity.id,
      type: "numeric" as const,
      prompt: "How many hours per week can you realistically commit?",
      helpText: "Answer honestly. Overcommitting helps nobody.",
      required: true,
      config: { min: 0, max: 40 },
      sortOrder: 2,
    },
    {
      opportunityId: opportunity.id,
      type: "yes_no" as const,
      prompt: "Are you available for the Wednesday afternoon lab meeting?",
      helpText: null,
      required: true,
      config: {},
      sortOrder: 3,
    },
  ]);

  log("demo_opportunity_created", { id: opportunity.id, slug: OPPORTUNITY_SLUG });
  process.exit(0);
}

main().catch((error) => {
  console.error("demo content failed", error);
  process.exit(1);
});
