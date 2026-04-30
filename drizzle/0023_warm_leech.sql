CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255),
	`phone` varchar(100),
	`address` text,
	`logoUrl` text,
	`logoFileKey` varchar(500),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`)
);
