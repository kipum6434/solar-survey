ALTER TABLE `surveys` ADD `panelBrand` varchar(255);--> statement-breakpoint
ALTER TABLE `surveys` ADD `needBattery` enum('yes','no','undecided');--> statement-breakpoint
ALTER TABLE `surveys` ADD `needOptimizer` enum('yes','no','undecided');--> statement-breakpoint
ALTER TABLE `surveys` ADD `systemType` enum('string','micro','both');