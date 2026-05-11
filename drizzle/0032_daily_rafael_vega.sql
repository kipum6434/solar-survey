CREATE TABLE `payment_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`note` text,
	`collectedAt` bigint NOT NULL,
	`slipUrl` text,
	`slipFileKey` varchar(512),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_groups_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `amount` decimal(12,2);--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `status` enum('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` ADD `name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` ADD `items` text NOT NULL;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` ADD `isDefault` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` ADD `createdBy` int;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `payments` ADD `paymentDate` bigint;--> statement-breakpoint
ALTER TABLE `payments` ADD `contractValue` decimal(12,2);--> statement-breakpoint
ALTER TABLE `payments` ADD `collectedAmount` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `sources` ADD `groupName` varchar(100);--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` DROP COLUMN `label`;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` DROP COLUMN `sortOrder`;--> statement-breakpoint
ALTER TABLE `delivery_checklist_templates` DROP COLUMN `isActive`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `paidAt`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `confirmedBy`;--> statement-breakpoint
ALTER TABLE `payments` DROP COLUMN `confirmedAt`;