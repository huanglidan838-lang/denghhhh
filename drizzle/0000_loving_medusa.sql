CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`mood` text NOT NULL,
	`drink` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar` text NOT NULL,
	`status` text NOT NULL,
	`drink` text NOT NULL,
	`updated` text NOT NULL
);
