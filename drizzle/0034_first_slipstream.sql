CREATE TABLE `survey_technical_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`fieldDefinitionId` int NOT NULL,
	`value` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `survey_technical_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `technical_field_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(255) NOT NULL,
	`fieldType` enum('text','number','select','textarea') NOT NULL DEFAULT 'text',
	`placeholder` varchar(255),
	`options` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`isBuiltIn` boolean NOT NULL DEFAULT false,
	`fieldKey` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technical_field_definitions_id` PRIMARY KEY(`id`)
);
