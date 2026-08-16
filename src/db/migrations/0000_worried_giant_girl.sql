CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'finalized', 'completed');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'attending', 'declined');--> statement-breakpoint
CREATE TABLE "activity_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bring_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"assigned_to_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "event_invitees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invite_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'pending' NOT NULL,
	"decline_reason" text,
	"food_choice_1" uuid,
	"food_choice_2" uuid,
	"food_choice_3" uuid,
	"activity_choice_1" uuid,
	"activity_choice_2" uuid,
	"activity_choice_3" uuid,
	"bring_item_id" uuid,
	"rsvp_at" timestamp with time zone,
	CONSTRAINT "event_invitees_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"description" text,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"final_food_option_id" uuid,
	"final_activity_option_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"whatsapp_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_whatsapp_number_unique" UNIQUE("whatsapp_number")
);
--> statement-breakpoint
ALTER TABLE "activity_options" ADD CONSTRAINT "activity_options_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bring_items" ADD CONSTRAINT "bring_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bring_items" ADD CONSTRAINT "bring_items_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_food_choice_1_food_options_id_fk" FOREIGN KEY ("food_choice_1") REFERENCES "public"."food_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_food_choice_2_food_options_id_fk" FOREIGN KEY ("food_choice_2") REFERENCES "public"."food_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_food_choice_3_food_options_id_fk" FOREIGN KEY ("food_choice_3") REFERENCES "public"."food_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_activity_choice_1_activity_options_id_fk" FOREIGN KEY ("activity_choice_1") REFERENCES "public"."activity_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_activity_choice_2_activity_options_id_fk" FOREIGN KEY ("activity_choice_2") REFERENCES "public"."activity_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_activity_choice_3_activity_options_id_fk" FOREIGN KEY ("activity_choice_3") REFERENCES "public"."activity_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_invitees" ADD CONSTRAINT "event_invitees_bring_item_id_bring_items_id_fk" FOREIGN KEY ("bring_item_id") REFERENCES "public"."bring_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_options" ADD CONSTRAINT "food_options_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;