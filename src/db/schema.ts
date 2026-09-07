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
  "pending_review",
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
export const referenceStatus = pgEnum("reference_status", ["pending", "approved", "declined"]);
/**
 * How long a placement runs. This used to be free text on the listing, which
 * made it unusable for matching: "8 months" and "two terms" are the same answer
 * written two ways. Both sides now pick from this list, and overlap on any one
 * value counts as a match.
 */
export const durationOption = pgEnum("duration_option", [
  "one_semester",
  "two_semesters",
  "summer_only",
  "one_year",
  "multi_year",
]);

/** The academic vehicle a placement is taken for. Researchers filter on it. */
export const courseType = pgEnum("course_type", [
  "honours_thesis",
  "thesis_course",
  "one_semester_coursework",
  "two_semester_coursework",
  "volunteer",
  "phd_thesis",
  "medical_student_elective",
]);

/**
 * A coarse bucket over the free-text program name. Some researchers only take
 * students from particular programs, and they need to filter on that directly
 * rather than guessing at the spelling somebody used.
 */
export const programCategory = pgEnum("program_category", [
  "life_sciences",
  "health_sciences",
  "human_resources_management",
  "health_policy",
  "kinesiology",
  "nursing",
  "medicine",
  "engineering",
  "science",
  "social_sciences",
  "humanities",
  "business",
  "other",
]);

/** What a student will accept in return for the work. Multi-select. */
export const compensationPreference = pgEnum("compensation_preference", ["paid", "volunteer", "academic_credit"]);

/**
 * Review postings are a separate posting type, not a research position with
 * fields left blank. They are short, fast, and the clearest path to authorship,
 * so the form is deliberately tiny and the publish checks differ.
 */
export const opportunityKind = pgEnum("opportunity_kind", ["research_position", "review_project"]);

/** The parts of a review a student can be asked to help with. */
export const reviewTask = pgEnum("review_task", [
  "screening",
  "data_extraction",
  "risk_of_bias",
  "manuscript_writing",
  "search_strategy",
  "statistical_analysis",
  "reference_management",
  "other",
]);

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
    programCategory: programCategory("program_category"),
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
    writingSampleFileId: uuid("writing_sample_file_id"),
    videoIntroFileId: uuid("video_intro_file_id"),
    linkedinUrl: text("linkedin_url"),
    orcidId: text("orcid_id"),
    distinctions: text("distinctions"),
    profileCompletion: integer("profile_completion").notNull().default(0),
    onboardingStep: integer("onboarding_step").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("student_profiles_program_idx").on(t.program),
    index("student_profiles_program_category_idx").on(t.programCategory),
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
    linkedinUrl: text("linkedin_url"),
    orcidId: text("orcid_id"),
    contactEmail: text("contact_email"),
    biography: text("biography"),
    recruitingOnBehalfOf: text("recruiting_on_behalf_of"),
    /** What this person actually wants from a student. Asked once, on claim. */
    recruitingNeeds: text("recruiting_needs"),
    photoFileId: uuid("photo_file_id"),
    /**
     * Set when the profile was imported from a faculty list rather than typed.
     * Names the source so the person can see where a wrong detail came from,
     * and so a re-import knows which rows it is allowed to refresh.
     */
    prefilledSource: text("prefilled_source"),
    prefilledAt: timestamp("prefilled_at", { withTimezone: true }),
    /**
     * When the professor confirmed the imported details. Until this is set the
     * profile is somebody else's description of them, and a re-import may
     * update it; afterwards it is theirs and an import never touches it.
     */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    verificationStatus: verificationStatus("verification_status").notNull().default("pending"),
    verificationNotes: text("verification_notes"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    onboardingStep: integer("onboarding_step").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("researcher_profiles_status_idx").on(t.verificationStatus),
    index("researcher_profiles_prefilled_idx").on(t.prefilledSource, t.claimedAt),
  ],
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
    institutionId: uuid("institution_id").references(() => institutions.id, { onDelete: "restrict" }),
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
    kind: opportunityKind("kind").notNull().default("research_position"),
    status: opportunityStatus("status").notNull().default("draft"),
    numberOfOpenings: integer("number_of_openings").notNull().default(1),
    locationMode: locationMode("location_mode").notNull().default("in_person"),
    location: text("location"),
    startDate: date("start_date"),
    /**
     * Free-text detail that sits alongside the structured durations below.
     * Matching never reads this; it is only ever shown to a person.
     */
    duration: text("duration"),
    /** Review postings only: whether helping earns a place on the author list. */
    authorshipOffered: boolean("authorship_offered").notNull().default(false),
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
    index("opportunities_kind_idx").on(t.kind),
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

export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    feature: text("feature").notNull(),
    model: text("model"),
    outcome: text("outcome").notNull(),
    errorCode: text("error_code"),
    subjectKey: text("subject_key"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
    cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_events_created_idx").on(t.createdAt),
    index("ai_usage_events_feature_idx").on(t.feature, t.createdAt),
    check("ai_usage_events_cost_nonnegative", sql`"ai_usage_events"."cost_usd" >= 0`),
  ],
);

export const aiRateLimits = pgTable(
  "ai_rate_limits",
  {
    bucket: text("bucket").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.windowStart] }),
    index("ai_rate_limits_window_idx").on(t.windowStart),
    check("ai_rate_limits_count_nonnegative", sql`"ai_rate_limits"."count" >= 0`),
  ],
);

export const aiResponseCache = pgTable(
  "ai_response_cache",
  {
    cacheKey: text("cache_key").primaryKey(),
    feature: text("feature").notNull(),
    model: text("model"),
    status: text("status").notNull().default("ok"),
    errorCode: text("error_code"),
    result: jsonb("result").$type<Record<string, unknown>>(),
    hits: integer("hits").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_response_cache_expiry_idx").on(t.expiresAt), index("ai_response_cache_feature_idx").on(t.feature)],
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: uuid("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
    check("follows_no_self", sql`"follows"."follower_id" <> "follows"."following_id"`),
  ],
);

export const applicationReferences = pgTable(
  "application_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    refereeEmail: text("referee_email").notNull(),
    refereeName: text("referee_name"),
    relationship: text("relationship"),
    status: referenceStatus("status").notNull().default("pending"),
    tokenHash: text("token_hash").notNull(),
    note: text("note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("application_references_unique").on(t.applicationId, t.refereeEmail),
    uniqueIndex("application_references_token_key").on(t.tokenHash),
    index("application_references_application_idx").on(t.applicationId),
  ],
);

/**
 * A reference attached to the person rather than to one application. Somebody
 * vouches once, and it then shows on the profile instead of being re-requested
 * every time that person applies.
 */
export const profileReferences = pgTable(
  "profile_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    refereeEmail: text("referee_email").notNull(),
    refereeName: text("referee_name"),
    relationship: text("relationship"),
    status: referenceStatus("status").notNull().default("pending"),
    tokenHash: text("token_hash").notNull(),
    note: text("note"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("profile_references_unique").on(t.userId, t.refereeEmail),
    uniqueIndex("profile_references_token_key").on(t.tokenHash),
    index("profile_references_user_idx").on(t.userId),
  ],
);

/**
 * Durations a listing is offering. A join table rather than one column because
 * a supervisor is often open to either a single term or a full year, and
 * collapsing that to one value throws away the flexibility that produces
 * matches.
 */
export const opportunityDurations = pgTable(
  "opportunity_durations",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    duration: durationOption("duration").notNull(),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.duration] })],
);

/** Durations a student is looking for. Same shape, other side of the match. */
export const studentDurations = pgTable(
  "student_durations",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    duration: durationOption("duration").notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.duration] })],
);

/** The kinds of placement a student is looking to do it as. */
export const studentCourseTypes = pgTable(
  "student_course_types",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    courseType: courseType("course_type").notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.courseType] })],
);

/** Paid, volunteer, for credit, or any combination. Feeds matching. */
export const studentCompensationPreferences = pgTable(
  "student_compensation_preferences",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    preference: compensationPreference("preference").notNull(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.preference] })],
);

/** Which parts of a review posting the researcher wants help with. */
export const opportunityReviewTasks = pgTable(
  "opportunity_review_tasks",
  {
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    task: reviewTask("task").notNull(),
  },
  (t) => [primaryKey({ columns: [t.opportunityId, t.task] })],
);

/**
 * One person vouching for another by name, on the profile rather than per
 * application. Unlike a profile reference, the referrer holds an account here,
 * so the name shown is verified by their own login rather than an emailed link.
 */
export const profileReferrals = pgTable(
  "profile_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    note: text("note"),
    letterFileId: uuid("letter_file_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profile_referrals_once").on(t.subjectId, t.referrerId),
    index("profile_referrals_subject_idx").on(t.subjectId),
    check("profile_referrals_not_self", sql`"profile_referrals"."subject_id" <> "profile_referrals"."referrer_id"`),
  ],
);

/**
 * Direct messages between two accounts. Stored flat rather than as threads: a
 * conversation is defined by the pair of people in it, and there is never more
 * than one, so a threads table would only be a second place for the same fact.
 */
export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("direct_messages_recipient_idx").on(t.recipientId, t.readAt),
    index("direct_messages_pair_idx").on(t.senderId, t.recipientId, t.createdAt),
    check("direct_messages_not_self", sql`"direct_messages"."sender_id" <> "direct_messages"."recipient_id"`),
  ],
);

/**
 * One row per completed digest period, so the weekly run is idempotent.
 *
 * The scheduler is external and may fire twice, be retried by hand, or be
 * pointed at a second environment. Claiming the period first means the second
 * caller finds the row already there and does nothing, rather than sending
 * everybody a duplicate.
 */
export const digestRuns = pgTable(
  "digest_runs",
  {
    /** ISO week key, for example 2026-W37. One digest per period, forever. */
    periodKey: text("period_key").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    researchersNotified: integer("researchers_notified").notNull().default(0),
    studentsNotified: integer("students_notified").notNull().default(0),
    failures: integer("failures").notNull().default(0),
  },
  (t) => [index("digest_runs_started_idx").on(t.startedAt)],
);
