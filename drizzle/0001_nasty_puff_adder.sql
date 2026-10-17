CREATE TABLE `calendar_names` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
