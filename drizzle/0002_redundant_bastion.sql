CREATE TABLE `visuals` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`source_text` text NOT NULL,
	`visual_type` text NOT NULL,
	`mermaid_syntax` text NOT NULL,
	`theme` text DEFAULT 'default' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
