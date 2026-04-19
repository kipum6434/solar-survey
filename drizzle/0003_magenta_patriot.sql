CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(100),
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `sources_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `survey_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('admin_sender','surveyor','closer') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` MODIFY COLUMN `source` varchar(255) DEFAULT 'other';--> statement-breakpoint
ALTER TABLE `surveys` ADD `adminSenderId` int;--> statement-breakpoint
ALTER TABLE `surveys` ADD `closerId` int;