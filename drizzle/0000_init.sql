CREATE TABLE `ability_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`session_id` text NOT NULL,
	`ability` text NOT NULL,
	`level` text NOT NULL,
	`genre` text NOT NULL,
	`score` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ability_attempts_student` ON `ability_attempts` (`student_id`,`ability`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`purpose` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`user_hash` text,
	`input_tok` integer,
	`output_tok` integer,
	`latency_ms` integer NOT NULL,
	`ok` integer NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom_id` text NOT NULL,
	`passage_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`grade` text NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`passage_id` text NOT NULL,
	`source` text NOT NULL,
	`structure` text NOT NULL,
	`concepts` text NOT NULL,
	`thesis_location` text NOT NULL,
	`misreadings` text NOT NULL,
	`prerequisites` text,
	`goals` text NOT NULL,
	`review` text NOT NULL,
	`ref_summary` text NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_cards_passage_id_unique` ON `content_cards` (`passage_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`passage_id` text NOT NULL,
	`step` text NOT NULL,
	`type` text NOT NULL,
	`ability` text NOT NULL,
	`order` integer NOT NULL,
	`spec` text NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_passage_order` ON `exercises` (`passage_id`,`order`);--> statement-breakpoint
CREATE TABLE `key_points` (
	`id` text PRIMARY KEY NOT NULL,
	`passage_id` text NOT NULL,
	`order` integer NOT NULL,
	`text` text NOT NULL,
	`keywords` text NOT NULL,
	`paragraph` integer NOT NULL,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `key_points_passage_order` ON `key_points` (`passage_id`,`order`);--> statement-breakpoint
CREATE TABLE `mastery` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`ability` text NOT NULL,
	`level` text DEFAULT 'L2' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mastery_student_ability` ON `mastery` (`student_id`,`ability`);--> statement-breakpoint
CREATE TABLE `passages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`genre` text NOT NULL,
	`grade` text NOT NULL,
	`level` text NOT NULL,
	`primary_ability` text NOT NULL,
	`tutor_role` text NOT NULL,
	`lead` text NOT NULL,
	`paragraphs` text NOT NULL,
	`char_count` integer NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passages_slug_unique` ON `passages` (`slug`);--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`answer` text NOT NULL,
	`score` real,
	`detail` text,
	`source` text NOT NULL,
	`feedback` text,
	`flagged` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_session_kind` ON `responses` (`session_id`,`kind`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`key_point_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`interval_d` integer NOT NULL,
	`answer` text,
	`passed` integer,
	`done_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`key_point_id`) REFERENCES `key_points`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_items_student_due` ON `review_items` (`student_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`region` text DEFAULT 'intl' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`passage_id` text NOT NULL,
	`passage_version` integer NOT NULL,
	`assignment_id` text,
	`step` text DEFAULT 'PREDICT' NOT NULL,
	`question` text,
	`highlights` text NOT NULL,
	`reading_seconds` integer,
	`lookbacks` integer DEFAULT 0 NOT NULL,
	`confidence` integer,
	`summary` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`passage_id`) REFERENCES `passages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_student_started` ON `sessions` (`student_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `sessions_assignment` ON `sessions` (`assignment_id`);--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`tutor_role` text NOT NULL,
	`step` text NOT NULL,
	`content` text NOT NULL,
	`guardrail` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`grade` text,
	`guardian_consent_at` integer,
	`classroom_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);