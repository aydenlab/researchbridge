/**
 * Attaches a fully populated demo posting, and a set of demo applicants, to a
 * real researcher account.
 *
 * The account is named by DEMO_RESEARCHER_EMAIL. It must already exist; this
 * script will fill in whatever that account is missing (institution link,
 * researcher role, approved profile) so the posting can be created, but it will
 * not invent the account itself.
 *
 * Everything is additive and keyed on unique columns, so re-running is a no-op.
 * Run with `DEMO_RESEARCHER_EMAIL=... npm run db:demo:applicants`.
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/index";
import * as s from "../src/db/schema";
import { evaluateDeterministic } from "../src/lib/criteria/engine";
import { persistCriterionResults } from "../src/lib/queries/applications";
import { loadStudentProfile, toApplicantEvidence } from "../src/lib/queries/student";
import type { Criterion } from "../src/lib/criteria/types";

const RESEARCHER_EMAIL = (process.env.DEMO_RESEARCHER_EMAIL ?? "").trim().toLowerCase();
const OPPORTUNITY_SLUG = "sleep-disruption-and-memory-consolidation-demo";
const INSTITUTION_SLUG = "mcmaster";

function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

type Applicant = {
  email: string;
  firstName: string;
  lastName: string;
  program: string;
  faculty: string;
  specialization: string;
  yearLevel: number;
  average: string;
  weeklyHours: number;
  bio: string;
  interestSummary: string;
  distinctions: string | null;
  skills: [string, "exposure" | "working" | "proficient" | "advanced"][];
  courses: [string, string][];
  interests: string[];
  experience: {
    organization: string;
    supervisor: string;
    title: string;
    startDays: number;
    endDays: number;
    description: string;
    techniques: string[];
    outputs: string[];
  } | null;
  status: "submitted" | "under_review" | "shortlisted";
  answers: string[];
  hours: number;
  wednesday: boolean;
};

const APPLICANTS: Applicant[] = [
  {
    email: "demo.applicant.osei@mcmaster.ca",
    firstName: "Amara",
    lastName: "Osei",
    program: "Honours Neuroscience",
    faculty: "Science",
    specialization: "Cognitive Neuroscience",
    yearLevel: 4,
    average: "11.20",
    weeklyHours: 14,
    bio: "Fourth-year neuroscience student finishing an honours thesis on memory consolidation. Demonstration account.",
    interestSummary:
      "I want to understand why a night of poor sleep costs you a day of learning, and whether that cost is recoverable.",
    distinctions: "Dean's Honour List three years running. NSERC USRA recipient last summer.",
    skills: [
      ["python", "advanced"],
      ["r", "proficient"],
      ["statistics", "proficient"],
      ["data-analysis", "advanced"],
      ["neuroimaging-analysis", "working"],
      ["scientific-writing", "proficient"],
    ],
    courses: [
      ["PSYCH 2H03", "A+"],
      ["PSYCH 3M03", "A"],
      ["STATS 2B03", "A"],
      ["COMPSCI 1MD3", "A-"],
    ],
    interests: ["neuroscience", "psychology"],
    experience: {
      organization: "McMaster Cognitive Science Laboratory",
      supervisor: "Dr. H. Lindqvist",
      title: "NSERC Undergraduate Research Award student",
      startDays: -420,
      endDays: -300,
      description:
        "Ran a 40-participant working memory study end to end: recruitment, EEG setup, artifact rejection, and the first pass of the analysis. Wrote the preprocessing pipeline the lab still uses.",
      techniques: ["EEG", "Signal preprocessing", "Python", "Mixed effects models"],
      outputs: ["Poster at the Canadian Association for Neuroscience meeting", "Internal methods documentation"],
    },
    status: "shortlisted",
    answers: [
      "I spent last summer watching people fail a memory task and not knowing whether it was the task, the electrodes, or the fact that half of them had been up until three. That last possibility is the one nobody controlled for, and it is the one this project takes seriously. I would like to work on the part I previously had to treat as noise.",
      "My EEG preprocessing pipeline silently dropped about a fifth of the trials for four participants. I only caught it because one person's data looked too clean. The cause was a hard-coded voltage threshold that made sense for adults and not for our two youngest participants. I rewrote it to compute the threshold per participant, reprocessed everything, and added a summary that prints how many trials each person lost so it cannot hide again.",
      "14",
      "yes",
    ],
    hours: 14,
    wednesday: true,
  },
  {
    email: "demo.applicant.krishnan@mcmaster.ca",
    firstName: "Daniel",
    lastName: "Krishnan",
    program: "Health Sciences",
    faculty: "Health Sciences",
    specialization: "Human Behaviour",
    yearLevel: 3,
    average: "10.10",
    weeklyHours: 10,
    bio: "Third-year health sciences student interested in sleep and clinical outcomes. Demonstration account.",
    interestSummary:
      "Interested in how sleep quality shows up in ordinary clinical measures, and in whether wearable data adds anything a questionnaire does not.",
    distinctions: "Dean's Honour List, two years.",
    skills: [
      ["python", "working"],
      ["statistics", "working"],
      ["data-analysis", "working"],
      ["literature-reviews", "proficient"],
      ["survey-design", "working"],
    ],
    courses: [
      ["HTHSCI 2G03", "A-"],
      ["STATS 2B03", "B+"],
      ["PSYCH 2H03", "A-"],
    ],
    interests: ["psychology", "public-health", "neuroscience"],
    experience: {
      organization: "Hamilton Health Sciences",
      supervisor: "Dr. M. Abbas",
      title: "Volunteer research assistant",
      startDays: -240,
      endDays: -60,
      description:
        "Chart review for a retrospective study on post-operative delirium. Extracted and coded 300 patient records against a standard rubric, and flagged inconsistencies in how sleep medication was documented.",
      techniques: ["Chart review", "REDCap", "Descriptive statistics"],
      outputs: ["Cleaned dataset used in a manuscript under review"],
    },
    status: "under_review",
    answers: [
      "The chart review I did last year kept running into the same wall: sleep was recorded as a yes or no, if it was recorded at all. Then we would try to explain outcomes that obviously depended on it. Measuring sleep properly and seeing what it predicts is the version of that work I actually wanted to be doing.",
      "In the delirium review, two of us coded the same 50 charts and disagreed on nearly a third of them. Rather than average it away we sat down and found that the rubric was ambiguous about what counted as an overnight disturbance. We rewrote that definition, recoded everything from the start, and reported the agreement rate honestly in the summary instead of quietly fixing the number.",
      "10",
      "yes",
    ],
    hours: 10,
    wednesday: true,
  },
  {
    email: "demo.applicant.chow@mcmaster.ca",
    firstName: "Mei Lin",
    lastName: "Chow",
    program: "Honours Psychology",
    faculty: "Science",
    specialization: null as unknown as string,
    yearLevel: 2,
    average: "9.40",
    weeklyHours: 8,
    bio: "Second-year psychology student looking for a first research position. Demonstration account.",
    interestSummary:
      "New to research. I am drawn to memory and learning, and I would rather learn one method properly than skim several.",
    distinctions: null,
    skills: [
      ["python", "exposure"],
      ["statistics", "exposure"],
      ["literature-reviews", "working"],
    ],
    courses: [
      ["PSYCH 2H03", "A-"],
      ["STATS 2B03", "B"],
    ],
    interests: ["psychology", "neuroscience"],
    experience: null,
    status: "submitted",
    answers: [
      "I have not done research before, so I will be honest about why I am applying: the posting says training is provided and that beginners are welcome, and the topic is the one thing in second year that made me want to keep reading past the required chapter. I would rather start somewhere that expects me to be new than pretend I am not.",
      "In my statistics course I built an analysis on a dataset where I had misread which column was the pre-test and which was the post-test. Everything came out backwards and I did not notice until my conclusion contradicted the paper we were replicating. I redid it, and now the first thing I do with any dataset is print a few rows and check them against the codebook before touching anything else.",
      "8",
      "yes",
    ],
    hours: 8,
    wednesday: true,
  },
  {
    email: "demo.applicant.fenner@mcmaster.ca",
    firstName: "Tobias",
    lastName: "Fenner",
    program: "Kinesiology",
    faculty: "Health Sciences",
    specialization: "Exercise Physiology",
    yearLevel: 3,
    average: "8.60",
    weeklyHours: 6,
    bio: "Third-year kinesiology student balancing coursework with varsity training. Demonstration account.",
    interestSummary: "Interested in recovery, sleep, and how both affect physical performance.",
    distinctions: null,
    skills: [
      ["data-analysis", "exposure"],
      ["presentation", "working"],
    ],
    courses: [
      ["KINESIOL 2CC3", "B"],
      ["STATS 2B03", "C+"],
    ],
    interests: ["kinesiology"],
    experience: null,
    status: "submitted",
    answers: [
      "I train competitively and I have watched sleep change my performance more than any program I have followed. I would like to see whether the effect I think I am noticing is real when it is measured properly rather than remembered.",
      "During a group lab report our data collection was inconsistent because three of us timed trials differently. We found out when the numbers would not line up. I proposed we rerun the trials with one person timing everything, which cost us a week but produced a result we could defend.",
      "6",
      "no",
    ],
    hours: 6,
    wednesday: false,
  },
];

async function main() {
  if (!RESEARCHER_EMAIL) {
    throw new Error("DEMO_RESEARCHER_EMAIL is not set. Nothing to attach a posting to.");
  }

  const institution = (
    await db.select().from(s.institutions).where(eq(s.institutions.slug, INSTITUTION_SLUG)).limit(1)
  )[0];
  if (!institution) {
    throw new Error("The demo institution does not exist yet. Run the demo content script first.");
  }

  const researcher = (await db.select().from(s.users).where(eq(s.users.email, RESEARCHER_EMAIL)).limit(1))[0];
  if (!researcher) {
    throw new Error(`No account exists for ${RESEARCHER_EMAIL}. Sign in with it once, then re-run.`);
  }

  // Fill in whatever the real account is missing so it can own a posting.
  if (researcher.role !== "researcher" || !researcher.institutionId) {
    await db
      .update(s.users)
      .set({
        role: "researcher",
        institutionId: researcher.institutionId ?? institution.id,
        updatedAt: new Date(),
      })
      .where(eq(s.users.id, researcher.id));
    log("demo_researcher_account_updated", { id: researcher.id });
  }
  const institutionId = researcher.institutionId ?? institution.id;
  const now = new Date();

  const existingProfile = (
    await db.select().from(s.researcherProfiles).where(eq(s.researcherProfiles.userId, researcher.id)).limit(1)
  )[0];
  if (!existingProfile) {
    await db.insert(s.researcherProfiles).values({
      userId: researcher.id,
      firstName: "Demo",
      lastName: "Researcher",
      researcherType: "faculty",
      title: "Associate Professor",
      department: "Psychology, Neuroscience and Behaviour",
      faculty: "Science",
      labName: "Sleep and Memory Group",
      recruitingOnBehalfOf: "personally",
      verificationStatus: "verified",
      approvedAt: now,
      onboardingStep: 4,
    });
    log("demo_researcher_profile_created", { id: researcher.id });
  } else if (existingProfile.verificationStatus !== "verified") {
    await db
      .update(s.researcherProfiles)
      .set({ verificationStatus: "verified", approvedAt: now, onboardingStep: 4, updatedAt: now })
      .where(eq(s.researcherProfiles.userId, researcher.id));
    log("demo_researcher_profile_approved", { id: researcher.id });
  }

  const allFields = await db.select().from(s.researchFields);
  const fieldBySlug = new Map(allFields.map((f) => [f.slug, f.id]));
  const allSkills = await db.select().from(s.skills);
  const skillBySlug = new Map(allSkills.map((k) => [k.slug, k.id]));

  const courseSeeds: [string, string, string][] = [
    ["PSYCH 2H03", "Research Methods in Psychology", "Psychology"],
    ["PSYCH 3M03", "Cognitive Neuroscience", "Psychology"],
    ["STATS 2B03", "Statistical Methods for Science", "Statistics"],
    ["COMPSCI 1MD3", "Introduction to Programming", "Computing and Software"],
    ["HTHSCI 2G03", "Introduction to Health Research Methods", "Health Sciences"],
    ["KINESIOL 2CC3", "Human Physiology", "Kinesiology"],
  ];
  const existingCourses = await db.select().from(s.courses).where(eq(s.courses.institutionId, institutionId));
  const missingCourses = courseSeeds.filter(([code]) => !existingCourses.some((c) => c.courseCode === code));
  if (missingCourses.length > 0) {
    await db.insert(s.courses).values(
      missingCourses.map(([courseCode, courseName, department]) => ({
        institutionId,
        courseCode,
        courseName,
        department,
      })),
    );
  }
  const courses = await db.select().from(s.courses).where(eq(s.courses.institutionId, institutionId));
  const courseByCode = new Map(courses.map((c) => [c.courseCode, c.id]));

  // Opportunity ----------------------------------------------------------
  let opportunity = (
    await db.select().from(s.opportunities).where(eq(s.opportunities.slug, OPPORTUNITY_SLUG)).limit(1)
  )[0];

  if (!opportunity) {
    [opportunity] = await db
      .insert(s.opportunities)
      .values({
        institutionId,
        researcherId: researcher.id,
        title: "Sleep Disruption and Memory Consolidation",
        slug: OPPORTUNITY_SLUG,
        summary:
          "Measure how a disrupted night changes what people remember the next day, combining overnight actigraphy with a paired-associate memory task.",
        description:
          "Participants complete a learning task in the evening, wear a wrist actigraph overnight, and are tested again in the morning. Half are woken briefly twice during the night. We are interested in the size of the overnight memory benefit and how reliably actigraphy predicts it compared with self-reported sleep quality.\n\nYou would join two graduate students and run sessions alongside them. This posting is demonstration content created to show a fully completed ResearchBridge listing.",
        responsibilities:
          "Run evening and morning testing sessions with participants on a rotating schedule.\nScore memory task responses against the coding rubric and enter them into REDCap.\nProcess actigraphy exports into per-night sleep summaries.\nFlag nights where the device was removed or the record is incomplete.",
        projectGoals:
          "Establish whether actigraphy-derived sleep fragmentation predicts overnight memory gain better than self-report, and produce a clean dataset for a follow-up study.",
        techniques:
          "Actigraphy, paired-associate memory testing, response scoring against a rubric, REDCap data entry, basic statistics in R or Python.",
        expectedOutputs:
          "A cleaned dataset with documented exclusions, a short internal report, and co-authorship on the resulting abstract for anyone who stays through the analysis.",
        learningOpportunities:
          "You will learn how a within-participant sleep study is actually run, how to handle data from people who do not follow instructions perfectly, and how to decide what to exclude before you see the result.",
        department: "Psychology, Neuroscience and Behaviour",
        labName: "Sleep and Memory Group",
        status: "published",
        numberOfOpenings: 2,
        locationMode: "in_person",
        location: "Psychology Building, McMaster University",
        startDate: isoDate(35),
        duration: "Two terms",
        hoursPerWeekMin: 8,
        hoursPerWeekMax: 12,
        deadline: isoDate(21),
        compensationType: "academic_credit",
        compensationDetails: "Available for course credit, or as a volunteer position if you have already used your credit.",
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
      .values((["two_semesters"] as const).map((duration) => ({ opportunityId: opportunity.id, duration })));

    await db.insert(s.opportunityFields).values(
      ["neuroscience", "psychology"]
        .filter((slug) => fieldBySlug.has(slug))
        .map((slug) => ({ opportunityId: opportunity.id, researchFieldId: fieldBySlug.get(slug) as string })),
    );

    const oppSkills: [string, "required" | "preferred" | "not_required"][] = [
      ["data-analysis", "preferred"],
      ["statistics", "preferred"],
      ["python", "not_required"],
      ["r", "not_required"],
    ];
    await db.insert(s.opportunitySkills).values(
      oppSkills
        .filter(([slug]) => skillBySlug.has(slug))
        .map(([slug, requirementLevel]) => ({
          opportunityId: opportunity.id,
          skillId: skillBySlug.get(slug) as string,
          requirementLevel,
        })),
    );

    await db.insert(s.opportunityCriteria).values([
      {
        opportunityId: opportunity.id,
        type: "academic_metric" as const,
        label: "Cumulative average of at least 9.0 on the 12 point scale",
        description: "A threshold, not a ranking. Everyone at or above it is read the same way.",
        required: true,
        importance: "required" as const,
        config: { metricType: "institution_scale", minValue: 9, scaleMax: 12 },
        sortOrder: 0,
      },
      {
        opportunityId: opportunity.id,
        type: "availability" as const,
        label: "Availability of at least 8 hours per week",
        description: "Sessions run early morning and evening, so the schedule is unusual rather than heavy.",
        required: true,
        importance: "required" as const,
        config: { minHoursPerWeek: 8 },
        sortOrder: 1,
      },
      {
        opportunityId: opportunity.id,
        type: "year_level" as const,
        label: "Second year or beyond",
        description: "Enough coursework to have seen an experimental design before.",
        required: false,
        importance: "high" as const,
        config: { minYear: 2 },
        sortOrder: 2,
      },
      {
        opportunityId: opportunity.id,
        type: "coursework" as const,
        label: "Research methods or statistics",
        description: "PSYCH 2H03, STATS 2B03, or an equivalent from another program.",
        required: false,
        importance: "high" as const,
        config: { courseCodes: ["PSYCH 2H03", "STATS 2B03", "HTHSCI 2G03"] },
        sortOrder: 3,
      },
      {
        opportunityId: opportunity.id,
        type: "research_interest" as const,
        label: "Interest in memory, sleep, or cognition",
        description: null,
        required: false,
        importance: "medium" as const,
        config: { fieldSlugs: ["neuroscience", "psychology"], keywords: ["memory", "sleep", "cognition"] },
        sortOrder: 4,
      },
      {
        opportunityId: opportunity.id,
        type: "skill" as const,
        label: "Data analysis",
        description: "Any tool. Comfort with a spreadsheet that has gone wrong is the real requirement.",
        required: false,
        importance: "medium" as const,
        config: { skillSlug: "data-analysis", skillName: "Data analysis" },
        sortOrder: 5,
      },
    ]);

    await db.insert(s.opportunityQuestions).values([
      {
        opportunityId: opportunity.id,
        type: "long_text" as const,
        prompt: "What draws you to this project specifically, rather than research in general?",
        helpText: "A few sentences. Honest beats polished.",
        required: true,
        config: { maxLength: 1200 },
        sortOrder: 0,
      },
      {
        opportunityId: opportunity.id,
        type: "long_text" as const,
        prompt: "Describe a time data or an experiment did not go to plan. What did you do about it?",
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
        prompt: "Can you work an early morning session at least once per week?",
        helpText: null,
        required: true,
        config: {},
        sortOrder: 3,
      },
    ]);

    log("demo_opportunity_created", { id: opportunity.id, slug: OPPORTUNITY_SLUG });
  } else {
    log("demo_opportunity_exists", { id: opportunity.id });
  }

  const questions = await db
    .select()
    .from(s.opportunityQuestions)
    .where(eq(s.opportunityQuestions.opportunityId, opportunity.id));
  questions.sort((a, b) => a.sortOrder - b.sortOrder);

  const criteria = await db
    .select()
    .from(s.opportunityCriteria)
    .where(eq(s.opportunityCriteria.opportunityId, opportunity.id));

  // Applicants -----------------------------------------------------------
  for (const applicant of APPLICANTS) {
    let user = (await db.select().from(s.users).where(eq(s.users.email, applicant.email)).limit(1))[0];

    if (!user) {
      [user] = await db
        .insert(s.users)
        .values({
          email: applicant.email,
          role: "student",
          accountStatus: "active",
          institutionId,
          emailVerifiedAt: now,
          onboardingCompletedAt: now,
        })
        .returning();

      await db.insert(s.studentProfiles).values({
        userId: user.id,
        firstName: applicant.firstName,
        lastName: applicant.lastName,
        degreeLevel: "undergraduate",
        program: applicant.program,
        faculty: applicant.faculty,
        specialization: applicant.specialization ?? null,
        yearLevel: applicant.yearLevel,
        graduationYear: now.getUTCFullYear() + (5 - applicant.yearLevel),
        bio: applicant.bio,
        researchInterestSummary: applicant.interestSummary,
        desiredStartDate: isoDate(35),
        weeklyHours: applicant.weeklyHours,
        semesters: ["Fall", "Winter"],
        summerAvailable: true,
        locationPreference: "in_person",
        distinctions: applicant.distinctions,
        profileCompletion: 100,
        onboardingStep: 6,
      });

      await db.insert(s.studentAcademicRecords).values({
        studentId: user.id,
        metricType: "institution_scale",
        value: applicant.average,
        scaleMax: "12",
        institutionScaleName: "12 point",
        label: "Cumulative average",
      });

      const interests = applicant.interests.filter((slug) => fieldBySlug.has(slug));
      if (interests.length > 0) {
        await db.insert(s.studentResearchInterests).values(
          interests.map((slug) => ({ studentId: user.id, researchFieldId: fieldBySlug.get(slug) as string })),
        );
      }

      const skills = applicant.skills.filter(([slug]) => skillBySlug.has(slug));
      if (skills.length > 0) {
        await db.insert(s.studentSkills).values(
          skills.map(([slug, proficiency]) => ({
            studentId: user.id,
            skillId: skillBySlug.get(slug) as string,
            proficiency,
          })),
        );
      }

      const takenCourses = applicant.courses.filter(([code]) => courseByCode.has(code));
      if (takenCourses.length > 0) {
        await db.insert(s.studentCourses).values(
          takenCourses.map(([code, grade]) => ({
            studentId: user.id,
            courseId: courseByCode.get(code) as string,
            grade,
            status: "completed" as const,
          })),
        );
      }

      if (applicant.experience) {
        await db.insert(s.researchExperiences).values({
          studentId: user.id,
          organization: applicant.experience.organization,
          supervisor: applicant.experience.supervisor,
          title: applicant.experience.title,
          startDate: isoDate(applicant.experience.startDays),
          endDate: isoDate(applicant.experience.endDays),
          description: applicant.experience.description,
          techniques: applicant.experience.techniques,
          outputs: applicant.experience.outputs,
          sortOrder: 0,
        });
      }

      log("demo_applicant_created", { email: applicant.email });
    }

    const existingApplication = (
      await db
        .select()
        .from(s.applications)
        .where(and(eq(s.applications.opportunityId, opportunity.id), eq(s.applications.studentId, user.id)))
        .limit(1)
    )[0];
    if (existingApplication) continue;

    const submittedAt = new Date(now.getTime() - APPLICANTS.indexOf(applicant) * 36 * 60 * 60 * 1000);
    const [application] = await db
      .insert(s.applications)
      .values({
        opportunityId: opportunity.id,
        studentId: user.id,
        status: applicant.status,
        submittedAt,
        reviewedAt: applicant.status === "submitted" ? null : submittedAt,
      })
      .returning();

    const answerRows = questions.map((question, index) => {
      const raw = applicant.answers[index] ?? "";
      if (question.type === "numeric") {
        return {
          applicationId: application.id,
          questionId: question.id,
          textAnswer: raw,
          structuredAnswer: { value: applicant.hours },
        };
      }
      if (question.type === "yes_no") {
        return {
          applicationId: application.id,
          questionId: question.id,
          textAnswer: applicant.wednesday ? "yes" : "no",
          structuredAnswer: { value: applicant.wednesday },
        };
      }
      return { applicationId: application.id, questionId: question.id, textAnswer: raw, structuredAnswer: null };
    });
    await db.insert(s.applicationAnswers).values(answerRows);

    const bundle = await loadStudentProfile(user.id);
    if (bundle) {
      const evidence = toApplicantEvidence(
        bundle,
        questions.map((question, index) => ({
          questionId: question.id,
          prompt: question.prompt,
          text: applicant.answers[index] ?? null,
        })),
      );
      const results = evaluateDeterministic(criteria as unknown as Criterion[], evidence);
      await persistCriterionResults(application.id, results);
    }

    log("demo_application_created", { email: applicant.email, status: applicant.status });
  }

  log("demo_applicants_complete", { opportunity: OPPORTUNITY_SLUG, applicants: APPLICANTS.length });
  process.exit(0);
}

main().catch((error) => {
  console.error("demo applicants failed", error);
  process.exit(1);
});
