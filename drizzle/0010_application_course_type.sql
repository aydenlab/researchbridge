ALTER TABLE "applications" ADD COLUMN "course_type" "course_type";--> statement-breakpoint
CREATE INDEX "applications_course_type_idx" ON "applications" USING btree ("course_type");