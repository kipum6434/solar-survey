ALTER TABLE `surveys` ADD `deliveryStatus` enum('pending','submitted','approved','rejected') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `surveys` ADD `deliverySubmittedAt` bigint;--> statement-breakpoint
ALTER TABLE `surveys` ADD `deliverySubmittedBy` int;--> statement-breakpoint
ALTER TABLE `surveys` ADD `deliveryApprovedAt` bigint;--> statement-breakpoint
ALTER TABLE `surveys` ADD `deliveryApprovedBy` int;--> statement-breakpoint
ALTER TABLE `surveys` ADD `deliveryRejectionReason` text;