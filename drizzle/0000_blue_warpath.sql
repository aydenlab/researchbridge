CREATE TYPE "public"."academic_metric_type" AS ENUM('gpa', 'percentage', 'institution_scale');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('pending', 'active', 'suspended', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('draft', 'submitted', 'under_review', 'shortlisted', 'researcher_contacted', 'interview', 'accepted', 'declined', 'withdrawn', 'position_filled');--> statement-breakpoint
CREATE TYPE "public"."compensation_type" AS ENUM('paid', 'unpaid', 'volunteer', 'academic_credit', 'work_study', 'grant_funded', 'thesis', 'other');--> statement-breakpoint
CREATE TYPE "public"."course_status" AS ENUM('completed', 'in_progress', 'planned');--> statement-breakpoint
CREATE TYPE "public"."criterion_importance" AS ENUM('required', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."criterion_status" AS ENUM('met', 'partially_met', 'not_met', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."criterion_type" AS ENUM('skill', 'coursework', 'program', 'year_level', 'availability', 'prior_research', 'research_interest', 'technique', 'written_response', 'academic_metric', 'custom');--> statement-breakpoint
CREATE TYPE "public"."degree_level" AS ENUM('undergraduate', 'masters', 'phd', 'professional', 'postdoctoral', 'other');--> statement-breakpoint
CREATE TYPE "public"."evaluation_source" AS ENUM('deterministic', 'ai_assisted', 'researcher');--> statement-breakpoint
CREATE TYPE "public"."location_mode" AS ENUM('in_person', 'hybrid', 'remote');--> statement-breakpoint
CREATE TYPE "public"."opportunity_status" AS ENUM('draft', 'published', 'closed', 'unpublished', 'archived');--> statement-breakpoint
CREATE TYPE "public"."outcome_response" AS ENUM('yes', 'no', 'in_progress', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('short_text', 'long_text', 'yes_no', 'numeric', 'multiple_choice', 'file_upload', 'paper_response', 'video_response');--> statement-breakpoint
CREATE TYPE "public"."requirement_level" AS ENUM('required', 'preferred', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."research_material_type" AS ENUM('publication', 'preprint', 'lab_website', 'dataset', 'protocol', 'other');--> statement-breakpoint
CREATE TYPE "public"."researcher_type" AS ENUM('faculty', 'professor', 'principal_investigator', 'postdoc', 'phd_student', 'masters_student', 'lab_manager', 'research_staff', 'student_lead', 'other');--> statement-breakpoint
CREATE TYPE "public"."skill_proficiency" AS ENUM('exposure', 'working', 'proficient', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('student', 'researcher', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'needs_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."waitlist_kind" AS ENUM('student', 'researcher');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('new', 'contacted', 'invited', 'converted', 'declined');--> statement-breakpoint
CREATE TABLE "ai_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"type" text NOT NULL,
	"model" text,
	"prompt_version" text NOT NULL,
	"schema_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"result" jsonb,
	"status" text DEFAULT 'ok' NOT NULL,
	"error_code" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"user_id" uuid,
	"institution_id" uuid,
	"subject_type" text,
	"subject_id" uuid,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"text_answer" text,
	"structured_answer" jsonb,
	"file_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_snapshots" (
	"application_id" uuid PRIMARY KEY NOT NULL,
	"profile" jsonb NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"previous_status" "application_status",
	"new_status" "application_status" NOT NULL,
	"changed_by" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "application_status" DEFAULT 'draft' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"withdrawn_at" timestamp with time zone,
	"contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"course_code" text NOT NULL,
	"course_name" text NOT NULL,
	"department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"criterion_id" uuid NOT NULL,
	"source" "evaluation_source" NOT NULL,
	"status" "criterion_status" NOT NULL,
	"score" numeric(6, 3),
	"max_score" numeric(6, 3),
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"request_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"faculty_id" uuid,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_email_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"role_restriction" "user_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_faculties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_name" text,
	"location" text,
	"logo_path" text,
	"gpa_scale_name" text,
	"gpa_scale_max" numeric(5, 2),
	"active" boolean DEFAULT true NOT NULL,
	"is_pilot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"researcher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text NOT NULL,
	"description" text,
	"responsibilities" text,
	"project_goals" text,
	"techniques" text,
	"expected_outputs" text,
	"learning_opportunities" text,
	"department" text,
	"lab_name" text,
	"status" "opportunity_status" DEFAULT 'draft' NOT NULL,
	"number_of_openings" integer DEFAULT 1 NOT NULL,
	"location_mode" "location_mode" DEFAULT 'in_person' NOT NULL,
	"location" text,
	"start_date" date,
	"duration" text,
	"hours_per_week_min" integer,
	"hours_per_week_max" integer,
	"deadline" date,
	"compensation_type" "compensation_type" DEFAULT 'unpaid' NOT NULL,
	"compensation_details" text,
	"academic_credit_available" boolean DEFAULT false NOT NULL,
	"beginner_friendly" boolean DEFAULT false NOT NULL,
	"prior_research_required" boolean DEFAULT false NOT NULL,
	"video_response_enabled" boolean DEFAULT false NOT NULL,
	"video_prompt" text,
	"video_max_seconds" integer DEFAULT 60,
	"view_count" integer DEFAULT 0 NOT NULL,
	"draft_step" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"type" "criterion_type" NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"required" boolean DEFAULT false NOT NULL,
	"importance" "criterion_importance" DEFAULT 'medium' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_fields" (
	"opportunity_id" uuid NOT NULL,
	"research_field_id" uuid NOT NULL,
	CONSTRAINT "opportunity_fields_opportunity_id_research_field_id_pk" PRIMARY KEY("opportunity_id","research_field_id")
);
--> statement-breakpoint
CREATE TABLE "opportunity_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"type" "question_type" NOT NULL,
	"prompt" text NOT NULL,
	"help_text" text,
	"required" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_research_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"type" "research_material_type" DEFAULT 'publication' NOT NULL,
	"title" text NOT NULL,
	"authors" text,
	"url" text,
	"doi" text,
	"file_id" uuid,
	"abstract" text,
	"context" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_skills" (
	"opportunity_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"requirement_level" "requirement_level" DEFAULT 'preferred' NOT NULL,
	CONSTRAINT "opportunity_skills_opportunity_id_skill_id_pk" PRIMARY KEY("opportunity_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "placement_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"student_reported_outcome" "outcome_response",
	"researcher_reported_outcome" "outcome_response",
	"confirmed" boolean DEFAULT false NOT NULL,
	"start_date" date,
	"position_type" "compensation_type",
	"student_would_use_again" boolean,
	"researcher_would_use_again" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"organization" text NOT NULL,
	"supervisor" text,
	"title" text,
	"start_date" date,
	"end_date" date,
	"description" text,
	"techniques" jsonb DEFAULT '[]'::jsonb,
	"outputs" jsonb DEFAULT '[]'::jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "researcher_application_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"researcher_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "researcher_fields" (
	"researcher_id" uuid NOT NULL,
	"research_field_id" uuid NOT NULL,
	CONSTRAINT "researcher_fields_researcher_id_research_field_id_pk" PRIMARY KEY("researcher_id","research_field_id")
);
--> statement-breakpoint
CREATE TABLE "researcher_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"researcher_type" "researcher_type",
	"title" text,
	"department" text,
	"faculty" text,
	"lab_name" text,
	"lab_website" text,
	"personal_website" text,
	"biography" text,
	"recruiting_on_behalf_of" text,
	"photo_file_id" uuid,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"verification_notes" text,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_opportunities" (
	"student_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_opportunities_student_id_opportunity_id_pk" PRIMARY KEY("student_id","opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text,
	"approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stored_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_academic_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"metric_type" "academic_metric_type" NOT NULL,
	"value" numeric(6, 2) NOT NULL,
	"scale_max" numeric(6, 2),
	"institution_scale_name" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_courses" (
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"status" "course_status" DEFAULT 'completed' NOT NULL,
	"grade" text,
	CONSTRAINT "student_courses_student_id_course_id_pk" PRIMARY KEY("student_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"preferred_name" text,
	"degree_level" "degree_level",
	"program" text,
	"faculty" text,
	"specialization" text,
	"year_level" integer,
	"graduation_year" integer,
	"bio" text,
	"research_interest_summary" text,
	"desired_start_date" date,
	"weekly_hours" integer,
	"semesters" jsonb DEFAULT '[]'::jsonb,
	"summer_available" boolean,
	"location_preference" "location_mode",
	"schedule_notes" text,
	"resume_file_id" uuid,
	"transcript_file_id" uuid,
	"distinctions" text,
	"profile_completion" integer DEFAULT 0 NOT NULL,
	"onboarding_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_research_interests" (
	"student_id" uuid NOT NULL,
	"research_field_id" uuid NOT NULL,
	"strength" integer,
	CONSTRAINT "student_research_interests_student_id_research_field_id_pk" PRIMARY KEY("student_id","research_field_id")
);
--> statement-breakpoint
CREATE TABLE "student_skills" (
	"student_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"proficiency" "skill_proficiency",
	"context" text,
	CONSTRAINT "student_skills_student_id_skill_id_pk" PRIMARY KEY("student_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role",
	"account_status" "account_status" DEFAULT 'pending' NOT NULL,
	"institution_id" uuid,
	"email_verified_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "waitlist_kind" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"institution_id" uuid,
	"program" text,
	"year_level" text,
	"research_interests" text,
	"title" text,
	"department" text,
	"lab_name" text,
	"expected_student_count" integer,
	"help_needed" text,
	"comments" text,
	"willing_to_pilot" boolean DEFAULT true NOT NULL,
	"contact_consent" boolean DEFAULT false NOT NULL,
	"resume_file_id" uuid,
	"status" "waitlist_status" DEFAULT 'new' NOT NULL,
	"invited_at" timestamp with time zone,
	"converted_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_answers" ADD CONSTRAINT "application_answers_question_id_opportunity_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."opportunity_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_snapshots" ADD CONSTRAINT "application_snapshots_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_evaluations" ADD CONSTRAINT "criterion_evaluations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_evaluations" ADD CONSTRAINT "criterion_evaluations_criterion_id_opportunity_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."opportunity_criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_departments" ADD CONSTRAINT "institution_departments_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_departments" ADD CONSTRAINT "institution_departments_faculty_id_institution_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."institution_faculties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_email_domains" ADD CONSTRAINT "institution_email_domains_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_faculties" ADD CONSTRAINT "institution_faculties_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_researcher_id_researcher_profiles_user_id_fk" FOREIGN KEY ("researcher_id") REFERENCES "public"."researcher_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_criteria" ADD CONSTRAINT "opportunity_criteria_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_fields" ADD CONSTRAINT "opportunity_fields_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_fields" ADD CONSTRAINT "opportunity_fields_research_field_id_research_fields_id_fk" FOREIGN KEY ("research_field_id") REFERENCES "public"."research_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_questions" ADD CONSTRAINT "opportunity_questions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_research_materials" ADD CONSTRAINT "opportunity_research_materials_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_skills" ADD CONSTRAINT "opportunity_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_outcomes" ADD CONSTRAINT "placement_outcomes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_experiences" ADD CONSTRAINT "research_experiences_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_application_notes" ADD CONSTRAINT "researcher_application_notes_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_application_notes" ADD CONSTRAINT "researcher_application_notes_researcher_id_researcher_profiles_user_id_fk" FOREIGN KEY ("researcher_id") REFERENCES "public"."researcher_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_fields" ADD CONSTRAINT "researcher_fields_researcher_id_researcher_profiles_user_id_fk" FOREIGN KEY ("researcher_id") REFERENCES "public"."researcher_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_fields" ADD CONSTRAINT "researcher_fields_research_field_id_research_fields_id_fk" FOREIGN KEY ("research_field_id") REFERENCES "public"."research_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD CONSTRAINT "researcher_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD CONSTRAINT "researcher_profiles_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_opportunities" ADD CONSTRAINT "saved_opportunities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_records" ADD CONSTRAINT "student_academic_records_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_courses" ADD CONSTRAINT "student_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_research_interests" ADD CONSTRAINT "student_research_interests_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_research_interests" ADD CONSTRAINT "student_research_interests_research_field_id_research_fields_id_fk" FOREIGN KEY ("research_field_id") REFERENCES "public"."research_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_converted_user_id_users_id_fk" FOREIGN KEY ("converted_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analyses_application_idx" ON "ai_analyses" USING btree ("application_id","type");--> statement-breakpoint
CREATE INDEX "ai_analyses_hash_idx" ON "ai_analyses" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "application_answers_key" ON "application_answers" USING btree ("application_id","question_id");--> statement-breakpoint
CREATE INDEX "application_status_history_application_idx" ON "application_status_history" USING btree ("application_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_unique_student_opportunity" ON "applications" USING btree ("opportunity_id","student_id");--> statement-breakpoint
CREATE INDEX "applications_opportunity_idx" ON "applications" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "applications_student_idx" ON "applications" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_code_key" ON "courses" USING btree ("institution_id","course_code");--> statement-breakpoint
CREATE INDEX "courses_code_idx" ON "courses" USING btree ("course_code");--> statement-breakpoint
CREATE UNIQUE INDEX "criterion_evaluations_key" ON "criterion_evaluations" USING btree ("application_id","criterion_id","source");--> statement-breakpoint
CREATE INDEX "email_verification_codes_email_idx" ON "email_verification_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_departments_key" ON "institution_departments" USING btree ("institution_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_email_domains_domain_key" ON "institution_email_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "institution_email_domains_inst_idx" ON "institution_email_domains" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_faculties_key" ON "institution_faculties" USING btree ("institution_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_slug_key" ON "institutions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_slug_key" ON "opportunities" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "opportunities_status_idx" ON "opportunities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "opportunities_institution_idx" ON "opportunities" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "opportunities_researcher_idx" ON "opportunities" USING btree ("researcher_id");--> statement-breakpoint
CREATE INDEX "opportunities_deadline_idx" ON "opportunities" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "opportunities_published_idx" ON "opportunities" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "opportunity_criteria_opportunity_idx" ON "opportunity_criteria" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_questions_opportunity_idx" ON "opportunity_questions" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "opportunity_research_materials_opportunity_idx" ON "opportunity_research_materials" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "placement_outcomes_application_key" ON "placement_outcomes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "research_experiences_student_idx" ON "research_experiences" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "research_fields_slug_key" ON "research_fields" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "research_fields_name_idx" ON "research_fields" USING btree ("name");--> statement-breakpoint
CREATE INDEX "researcher_application_notes_application_idx" ON "researcher_application_notes" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "researcher_profiles_status_idx" ON "researcher_profiles" USING btree ("verification_status");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_slug_key" ON "skills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "skills_name_idx" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "stored_files_owner_idx" ON "stored_files" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "student_academic_records_student_idx" ON "student_academic_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_profiles_program_idx" ON "student_profiles" USING btree ("program");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_institution_idx" ON "users" USING btree ("institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_kind_key" ON "waitlist_entries" USING btree ("email","kind");--> statement-breakpoint
CREATE INDEX "waitlist_entries_status_idx" ON "waitlist_entries" USING btree ("status");