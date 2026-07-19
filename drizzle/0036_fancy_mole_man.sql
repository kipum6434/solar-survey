ALTER TABLE `delivery_forms` MODIFY COLUMN `status` enum('draft','pending_signature','signed','completed') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin','warehouse') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `company_settings` ADD `disclaimerText` text;--> statement-breakpoint
ALTER TABLE `delivery_forms` ADD `selectedPhotoIds` text;--> statement-breakpoint
ALTER TABLE `delivery_forms` ADD `customSections` text;--> statement-breakpoint
ALTER TABLE `delivery_forms` ADD `handoverToken` varchar(64);--> statement-breakpoint
ALTER TABLE `delivery_forms` ADD `customerSignerName` varchar(255);--> statement-breakpoint
ALTER TABLE `delivery_forms` ADD `handoverSentAt` bigint;