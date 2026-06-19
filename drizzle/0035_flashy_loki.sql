CREATE TABLE `document_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`documentNumber` varchar(100) NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_settings_settingKey_unique` UNIQUE(`settingKey`)
);
