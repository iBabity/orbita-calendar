CREATE TABLE `deletion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`targets` text NOT NULL,
	`outcomes` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `deletion_runs_owner` ON `deletion_runs` (`owner`);