CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`photo_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`photo_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`photo_id`, `user_id`),
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`caption` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `seat` integer;--> statement-breakpoint
ALTER TABLE `members` ADD `mood` text DEFAULT '开心' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `members_seat_unique` ON `members` (`seat`);