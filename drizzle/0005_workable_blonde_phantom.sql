CREATE TABLE `simulation_items` (
	`scenario_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`selling_price` real NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`scenario_id`, `recipe_id`),
	FOREIGN KEY (`scenario_id`) REFERENCES `simulation_scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_simulation_items_recipe_id` ON `simulation_items` (`recipe_id`);--> statement-breakpoint
CREATE TABLE `simulation_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`memo` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_simulation_scenarios_project_id` ON `simulation_scenarios` (`project_id`);