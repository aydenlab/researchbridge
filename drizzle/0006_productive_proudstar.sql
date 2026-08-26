CREATE TYPE "public"."review_direction" AS ENUM('researcher_to_student', 'student_to_researcher');--> statement-breakpoint
ALTER TYPE "public"."opportunity_status" ADD VALUE 'pending_review' BEFORE 'published';--> statement-breakpoint
CREATE TABLE "placement_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"direction" "review_direction" NOT NULL,
	"author_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "placement_reviews_rating_range" CHECK ("placement_reviews"."rating" between 1 and 5),
	CONSTRAINT "placement_reviews_not_self" CHECK ("placement_reviews"."author_id" <> "placement_reviews"."subject_id")
);
--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "institution_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "orcid_id" text;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "writing_sample_file_id" uuid;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "video_intro_file_id" uuid;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD COLUMN "orcid_id" text;--> statement-breakpoint
ALTER TABLE "placement_reviews" ADD CONSTRAINT "placement_reviews_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_reviews" ADD CONSTRAINT "placement_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placement_reviews" ADD CONSTRAINT "placement_reviews_subject_id_users_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "placement_reviews_once" ON "placement_reviews" USING btree ("application_id","direction");--> statement-breakpoint
CREATE INDEX "placement_reviews_subject_idx" ON "placement_reviews" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "placement_reviews_author_idx" ON "placement_reviews" USING btree ("author_id");