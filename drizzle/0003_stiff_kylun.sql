CREATE TABLE `broadcasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foods_name_unique` ON `foods` (`name`);--> statement-breakpoint
CREATE TABLE `meals` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`slot` text NOT NULL,
	`body` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`, `slot`)
);
--> statement-breakpoint
CREATE TABLE `ratings` (
	`food_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stars` integer NOT NULL,
	PRIMARY KEY(`food_id`, `user_id`),
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `members` ADD `companion` text DEFAULT '🧸' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `snack` text DEFAULT '🍪' NOT NULL;