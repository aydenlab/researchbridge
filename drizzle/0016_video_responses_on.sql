-- Researchers can now ask for a Loom or YouTube video on any position. The
-- platform switch was off for the pilot; this turns it on, including where an
-- earlier seed wrote it as off. An administrator can still switch it back off
-- from the system page, which writes this same row.
INSERT INTO "feature_flags" ("key", "enabled", "description", "updated_at")
VALUES ('VIDEO_RESPONSES_ENABLED', true, 'Allow researchers to request a Loom or YouTube video on a position.', now())
ON CONFLICT ("key") DO UPDATE
SET "enabled" = true, "description" = EXCLUDED."description", "updated_at" = now();
