-- The lab website field is gone; a professor's research page takes its place.
-- Anyone who only ever filled in the lab website keeps that link rather than
-- losing it, since for most profiles it was the research page already.
UPDATE "researcher_profiles" SET "personal_website" = "lab_website" WHERE "personal_website" IS NULL AND "lab_website" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "researcher_profiles" DROP COLUMN "lab_website";
