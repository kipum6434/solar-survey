ALTER TABLE `installation_photo_categories` ADD `isRequired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `installation_photo_categories` ADD `isConditional` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `installation_photo_categories` ADD `conditionNote` varchar(500);