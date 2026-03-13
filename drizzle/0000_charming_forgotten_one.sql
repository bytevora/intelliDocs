CREATE TABLE `document_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`shared_with` text NOT NULL,
	`permission` text DEFAULT 'viewer' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_with`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text DEFAULT 'Untitled' NOT NULL,
	`content` text DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}' NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`yjs_state` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `visual_cache` (
	`content_hash` text PRIMARY KEY NOT NULL,
	`visual_type` text NOT NULL,
	`render_mode` text NOT NULL,
	`mermaid_syntax` text DEFAULT '' NOT NULL,
	`custom_data` text,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visuals` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`source_text` text NOT NULL,
	`visual_type` text NOT NULL,
	`render_mode` text DEFAULT 'mermaid' NOT NULL,
	`mermaid_syntax` text DEFAULT '' NOT NULL,
	`custom_data` text,
	`theme` text DEFAULT 'default' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
