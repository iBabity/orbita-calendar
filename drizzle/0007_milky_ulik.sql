CREATE TABLE `calendar_colors` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`color` text,
	`version` integer NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
