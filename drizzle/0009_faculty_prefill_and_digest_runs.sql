CREATE TABLE "digest_runs" (
	"period_key" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"researchers_notified" integer DEFAULT 0 NOT NULL,
	"students_notified" integer DEFAULT 0 NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "recruiting_needs" text;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "prefilled_source" text;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "prefilled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "researcher_profiles" ADD COLUMN "claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "digest_runs_started_idx" ON "digest_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "researcher_profiles_prefilled_idx" ON "researcher_profiles" USING btree ("prefilled_source","claimed_at");