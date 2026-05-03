CREATE TABLE `postpone_cancel_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`surveyId` int NOT NULL,
	`action` enum('postpone_survey','cancel_survey','postpone_install','cancel_install') NOT NULL,
	`reason` text NOT NULL,
	`newDate` bigint,
	`previousDate` bigint,
	`actionBy` varchar(255) NOT NULL,
	`actionByRole` enum('admin','surveyor','installer') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `postpone_cancel_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `surveys` MODIFY COLUMN `status` enum('pending','scheduled','in_progress','surveyed','follow_up','quoted','negotiating','won','lost','cancelled','postponed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `surveys` MODIFY COLUMN `installationStatus` enum('waiting','in_progress','completed','delivered','postponed','cancelled');--> statement-breakpoint
-- installationCompletedAt already exists, skipping