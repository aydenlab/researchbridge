CREATE TABLE "profile_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"referee_email" text NOT NULL,
	"referee_name" text,
	"relationship" text,
	"status" "reference_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text NOT NULL,
	"note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_references" ADD CONSTRAINT "profile_references_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_references_unique" ON "profile_references" USING btree ("user_id","referee_email");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_references_token_key" ON "profile_references" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "profile_references_user_idx" ON "profile_references" USING btree ("user_id");