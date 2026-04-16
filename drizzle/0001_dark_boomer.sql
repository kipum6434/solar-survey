CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(50),
	`email` varchar(320),
	`address` text,
	`province` varchar(100),
	`district` varchar(100),
	`subDistrict` varchar(100),
	`postalCode` varchar(10),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`source` enum('walk_in','telesale','facebook','line','website','referral','other') DEFAULT 'other',
	`electricityBill` decimal(10,2),
	`roofType` varchar(100),
	`roofArea` decimal(10,2),
	`phaseType` enum('single','three'),
	`meterSize` varchar(50),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`customerId` int NOT NULL,
	`dueDate` bigint NOT NULL,
	`status` enum('pending','completed','overdue','cancelled') NOT NULL DEFAULT 'pending',
	`method` enum('phone','line','visit','email','other') DEFAULT 'phone',
	`notes` text,
	`result` text,
	`completedAt` bigint,
	`assignedTo` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('follow_up_due','status_changed','new_assignment','new_survey','document_uploaded','general') NOT NULL DEFAULT 'general',
	`title` varchar(255) NOT NULL,
	`message` text,
	`relatedSurveyId` int,
	`relatedCustomerId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`expiresAt` bigint,
	`isActive` boolean NOT NULL DEFAULT true,
	`allowPhotos` boolean NOT NULL DEFAULT true,
	`allowDocuments` boolean NOT NULL DEFAULT true,
	`viewCount` int NOT NULL DEFAULT 0,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `share_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `share_links_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `survey_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`customerId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileType` enum('quotation','simulation','contract','other') DEFAULT 'other',
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `survey_photos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`customerId` int NOT NULL,
	`url` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileName` varchar(255),
	`category` enum('roof_overview','roof_detail','electrical_panel','meter','inverter_location','surroundings','other') DEFAULT 'other',
	`caption` text,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `survey_photos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `surveys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`status` enum('pending','scheduled','in_progress','surveyed','quoted','negotiating','won','lost','cancelled') NOT NULL DEFAULT 'pending',
	`scheduledDate` bigint,
	`scheduledTime` varchar(10),
	`assignedTo` int,
	`surveyNotes` text,
	`systemSize` decimal(10,2),
	`panelCount` int,
	`inverterModel` varchar(255),
	`estimatedCost` decimal(12,2),
	`quotedPrice` decimal(12,2),
	`completedAt` bigint,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `surveys_id` PRIMARY KEY(`id`)
);
