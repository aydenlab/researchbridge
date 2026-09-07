CREATE TYPE "public"."compensation_preference" AS ENUM('paid', 'volunteer', 'academic_credit');--> statement-breakpoint
CREATE TYPE "public"."course_type" AS ENUM('honours_thesis', 'thesis_course', 'one_semester_coursework', 'two_semester_coursework', 'volunteer', 'phd_thesis', 'medical_student_elective');--> statement-breakpoint
CREATE TYPE "public"."duration_option" AS ENUM('one_semester', 'two_semesters', 'summer_only', 'one_year', 'multi_year');--> statement-breakpoint
CREATE TYPE "public"."opportunity_kind" AS ENUM('research_position', 'review_project');--> statement-breakpoint
CREATE TYPE "public"."program_category" AS ENUM('life_sciences', 'health_sciences', 'human_resources_management', 'health_policy', 'kinesiology', 'nursing', 'medicine', 'engineering', 'science', 'social_sciences', 'humanities', 'business', 'other');--> statement-breakpoint
CREATE TYPE "public"."review_task" AS ENUM('screening', 'data_extraction', 'risk_of_bias', 'manuscript_writing', 'search_strategy', 'statistical_analysis', 'reference_management', 'other');--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "direct_messages_not_self" CHECK ("direct_messages"."sender_id" <> "direct_messages"."recipient_id")
);
--> statement-breakpoint
CREATE TABLE "opportunity_durations" (
	"opportunity_id" uuid NOT NULL,
	"duration" "duration_option" NOT NULL,
	CONSTRAINT "opportunity_durations_opportunity_id_duration_pk" PRIMARY KEY("opportunity_id","duration")
);
--> statement-breakpoint
CREATE TABLE "opportunity_review_tasks" (
	"opportunity_id" uuid NOT NULL,
	"task" "review_task" NOT NULL,
	CONSTRAINT "opportunity_review_tasks_opportunity_id_task_pk" PRIMARY KEY("opportunity_id","task")
);
--> statement-breakpoint
CREATE TABLE "profile_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"referrer_id" uuid NOT NULL,
	"note" text,
	"letter_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_referrals_not_self" CHECK ("profile_referrals"."subject_id" <> "profile_referrals"."referrer_id")
);
--> statement-breakpoint
CREATE TABLE "student_compensation_preferences" (
	"student_id" uuid NOT NULL,
	"preference" "compensation_preference" NOT NULL,
	CONSTRAINT "student_compensation_preferences_student_id_preference_pk" PRIMARY KEY("student_id","preference")
);
--> statement-breakpoint
CREATE TABLE "student_course_types" (
	"student_id" uuid NOT NULL,
	"course_type" "course_type" NOT NULL,
	CONSTRAINT "student_course_types_student_id_course_type_pk" PRIMARY KEY("student_id","course_type")
);
--> statement-breakpoint
CREATE TABLE "student_durations" (
	"student_id" uuid NOT NULL,
	"duration" "duration_option" NOT NULL,
	CONSTRAINT "student_durations_student_id_duration_pk" PRIMARY KEY("student_id","duration")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "kind" "opportunity_kind" DEFAULT 'research_position' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "authorship_offered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "program_category" "program_category";--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_durations" ADD CONSTRAINT "opportunity_durations_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_review_tasks" ADD CONSTRAINT "opportunity_review_tasks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_referrals" ADD CONSTRAINT "profile_referrals_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_referrals" ADD CONSTRAINT "profile_referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_compensation_preferences" ADD CONSTRAINT "student_compensation_preferences_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_course_types" ADD CONSTRAINT "student_course_types_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_durations" ADD CONSTRAINT "student_durations_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_messages_recipient_idx" ON "direct_messages" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "direct_messages_pair_idx" ON "direct_messages" USING btree ("sender_id","recipient_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_referrals_once" ON "profile_referrals" USING btree ("subject_id","referrer_id");--> statement-breakpoint
CREATE INDEX "profile_referrals_subject_idx" ON "profile_referrals" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "opportunities_kind_idx" ON "opportunities" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "student_profiles_program_category_idx" ON "student_profiles" USING btree ("program_category");--> statement-breakpoint
-- Best-effort backfill of the structured durations from the free text that used
-- to be the only record of them. Anything this cannot read confidently is left
-- unset rather than guessed at, so a researcher is asked once instead of having
-- a wrong answer put in their mouth.
INSERT INTO "opportunity_durations" ("opportunity_id", "duration")
SELECT "id", "duration_option"::"public"."duration_option"
FROM (
  SELECT
    o."id",
    CASE
      WHEN o."duration" ~* 'multi[- ]?year|ongoing|indefinite|[3-9] *year' THEN 'multi_year'
      WHEN o."duration" ~* 'summer' AND o."duration" !~* 'fall|winter|term|semester' THEN 'summer_only'
      WHEN o."duration" ~* '1 *year|one year|12 *month|full academic year' THEN 'one_year'
      WHEN o."duration" ~* 'two (terms|semesters)|2 (terms|semesters)|8 *month|two term|both terms' THEN 'two_semesters'
      WHEN o."duration" ~* 'one (term|semester)|1 (term|semester)|single (term|semester)|4 *month|a term' THEN 'one_semester'
      ELSE NULL
    END AS "duration_option"
  FROM "opportunities" o
  WHERE o."duration" IS NOT NULL AND btrim(o."duration") <> ''
) mapped
WHERE "duration_option" IS NOT NULL
ON CONFLICT DO NOTHING;
