CREATE TABLE `installation_photo_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `installation_photo_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `installation_photo_categories_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `installation_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileName` varchar(255),
	`category` varchar(100) DEFAULT 'other',
	`fileSize` int,
	`caption` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `installation_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `survey_documents` MODIFY COLUMN `fileType` varchar(100) DEFAULT 'other';