CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`price_cents` integer NOT NULL,
	`reason` text NOT NULL,
	`electorate` text NOT NULL,
	`threshold` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`version` integer NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `votes` (
	`purchase_id` text NOT NULL,
	`user_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL,
	PRIMARY KEY(`purchase_id`, `user_id`),
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE no action
);
