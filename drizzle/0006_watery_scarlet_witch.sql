CREATE TABLE IF NOT EXISTS `visual_cache` (
	`content_hash` text PRIMARY KEY NOT NULL,
	`visual_type` text NOT NULL,
	`render_mode` text NOT NULL,
	`mermaid_syntax` text DEFAULT '' NOT NULL,
	`custom_data` text,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
