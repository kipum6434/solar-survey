CREATE TABLE `document_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_categories_key_unique` UNIQUE(`key`)
);
