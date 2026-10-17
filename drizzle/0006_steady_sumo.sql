CREATE TABLE `event_transfer_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`outcome` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_transfer_runs_owner` ON `event_transfer_runs` (`owner`);