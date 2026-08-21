CREATE TABLE "ai_rate_limits" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_rate_limits_bucket_window_start_pk" PRIMARY KEY("bucket","window_start"),
	CONSTRAINT "ai_rate_limits_count_nonnegative" CHECK ("ai_rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ai_response_cache" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"model" text,
	"status" text DEFAULT 'ok' NOT NULL,
	"error_code" text,
	"result" jsonb,
	"hits" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"model" text,
	"outcome" text NOT NULL,
	"error_code" text,
	"subject_key" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_input_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_events_cost_nonnegative" CHECK ("ai_usage_events"."cost_usd" >= 0)
);
--> statement-breakpoint
CREATE INDEX "ai_rate_limits_window_idx" ON "ai_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "ai_response_cache_expiry_idx" ON "ai_response_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ai_response_cache_feature_idx" ON "ai_response_cache" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_usage_events_created_idx" ON "ai_usage_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_feature_idx" ON "ai_usage_events" USING btree ("feature","created_at");