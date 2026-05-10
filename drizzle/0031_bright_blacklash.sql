CREATE TABLE `delivery_checklist_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(500) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_checklist_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`customerId` int NOT NULL,
	`checklistTemplateId` int,
	`checklistData` text,
	`customerSignatureUrl` text,
	`customerSignatureKey` varchar(512),
	`technicianSignatureUrl` text,
	`technicianSignatureKey` varchar(512),
	`technicianName` varchar(255),
	`notes` text,
	`pdfUrl` text,
	`pdfFileKey` varchar(512),
	`status` enum('draft','signed','completed') NOT NULL DEFAULT 'draft',
	`signedAt` bigint,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`customerId` int NOT NULL,
	`amount` int,
	`paymentMethod` varchar(100),
	`slipUrl` text,
	`slipFileKey` varchar(512),
	`notes` text,
	`status` enum('pending','paid','confirmed') NOT NULL DEFAULT 'pending',
	`paidAt` bigint,
	`confirmedBy` int,
	`confirmedAt` bigint,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
