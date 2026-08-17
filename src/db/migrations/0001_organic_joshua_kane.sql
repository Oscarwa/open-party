CREATE INDEX "activity_options_event_id_idx" ON "activity_options" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "bring_items_event_id_idx" ON "bring_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_invitees_event_id_idx" ON "event_invitees" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_invitees_event_id_user_id_unique" ON "event_invitees" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "food_options_event_id_idx" ON "food_options" USING btree ("event_id");