CREATE TABLE `calendar_states` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`deleted` integer NOT NULL,
	`version` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
