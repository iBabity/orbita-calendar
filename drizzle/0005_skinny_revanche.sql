CREATE TABLE `google_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`tokens` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_oauth_states` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`verifier` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `google_oauth_states_owner` ON `google_oauth_states` (`owner`);--> statement-breakpoint
CREATE TABLE `google_update_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`outcome` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `google_update_runs_owner` ON `google_update_runs` (`owner`);