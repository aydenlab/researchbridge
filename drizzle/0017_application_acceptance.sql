ALTER TABLE "applications" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "accepted_by" uuid;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "acceptance_message" text;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Applications accepted before these columns existed. The status history says
-- exactly when and by whom; the rare row with no history falls back to its last
-- update, so nobody already accepted is missing from the record.
UPDATE "applications" AS a
SET "accepted_at" = h."created_at", "accepted_by" = h."changed_by"
FROM (
  SELECT DISTINCT ON ("application_id") "application_id", "created_at", "changed_by"
  FROM "application_status_history"
  WHERE "new_status" = 'accepted'
  ORDER BY "application_id", "created_at" DESC
) AS h
WHERE a."id" = h."application_id";--> statement-breakpoint
UPDATE "applications" SET "accepted_at" = "updated_at" WHERE "status" = 'accepted' AND "accepted_at" IS NULL;
