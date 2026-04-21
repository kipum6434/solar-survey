CREATE TABLE `custom_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('customer','survey') NOT NULL,
	`label` varchar(255) NOT NULL,
	`color` varchar(50) NOT NULL DEFAULT '#6b7280',
	`bgColor` varchar(50) NOT NULL DEFAULT '#f3f4f6',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_statuses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `statusId` int;--> statement-breakpoint
ALTER TABLE `surveys` ADD `statusId` int;--> statement-breakpoint
ALTER TABLE `surveys` ADD `installationDate` bigint;