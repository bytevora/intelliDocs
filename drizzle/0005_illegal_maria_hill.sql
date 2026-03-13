PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_visuals` (
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
--> statement-breakpoint
INSERT INTO `__new_visuals`("id", "document_id", "source_text", "visual_type", "render_mode", "mermaid_syntax", "custom_data", "theme", "created_at", "updated_at") SELECT "id", "document_id", "source_text", "visual_type", "render_mode", "mermaid_syntax", "custom_data", "theme", "created_at", "updated_at" FROM `visuals`;--> statement-breakpoint
DROP TABLE `visuals`;--> statement-breakpoint
ALTER TABLE `__new_visuals` RENAME TO `visuals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;