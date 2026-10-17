CREATE TABLE `training_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`targets` text NOT NULL,
	`outcomes` text NOT NULL,
	`state` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `training_runs_owner` ON `training_runs` (`owner`);