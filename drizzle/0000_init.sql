CREATE TYPE "public"."ability" AS ENUM('FOCUS', 'RECALL', 'COMPREHEND', 'ANALYZE', 'VERIFY', 'EXPRESS');--> statement-breakpoint
CREATE TYPE "public"."ai_purpose" AS ENUM('RECALL', 'RUBRIC', 'TUTOR', 'GUARDRAIL');--> statement-breakpoint
CREATE TYPE "public"."exercise_type" AS ENUM('PREDICT', 'ROLES', 'AUDIT', 'QUIZ', 'SEQUENCE', 'SUMMARY', 'TRANSFER');--> statement-breakpoint
CREATE TYPE "public"."level" AS ENUM('L1', 'L2', 'L3', 'L4', 'L5');--> statement-breakpoint
CREATE TYPE "public"."passage_status" AS ENUM('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('STUDENT', 'TEACHER', 'PARENT', 'ADMIN', 'EDITOR');--> statement-breakpoint
CREATE TYPE "public"."score_source" AS ENUM('RULE', 'KEYWORD', 'AI', 'TEACHER');--> statement-breakpoint
CREATE TYPE "public"."session_step" AS ENUM('PREDICT', 'READ', 'RECALL', 'ANALYZE', 'EXPRESS', 'FEEDBACK', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."tutor_role" AS ENUM('READING', 'RECALL_COACH', 'DEBATE', 'VERIFY');--> statement-breakpoint
CREATE TABLE "ability_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"session_id" text NOT NULL,
	"ability" "ability" NOT NULL,
	"level" "level" NOT NULL,
	"genre" text NOT NULL,
	"score" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"purpose" "ai_purpose" NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"user_hash" text,
	"input_tok" integer,
	"output_tok" integer,
	"latency_ms" integer NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"classroom_id" text NOT NULL,
	"passage_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classrooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grade" text NOT NULL,
	"school_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"passage_id" text NOT NULL,
	"source" text NOT NULL,
	"structure" text NOT NULL,
	"concepts" text[] NOT NULL,
	"thesis_location" text NOT NULL,
	"misreadings" text[] NOT NULL,
	"prerequisites" text,
	"goals" text[] NOT NULL,
	"review" jsonb NOT NULL,
	"ref_summary" text NOT NULL,
	CONSTRAINT "content_cards_passage_id_unique" UNIQUE("passage_id")
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"passage_id" text NOT NULL,
	"step" "session_step" NOT NULL,
	"type" "exercise_type" NOT NULL,
	"ability" "ability" NOT NULL,
	"order" integer NOT NULL,
	"spec" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "key_points" (
	"id" text PRIMARY KEY NOT NULL,
	"passage_id" text NOT NULL,
	"order" integer NOT NULL,
	"text" text NOT NULL,
	"keywords" text[] NOT NULL,
	"paragraph" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"ability" "ability" NOT NULL,
	"level" "level" DEFAULT 'L2' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"genre" text NOT NULL,
	"grade" text NOT NULL,
	"level" "level" NOT NULL,
	"primary_ability" "ability" NOT NULL,
	"tutor_role" "tutor_role" NOT NULL,
	"lead" text NOT NULL,
	"paragraphs" text[] NOT NULL,
	"char_count" integer NOT NULL,
	"status" "passage_status" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "responses" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"answer" jsonb NOT NULL,
	"score" real,
	"detail" jsonb,
	"source" "score_source" NOT NULL,
	"feedback" jsonb,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_items" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"key_point_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"interval_d" integer NOT NULL,
	"answer" text,
	"passed" boolean,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text DEFAULT 'intl' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"passage_id" text NOT NULL,
	"passage_version" integer NOT NULL,
	"assignment_id" text,
	"step" "session_step" DEFAULT 'PREDICT' NOT NULL,
	"question" text,
	"highlights" text[] DEFAULT '{}' NOT NULL,
	"reading_seconds" integer,
	"lookbacks" integer DEFAULT 0 NOT NULL,
	"confidence" integer,
	"summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tutor_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"tutor_role" "tutor_role" NOT NULL,
	"step" "session_step" NOT NULL,
	"content" text NOT NULL,
	"guardrail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "role" NOT NULL,
	"grade" text,
	"guardian_consent_at" timestamp with time zone,
	"classroom_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "ability_attempts" ADD CONSTRAINT "ability_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ability_attempts" ADD CONSTRAINT "ability_attempts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_cards" ADD CONSTRAINT "content_cards_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "key_points" ADD CONSTRAINT "key_points_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery" ADD CONSTRAINT "mastery_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responses" ADD CONSTRAINT "responses_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_items" ADD CONSTRAINT "review_items_key_point_id_key_points_id_fk" FOREIGN KEY ("key_point_id") REFERENCES "public"."key_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_passage_id_passages_id_fk" FOREIGN KEY ("passage_id") REFERENCES "public"."passages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_messages" ADD CONSTRAINT "tutor_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "public"."classrooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ability_attempts_student" ON "ability_attempts" USING btree ("student_id","ability","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_passage_order" ON "exercises" USING btree ("passage_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "key_points_passage_order" ON "key_points" USING btree ("passage_id","order");--> statement-breakpoint
CREATE UNIQUE INDEX "mastery_student_ability" ON "mastery" USING btree ("student_id","ability");--> statement-breakpoint
CREATE UNIQUE INDEX "responses_session_kind" ON "responses" USING btree ("session_id","kind");--> statement-breakpoint
CREATE INDEX "review_items_student_due" ON "review_items" USING btree ("student_id","due_at");--> statement-breakpoint
CREATE INDEX "sessions_student_started" ON "sessions" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_assignment" ON "sessions" USING btree ("assignment_id");