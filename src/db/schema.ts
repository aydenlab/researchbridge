import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["student", "researcher", "admin"]);
export const accountStatus = pgEnum("account_status", ["pending", "active", "suspended", "disabled"]);
export const researcherType = pgEnum("researcher_type", [
  "faculty",
  "professor",
  "principal_investigator",
  "postdoc",
  "phd_student",
  "masters_student",
  "lab_manager",
  "research_staff",
  "student_lead",
  "other",
]);
export const verificationStatus = pgEnum("verification_status", ["pending", "needs_review", "verified", "rejected"]);
export const degreeLevel = pgEnum("degree_level", [
  "undergraduate",
  "masters",
  "phd",
  "professional",
  "postdoctoral",
  "other",
]);
export const opportunityStatus = pgEnum("opportunity_status", [
  "draft",
  "published",
  "closed",
  "unpublished",
  "archived",
]);
export const locationMode = pgEnum("location_mode", ["in_person", "hybrid", "remote"]);
export const compensationType = pgEnum("compensation_type", [
  "paid",
  "unpaid",
  "volunteer",
  "academic_credit",
  "work_study",
  "grant_funded",
  "thesis",
  "other",
]);
export const requirementLevel = pgEnum("requirement_level", ["required", "preferred", "not_required"]);
export const criterionType = pgEnum("criterion_type", [
  "skill",
  "coursework",
  "program",
  "year_level",
  "availability",
  "prior_research",
  "research_interest",
  "technique",
  "written_response",
  "academic_metric",
  "custom",
]);
export const criterionImportance = pgEnum("criterion_importance", ["required", "high", "medium", "low"]);
export const questionType = pgEnum("question_type", [
  "short_text",
  "long_text",
  "yes_no",
  "numeric",
  "multiple_choice",
  "file_upload",
  "paper_response",
  "video_response",
]);
export const applicationStatus = pgEnum("application_status", [
  "draft",
  "submitted",
  "under_review",
  "shortlisted",
  "researcher_contacted",
  "interview",
  "accepted",
  "declined",
  "withdrawn",
  "position_filled",
]);
export const criterionStatus = pgEnum("criterion_status", ["met", "partially_met", "not_met", "unknown"]);
export const evaluationSource = pgEnum("evaluation_source", ["deterministic", "ai_assisted", "researcher"]);
export const academicMetricType = pgEnum("academic_metric_type", ["gpa", "percentage", "institution_scale"]);
export const outcomeResponse = pgEnum("outcome_response", ["yes", "no", "in_progress", "prefer_not_to_say"]);
export const researchMaterialType = pgEnum("research_material_type", [
  "publication",
  "preprint",
  "lab_website",
  "dataset",
  "protocol",
  "other",
]);
export const courseStatus = pgEnum("course_status", ["completed", "in_progress", "planned"]);
export const skillProficiency = pgEnum("skill_proficiency", ["exposure", "working", "proficient", "advanced"]);
export const waitlistKind = pgEnum("waitlist_kind", ["student", "researcher"]);
export const waitlistStatus = pgEnum("waitlist_status", ["new", "contacted", "invited", "converted", "declined"]);

export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortName: text("short_name"),
    location: text("location"),
    logoPath: text("logo_path"),
    gpaScaleName: text("gpa_scale_name"),
    gpaScaleMax: numeric("gpa_scale_max", { precision: 5, scale: 2 }),
    active: boolean("active").notNull().default(true),
    isPilot: boolean("is_pilot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("institutions_slug_key").on(t.slug)],
);

export const institutionEmailDomains = pgTable(
  "institution_email_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    roleRestriction: userRole("role_restriction"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("institution_email_domains_domain_key").on(t.domain), index("institution_email_domains_inst_idx").on(t.institutionId)],
);

export const institutionFaculties = pgTable(
  "institution_faculties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("institution_faculties_key").on(t.institutionId, t.name)],
);

export const institutionDepartments = pgTable(
  "institution_departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    facultyId: uuid("faculty_id").references(() => institutionFaculties.id, { onDelete: "set null" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("institution_departments_key").on(t.institutionId, t.name)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: userRole("role"),
    accountStatus: accountStatus("account_status").notNull().default("pending"),
    institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "set null" }),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email), index("users_role_idx").on(t.role), index("users_institution_idx").on(t.institutionId)],
);

export const emailVerificationCodes = pgTable(
  "email_verification_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    requestIp: text("request_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_verification_codes_email_idx").on(t.email, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_key").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    preferredName: text("preferred_name"),
    degreeLevel: degreeLevel("degree_level"),
    program: text("program"),
    faculty: text("faculty"),
    specialization: text("specialization"),
    yearLevel: integer("year_level"),
    graduationYear: integer("graduation_year"),
    bio: text("bio"),
    researchInterestSummary: text("research_interest_summary"),
    desiredStartDate: date("desired_start_date"),
    weeklyHours: integer("weekly_hours"),
    semesters: jsonb("semesters").$type<string[]>().default([]),
    summerAvailable: boolean("summer_available"),
    locationPreference: locationMode("location_preference"),
    scheduleNotes: text("schedule_notes"),
    resumeFileId: uuid("resume_file_id"),
    transcriptFileId: uuid("transcript_file_id"),
    distinctions: text("distinctions"),
    profileCompletion: integer("profile_completion").notNull().default(0),
    onboardingStep: integer("onboarding_step").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("student_profiles_program_idx").on(t.program),
    check("student_profiles_weekly_hours_nonnegative", sql`${t.weeklyHours} is null or ${t.weeklyHours} >= 0`),
    check("student_profiles_year_level_range", sql`${t.yearLevel} is null or (${t.yearLevel} >= 1 and ${t.yearLevel} <= 12)`),
    check("student_profiles_completion_range", sql`${t.profileCompletion} >= 0 and ${t.profileCompletion} <= 100`),
  ],
);

export const studentAcademicRecords = pgTable(
  "student_academic_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    metricType: academicMetricType("metric_type").notNull(),
    value: numeric("value", { precision: 6, scale: 2 }).notNull(),
    scaleMax: numeric("scale_max", { precision: 6, scale: 2 }),
    institutionScaleName: text("institution_scale_name"),
    label: text("label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("student_academic_records_student_idx").on(t.studentId),
    check("student_academic_records_value_nonnegative", sql`${t.value} >= 0`),
    check("student_academic_records_scale_positive", sql`${t.scaleMax} is null or ${t.scaleMax} > 0`),
  ],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "cascade" }),
    courseCode: text("course_code").notNull(),
    courseName: text("course_name").notNull(),
    department: text("department"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courses_code_key").on(t.institutionId, t.courseCode), index("courses_code_idx").on(t.courseCode)],
);

export const studentCourses = pgTable(
  "student_courses",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    status: courseStatus("status").notNull().default("completed"),
    grade: text("grade"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.courseId] })],
);

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category"),
    approved: boolean("approved").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("skills_slug_key").on(t.slug), index("skills_name_idx").on(t.name)],
);

export const studentSkills = pgTable(
  "student_skills",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    proficiency: skillProficiency("proficiency"),
    context: text("context"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.skillId] })],
);

export const researchFields = pgTable(
  "research_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("research_fields_slug_key").on(t.slug), index("research_fields_name_idx").on(t.name)],
);

export const studentResearchInterests = pgTable(
  "student_research_interests",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    researchFieldId: uuid("research_field_id")
      .notNull()
      .references(() => researchFields.id, { onDelete: "cascade" }),
    strength: integer("strength"),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.researchFieldId] })],
);

export const researchExperiences = pgTable(
  "research_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    organization: text("organization").notNull(),
    supervisor: text("supervisor"),
    title: text("title"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    description: text("description"),
    techniques: jsonb("techniques").$type<string[]>().default([]),
    outputs: jsonb("outputs").$type<string[]>().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("research_experiences_student_idx").on(t.studentId)],
);

export const researcherProfiles = pgTable(
  "researcher_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    researcherType: researcherType("researcher_type"),
    title: text("title"),
    department: text("department"),
    faculty: text("faculty"),
    labName: text("lab_name"),
    labWebsite: text("lab_website"),
    personalWebsite: text("personal_website"),
    biography: text("biography"),
    recruitingOnBehalfOf: text("recruiting_on_behalf_of"),
    photoFileId: uuid("photo_file_id"),
    verificationStatus: verificationStatus("verification_status").notNull().default("pending"),
    verificationNotes: text("verification_notes"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    onboardingStep: integer("onboarding_step").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("researcher_profiles_status_idx").on(t.verificationStatus)],
);

export const researcherFields = pgTable(
  "researcher_fields",
  {
    researcherId: uuid("researcher_id")
      .notNull()
      .references(() => researcherProfiles.userId, { onDelete: "cascade" }),
    researchFieldId: uuid("research_field_id")
      .notNull()
      .references(() => researchFields.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.researcherId, t.researchFieldId] })],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    institutionId: uuid("institution_id")
      .notNull()
      .references(() => institutions.id, { onDelete: "restrict" }),
    researcherId: uuid("researcher_id")
      .notNull()
      .references(() => researcherProfiles.userId, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    summary: text("summary").notNull(),
    description: text("description"),
    responsibilities: text("responsibilities"),
    projectGoals: text("project_goals"),
    techniques: text("techniques"),
    expectedOutputs: text("expected_outputs"),
    learningOpportunities: text("learning_opportunities"),
    department: text("department"),
    labName: text("lab_name"),
    status: opportunityStatus("status").notNull().default("draft"),
    numberOfOpenings: integer("number_of_openings").notNull().default(1),
    locationMode: locationMode("location_mode").notNull().default("in_person"),
    location: text("location"),
    startDate: date("start_date"),
    duration: text("duration"),
    hoursPerWeekMin: integer("hours_per_week_min"),
    hoursPerWeekMax: integer("hours_per_week_max"),
    deadline: date("deadline"),
    compensationType: compensationType("compensation_type").notNull().default("unpaid"),
    compensationDetails: text("compensation_details"),
    academicCreditAvailable: boolean("academic_credit_available").notNull().default(false),
    beginnerFriendly: boolean("beginner_friendly").notNull().default(false),
    priorResearchRequired: boolean("prior_research_required").notNull().default(false),
    videoResponseEnabled: boolean("video_response_enabled").notNull().default(false),
    videoPrompt: text("video_prompt"),
    videoMaxSeconds: integer("video_max_seconds").default(60),
    viewCount: integer("view_count").notNull().default(0),
    draftStep: integer("draft_step").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("opportunities_slug_key").on(t.slug),
    index("opportunities_status_idx").on(t.status),
    index("opportunities_institution_idx").on(t.institutionId),
    index("opportunities_researcher_idx").on(t.researcherId),
    index("opportunities_deadline_idx").on(t.deadline),
    index("opportunities_published_idx").on(t.publishedAt),
    check("opportunities_openings_positive", sql`${t.numberOfOpenings} > 0`),
    check("opportunities_hours_nonnegative", sql`${t.hoursPerWeekMin} is null or ${t.hoursPerWeekMin} >= 0`),
    check("opportunities_hours_ordered", sql`${t.hoursPerWeekMin} is null or ${t.hoursPerWeekMax} is null or ${t.hoursPerWeekMax} >= ${t.hoursPerWeekMin}`),
  ],
);

export const opportunityFields = pgTable(
  "opportunity_fields",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    researchFieldId: uuid("research_field_id")
      .notNull()
      .references(() => researchFields.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.researchFieldId] })],
);

export const opportunitySkills = pgTable(
  "opportunity_skills",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    requirementLevel: requirementLevel("requirement_level").notNull().default("preferred"),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.skillId] })],
);

export const opportunityCriteria = pgTable(
  "opportunity_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    type: criterionType("type").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    required: boolean("required").notNull().default(false),
    importance: criterionImportance("importance").notNull().default("medium"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("opportunity_criteria_opportunity_idx").on(t.opportunityId)],
);

export const opportunityQuestions = pgTable(
  "opportunity_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    type: questionType("type").notNull(),
    prompt: text("prompt").notNull(),
    helpText: text("help_text"),
    required: boolean("required").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("opportunity_questions_opportunity_idx").on(t.opportunityId)],
);

export const opportunityResearchMaterials = pgTable(
  "opportunity_research_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    type: researchMaterialType("type").notNull().default("publication"),
    title: text("title").notNull(),
    authors: text("authors"),
    url: text("url"),
    doi: text("doi"),
    fileId: uuid("file_id"),
    abstract: text("abstract"),
    context: text("context"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("opportunity_research_materials_opportunity_idx").on(t.opportunityId)],
);

export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    status: applicationStatus("status").notNull().default("draft"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("applications_unique_student_opportunity").on(t.opportunityId, t.studentId),
    index("applications_opportunity_idx").on(t.opportunityId),
    index("applications_student_idx").on(t.studentId),
    index("applications_status_idx").on(t.status),
  ],
);

export const applicationAnswers = pgTable(
  "application_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => opportunityQuestions.id, { onDelete: "cascade" }),
    textAnswer: text("text_answer"),
    structuredAnswer: jsonb("structured_answer").$type<Record<string, unknown>>(),
    fileId: uuid("file_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("application_answers_key").on(t.applicationId, t.questionId)],
);

export const applicationSnapshots = pgTable("application_snapshots", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => applications.id, { onDelete: "cascade" }),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull(),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
});

export const criterionEvaluations = pgTable(
  "criterion_evaluations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => opportunityCriteria.id, { onDelete: "cascade" }),
    source: evaluationSource("source").notNull(),
    status: criterionStatus("status").notNull(),
    score: numeric("score", { precision: 6, scale: 3 }),
    maxScore: numeric("max_score", { precision: 6, scale: 3 }),
    evidence: jsonb("evidence").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("criterion_evaluations_key").on(t.applicationId, t.criterionId, t.source),
    check("criterion_evaluations_score_nonnegative", sql`${t.score} is null or ${t.score} >= 0`),
  ],
);

export const aiAnalyses = pgTable(
  "ai_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    model: text("model"),
    promptVersion: text("prompt_version").notNull(),
    schemaVersion: text("schema_version").notNull(),
    inputHash: text("input_hash").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("ok"),
    errorCode: text("error_code"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_analyses_application_idx").on(t.applicationId, t.type), index("ai_analyses_hash_idx").on(t.inputHash)],
);

export const researcherApplicationNotes = pgTable(
  "researcher_application_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    researcherId: uuid("researcher_id")
      .notNull()
      .references(() => researcherProfiles.userId, { onDelete: "cascade" }),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("researcher_application_notes_application_idx").on(t.applicationId)],
);

export const savedOpportunities = pgTable(
  "saved_opportunities",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.opportunityId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const applicationStatusHistory = pgTable(
  "application_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    previousStatus: applicationStatus("previous_status"),
    newStatus: applicationStatus("new_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("application_status_history_application_idx").on(t.applicationId)],
);

export const placementOutcomes = pgTable(
  "placement_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    studentReportedOutcome: outcomeResponse("student_reported_outcome"),
    researcherReportedOutcome: outcomeResponse("researcher_reported_outcome"),
    confirmed: boolean("confirmed").notNull().default(false),
    startDate: date("start_date"),
    positionType: compensationType("position_type"),
    studentWouldUseAgain: boolean("student_would_use_again"),
    researcherWouldUseAgain: boolean("researcher_would_use_again"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("placement_outcomes_application_key").on(t.applicationId)],
);

export const storedFiles = pgTable(
  "stored_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    provider: text("provider").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stored_files_owner_idx").on(t.ownerId),
    check("stored_files_size_positive", sql`${t.byteSize} > 0`),
  ],
);

export const waitlistEntries = pgTable(
  "waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: waitlistKind("kind").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "set null" }),
    program: text("program"),
    yearLevel: text("year_level"),
    researchInterests: text("research_interests"),
    title: text("title"),
    department: text("department"),
    labName: text("lab_name"),
    expectedStudentCount: integer("expected_student_count"),
    helpNeeded: text("help_needed"),
    comments: text("comments"),
    willingToPilot: boolean("willing_to_pilot").notNull().default(true),
    contactConsent: boolean("contact_consent").notNull().default(false),
    resumeFileId: uuid("resume_file_id"),
    status: waitlistStatus("status").notNull().default("new"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    convertedUserId: uuid("converted_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("waitlist_entries_email_kind_key").on(t.email, t.kind), index("waitlist_entries_status_idx").on(t.status)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "set null" }),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_events_name_idx").on(t.name, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    subjectType: text("subject_type"),
    subjectId: uuid("subject_id"),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_action_idx").on(t.action, t.createdAt)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
