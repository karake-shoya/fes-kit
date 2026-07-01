CREATE INDEX `idx_ingredients_project_id` ON `ingredients` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_members_user_id` ON `project_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_prototype_logs_recipe_id` ON `prototype_logs` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `idx_recipe_ingredients_ingredient_id` ON `recipe_ingredients` (`ingredient_id`);--> statement-breakpoint
CREATE INDEX `idx_recipes_project_id` ON `recipes` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_schedules_project_id` ON `schedules` (`project_id`);