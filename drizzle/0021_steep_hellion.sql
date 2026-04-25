CREATE TABLE `line_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` varchar(64) NOT NULL,
	`groupName` varchar(255),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `line_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_groups_groupId_unique` UNIQUE(`groupId`)
);
--> statement-breakpoint
CREATE TABLE `line_notification_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('user','group') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`label` varchar(255),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `line_notification_targets_id` PRIMARY KEY(`id`)
);
