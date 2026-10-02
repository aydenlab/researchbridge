CREATE TABLE "student_evidence" (
	"student_id" uuid PRIMARY KEY NOT NULL,
	"resume_file_id" uuid,
	"resume_text" text,
	"resume_readable" boolean DEFAULT false NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"research_count" integer DEFAULT 0 NOT NULL,
	"publications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"peer_reviewed_count" integer DEFAULT 0 NOT NULL,
	"presentation_count" integer DEFAULT 0 NOT NULL,
	"summary" text,
	"source" text DEFAULT 'profile_only' NOT NULL,
	"analyzer_version" integer DEFAULT 0 NOT NULL,
	"ai_model" text,
	"ai_input_hash" text,
	"ai_attempted_at" timestamp with time zone,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_evidence" ADD CONSTRAINT "student_evidence_student_id_student_profiles_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;