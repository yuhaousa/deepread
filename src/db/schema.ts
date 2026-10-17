// 深读 DeepRead 数据模型（Drizzle ORM · PostgreSQL 16）
// 三段组织：材料（passages/content_cards/key_points/exercises）→ 训练记录（sessions/responses）
// → 学习者模型（ability_attempts/mastery/review_items）。
// 学生作答原文集中在 responses / tutor_messages，便于按合规要求整体删除。

import { relations } from "drizzle-orm";
import { type AnyPgColumn, boolean, index, integer, jsonb, pgEnum, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["STUDENT", "TEACHER", "PARENT", "ADMIN", "EDITOR"]);
export const abilityEnum = pgEnum("ability", ["FOCUS", "RECALL", "COMPREHEND", "ANALYZE", "VERIFY", "EXPRESS"]);
export const levelEnum = pgEnum("level", ["L1", "L2", "L3", "L4", "L5"]);
export const passageStatusEnum = pgEnum("passage_status", ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]);
export const exerciseTypeEnum = pgEnum("exercise_type", ["PREDICT", "ROLES", "AUDIT", "QUIZ", "SEQUENCE", "SUMMARY", "TRANSFER"]);
export const stepEnum = pgEnum("session_step", ["PREDICT", "READ", "RECALL", "ANALYZE", "EXPRESS", "FEEDBACK", "DONE"]);
export const scoreSourceEnum = pgEnum("score_source", ["RULE", "KEYWORD", "AI", "TEACHER"]);
export const tutorRoleEnum = pgEnum("tutor_role", ["READING", "RECALL_COACH", "DEBATE", "VERIFY"]);
export const aiPurposeEnum = pgEnum("ai_purpose", ["RECALL", "RUBRIC", "TUTOR", "GUARDRAIL"]);

export const schools = pgTable("schools", {
  id: id(),
  name: text("name").notNull(),
  region: text("region").notNull().default("intl"), // intl | cn
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(), // 学生用学号，教师用邮箱
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: roleEnum("role").notNull(),
  grade: text("grade"),
  guardianConsentAt: timestamp("guardian_consent_at", { withTimezone: true }), // 为空时学生不可使用 AI 对话
  classroomId: text("classroom_id").references((): AnyPgColumn => classrooms.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const classrooms = pgTable("classrooms", {
  id: id(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const passages = pgTable("passages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  grade: text("grade").notNull(),
  level: levelEnum("level").notNull(),
  primaryAbility: abilityEnum("primary_ability").notNull(),
  tutorRole: tutorRoleEnum("tutor_role").notNull(),
  lead: text("lead").notNull(),
  paragraphs: text("paragraphs").array().notNull(),
  charCount: integer("char_count").notNull(),
  status: passageStatusEnum("status").notNull().default("DRAFT"),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const contentCards = pgTable("content_cards", {
  id: id(),
  passageId: text("passage_id").notNull().unique().references(() => passages.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 来源与授权
  structure: text("structure").notNull(),
  concepts: text("concepts").array().notNull(),
  thesisLocation: text("thesis_location").notNull(),
  misreadings: text("misreadings").array().notNull(),
  prerequisites: text("prerequisites"),
  goals: text("goals").array().notNull(),
  review: jsonb("review").$type<{ factCheck: boolean; ageFit: boolean; groundedQuestions: boolean; reviewer: string; version: string }>().notNull(),
  refSummary: text("ref_summary").notNull(),
});

export const keyPoints = pgTable(
  "key_points",
  {
    id: id(),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    text: text("text").notNull(),
    keywords: text("keywords").array().notNull(),
    paragraph: integer("paragraph").notNull(), // 1-based
  },
  (t) => [uniqueIndex("key_points_passage_order").on(t.passageId, t.order)],
);

export const exercises = pgTable(
  "exercises",
  {
    id: id(),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    step: stepEnum("step").notNull(),
    type: exerciseTypeEnum("type").notNull(),
    ability: abilityEnum("ability").notNull(),
    order: integer("order").notNull(),
    spec: jsonb("spec").notNull(), // 题型差异：题干、选项、答案、解析
  },
  (t) => [uniqueIndex("exercises_passage_order").on(t.passageId, t.order)],
);

export const assignments = pgTable("assignments", {
  id: id(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  passageId: text("passage_id").notNull().references(() => passages.id),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    passageId: text("passage_id").notNull().references(() => passages.id),
    passageVersion: integer("passage_version").notNull(),
    assignmentId: text("assignment_id").references(() => assignments.id),
    step: stepEnum("step").notNull().default("PREDICT"),
    question: text("question"), // 学生读前提出的问题
    highlights: text("highlights").array().notNull().default([]), // "段-句" 标记
    readingSeconds: integer("reading_seconds"),
    lookbacks: integer("lookbacks").notNull().default(0),
    confidence: integer("confidence"), // 1–5 自评读懂程度
    summary: jsonb("summary"), // 今日反馈结算结果
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("sessions_student_started").on(t.studentId, t.startedAt), index("sessions_assignment").on(t.assignmentId)],
);

export const responses = pgTable(
  "responses",
  {
    id: id(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // predict | recall | analysis | summary
    answer: jsonb("answer").notNull(),
    score: real("score"), // 0–1
    detail: jsonb("detail"), // 逐项对错、覆盖的关键点、量表分项
    source: scoreSourceEnum("source").notNull(),
    feedback: jsonb("feedback"), // AI 反馈（含 AI 标识）
    flagged: boolean("flagged").notNull().default(false), // 进入人工抽检
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("responses_session_kind").on(t.sessionId, t.kind)],
);

export const tutorMessages = pgTable("tutor_messages", {
  id: id(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  tutorRole: tutorRoleEnum("tutor_role").notNull(),
  step: stepEnum("step").notNull(),
  content: text("content").notNull(),
  guardrail: jsonb("guardrail"), // { leaked, reason, rewritten }
  createdAt: createdAt(),
});

export const reviewItems = pgTable(
  "review_items",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    keyPointId: text("key_point_id").notNull().references(() => keyPoints.id, { onDelete: "cascade" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    intervalD: integer("interval_d").notNull(),
    answer: text("answer"),
    passed: boolean("passed"),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [index("review_items_student_due").on(t.studentId, t.dueAt)],
);

export const abilityAttempts = pgTable(
  "ability_attempts",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    ability: abilityEnum("ability").notNull(),
    level: levelEnum("level").notNull(),
    genre: text("genre").notNull(),
    score: real("score").notNull(), // 0–1 本次该能力任务达标率
    createdAt: createdAt(),
  },
  (t) => [index("ability_attempts_student").on(t.studentId, t.ability, t.createdAt)],
);

export const mastery = pgTable(
  "mastery",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ability: abilityEnum("ability").notNull(),
    level: levelEnum("level").notNull().default("L2"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("mastery_student_ability").on(t.studentId, t.ability)],
);

export const aiCalls = pgTable("ai_calls", {
  id: id(),
  purpose: aiPurposeEnum("purpose").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  userHash: text("user_hash"),
  inputTok: integer("input_tok"),
  outputTok: integer("output_tok"),
  latencyMs: integer("latency_ms").notNull(),
  ok: boolean("ok").notNull(),
  error: text("error"),
  createdAt: createdAt(),
});

// ── relations（供 db.query.* 关系查询使用）──
export const usersRelations = relations(users, ({ one, many }) => ({
  classroom: one(classrooms, { fields: [users.classroomId], references: [classrooms.id] }),
  sessions: many(sessions),
}));
export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  school: one(schools, { fields: [classrooms.schoolId], references: [schools.id] }),
  teacher: one(users, { fields: [classrooms.teacherId], references: [users.id] }),
  students: many(users),
  assignments: many(assignments),
}));
export const passagesRelations = relations(passages, ({ one, many }) => ({
  card: one(contentCards, { fields: [passages.id], references: [contentCards.passageId] }),
  keyPoints: many(keyPoints),
  exercises: many(exercises),
}));
export const contentCardsRelations = relations(contentCards, ({ one }) => ({
  passage: one(passages, { fields: [contentCards.passageId], references: [passages.id] }),
}));
export const keyPointsRelations = relations(keyPoints, ({ one }) => ({
  passage: one(passages, { fields: [keyPoints.passageId], references: [passages.id] }),
}));
export const exercisesRelations = relations(exercises, ({ one }) => ({
  passage: one(passages, { fields: [exercises.passageId], references: [passages.id] }),
}));
export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  classroom: one(classrooms, { fields: [assignments.classroomId], references: [classrooms.id] }),
  passage: one(passages, { fields: [assignments.passageId], references: [passages.id] }),
  sessions: many(sessions),
}));
export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  student: one(users, { fields: [sessions.studentId], references: [users.id] }),
  passage: one(passages, { fields: [sessions.passageId], references: [passages.id] }),
  assignment: one(assignments, { fields: [sessions.assignmentId], references: [assignments.id] }),
  responses: many(responses),
}));
export const responsesRelations = relations(responses, ({ one }) => ({
  session: one(sessions, { fields: [responses.sessionId], references: [sessions.id] }),
}));
export const reviewItemsRelations = relations(reviewItems, ({ one }) => ({
  keyPoint: one(keyPoints, { fields: [reviewItems.keyPointId], references: [keyPoints.id] }),
}));
