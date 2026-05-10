CREATE TABLE `survey_template_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`templateId` int NOT NULL,
	`fieldId` int NOT NULL,
	`value` text,
	`otherValue` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `survey_template_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_template_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`fieldName` varchar(255) NOT NULL,
	`fieldLabel` varchar(255) NOT NULL,
	`fieldType` enum('text','number','textarea','select','checkbox','checkbox_group','radio','date','distance','yes_no','section_header') NOT NULL,
	`fieldOptions` text,
	`hasOtherOption` boolean NOT NULL DEFAULT false,
	`placeholder` varchar(255),
	`defaultValue` text,
	`required` boolean NOT NULL DEFAULT false,
	`sectionGroup` varchar(100),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_template_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`sourceId` int,
	`pdfHeaderTitle` varchar(255),
	`pdfHeaderSubtitle` varchar(255),
	`pdfLogoUrl` text,
	`pdfLogoFileKey` varchar(512),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `survey_templates_id` PRIMARY KEY(`id`)
);
