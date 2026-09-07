-- IF EXISTS on both, so re-running against a database that has already lost the
-- table cannot fail the whole migration transaction and leave every later
-- migration unapplied.
DROP TABLE IF EXISTS "placement_reviews" CASCADE;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."review_direction";
