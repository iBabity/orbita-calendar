CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`calendar` text NOT NULL,
	`description` text NOT NULL,
	`location` text NOT NULL,
	`all_day` integer NOT NULL,
	`version` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_owner` ON `events` (`owner`);