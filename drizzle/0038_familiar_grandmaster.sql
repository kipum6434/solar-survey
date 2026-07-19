CREATE TABLE `company_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(100),
	`logoUrl` text,
	`logoFileKey` varchar(500),
	`headerColor` varchar(20) DEFAULT '#1e3a5f',
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_profiles_id` PRIMARY KEY(`id`)
);
