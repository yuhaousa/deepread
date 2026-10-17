// 深读 DeepRead 数据模型（Drizzle ORM · Cloudflare D1 / SQLite）
// D1 是 SQLite：枚举存为 text（取值由类型与 zod 校验保证），数组与 JSON 存为 JSON 文本，时间存为毫秒时间戳。
// 三段组织：材料（passages/content_cards/key_points/exercises）→ 训练记录（sessions/responses）
// → 学习者模型（ability_attempts/mastery/review_items）。
// 学生作答原文集中在 responses / tutor_messages，便于按合规要求整体删除。

import { relations } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
/** 时间戳（毫秒） */
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const createdAt = () => ts("created_at").notNull().$defaultFn(() => new Date());
/** JSON 文本列 */
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();
const bool = (name: string) => integer(name, { mode: "boolean" });

export const roleEnum = ["STUDENT", "TEACHER", "PARENT", "ADMIN", "EDITOR"] as const;
export const abilityEnum = ["FOCUS", "RECALL", "COMPREHEND", "ANALYZE", "VERIFY", "EXPRESS"] as const;
export const levelEnum = ["L1", "L2", "L3", "L4", "L5"] as const;
export const passageStatusEnum = ["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export const exerciseTypeEnum = ["PREDICT", "ROLES", "AUDIT", "QUIZ", "SEQUENCE", "SUMMARY", "TRANSFER"] as const;
export const stepEnum = ["PREDICT", "READ", "RECALL", "ANALYZE", "EXPRESS", "FEEDBACK", "DONE"] as const;
export const scoreSourceEnum = ["RULE", "KEYWORD", "AI", "TEACHER"] as const;
export const tutorRoleEnum = ["READING", "RECALL_COACH", "DEBATE", "VERIFY"] as const;
export const aiPurposeEnum = ["RECALL", "RUBRIC", "TUTOR", "GUARDRAIL"] as const;

export const schools = sqliteTable("schools", {
  id: id(),
  name: text("name").notNull(),
  region: text("region").notNull().default("intl"), // intl | cn
  createdAt: createdAt(),
});

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(), // 学生用学号，教师用邮箱
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: roleEnum }).notNull(),
  grade: text("grade"),
  guardianConsentAt: ts("guardian_consent_at"), // 为空时学生不可使用 AI 对话
  classroomId: text("classroom_id").references((): AnySQLiteColumn => classrooms.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const classrooms = sqliteTable("classrooms", {
  id: id(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  schoolId: text("school_id").notNull().references(() => schools.id),
  teacherId: text("teacher_id").notNull().references(() => users.id),
  createdAt: createdAt(),
});

export const passages = sqliteTable("passages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  grade: text("grade").notNull(),
  level: text("level", { enum: levelEnum }).notNull(),
  primaryAbility: text("primary_ability", { enum: abilityEnum }).notNull(),
  tutorRole: text("tutor_role", { enum: tutorRoleEnum }).notNull(),
  lead: text("lead").notNull(),
  paragraphs: json<string[]>("paragraphs").notNull(),
  charCount: integer("char_count").notNull(),
  status: text("status", { enum: passageStatusEnum }).notNull().default("DRAFT"),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
});

export const contentCards = sqliteTable("content_cards", {
  id: id(),
  passageId: text("passage_id").notNull().unique().references(() => passages.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 来源与授权
  structure: text("structure").notNull(),
  concepts: json<string[]>("concepts").notNull(),
  thesisLocation: text("thesis_location").notNull(),
  misreadings: json<string[]>("misreadings").notNull(),
  prerequisites: text("prerequisites"),
  goals: json<string[]>("goals").notNull(),
  review: json<{ factCheck: boolean; ageFit: boolean; groundedQuestions: boolean; reviewer: string; version: string }>("review").notNull(),
  refSummary: text("ref_summary").notNull(),
});

export const keyPoints = sqliteTable(
  "key_points",
  {
    id: id(),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    text: text("text").notNull(),
    keywords: json<string[]>("keywords").notNull(),
    paragraph: integer("paragraph").notNull(), // 1-based
  },
  (t) => [uniqueIndex("key_points_passage_order").on(t.passageId, t.order)],
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: id(),
    passageId: text("passage_id").notNull().references(() => passages.id, { onDelete: "cascade" }),
    step: text("step", { enum: stepEnum }).notNull(),
    type: text("type", { enum: exerciseTypeEnum }).notNull(),
    ability: text("ability", { enum: abilityEnum }).notNull(),
    order: integer("order").notNull(),
    spec: json<unknown>("spec").notNull(), // 题型差异：题干、选项、答案、解析
  },
  (t) => [uniqueIndex("exercises_passage_order").on(t.passageId, t.order)],
);

export const assignments = sqliteTable("assignments", {
  id: id(),
  classroomId: text("classroom_id").notNull().references(() => classrooms.id),
  passageId: text("passage_id").notNull().references(() => passages.id),
  dueAt: ts("due_at").notNull(),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    passageId: text("passage_id").notNull().references(() => passages.id),
    passageVersion: integer("passage_version").notNull(),
    assignmentId: text("assignment_id").references(() => assignments.id),
    step: text("step", { enum: stepEnum }).notNull().default("PREDICT"),
    question: text("question"), // 学生读前提出的问题
    highlights: json<string[]>("highlights").notNull().$defaultFn(() => []), // "段-句" 标记
    readingSeconds: integer("reading_seconds"),
    lookbacks: integer("lookbacks").notNull().default(0),
    confidence: integer("confidence"), // 1–5 自评读懂程度
    summary: json<unknown>("summary"), // 今日反馈结算结果
    startedAt: ts("started_at").notNull().$defaultFn(() => new Date()),
    completedAt: ts("completed_at"),
  },
  (t) => [index("sessions_student_started").on(t.studentId, t.startedAt), index("sessions_assignment").on(t.assignmentId)],
);

export const responses = sqliteTable(
  "responses",
  {
    id: id(),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // predict | recall | analysis | summary
    answer: json<unknown>("answer").notNull(),
    score: real("score"), // 0–1
    detail: json<unknown>("detail"), // 逐项对错、覆盖的关键点、量表分项
    source: text("source", { enum: scoreSourceEnum }).notNull(),
    feedback: json<unknown>("feedback"), // AI 反馈（含 AI 标识）
    flagged: bool("flagged").notNull().default(false), // 进入人工抽检
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("responses_session_kind").on(t.sessionId, t.kind)],
);

export const tutorMessages = sqliteTable("tutor_messages", {
  id: id(),
  sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  tutorRole: text("tutor_role", { enum: tutorRoleEnum }).notNull(),
  step: text("step", { enum: stepEnum }).notNull(),
  content: text("content").notNull(),
  guardrail: json<unknown>("guardrail"), // { leaked, reason, rewritten }
  createdAt: createdAt(),
});

export const reviewItems = sqliteTable(
  "review_items",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    keyPointId: text("key_point_id").notNull().references(() => keyPoints.id, { onDelete: "cascade" }),
    dueAt: ts("due_at").notNull(),
    intervalD: integer("interval_d").notNull(),
    answer: text("answer"),
    passed: bool("passed"),
    doneAt: ts("done_at"),
  },
  (t) => [index("review_items_student_due").on(t.studentId, t.dueAt)],
);

export const abilityAttempts = sqliteTable(
  "ability_attempts",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    ability: text("ability", { enum: abilityEnum }).notNull(),
    level: text("level", { enum: levelEnum }).notNull(),
    genre: text("genre").notNull(),
    score: real("score").notNull(), // 0–1 本次该能力任务达标率
    createdAt: createdAt(),
  },
  (t) => [index("ability_attempts_student").on(t.studentId, t.ability, t.createdAt)],
);

export const mastery = sqliteTable(
  "mastery",
  {
    id: id(),
    studentId: text("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    ability: text("ability", { enum: abilityEnum }).notNull(),
    level: text("level", { enum: levelEnum }).notNull().default("L2"),
    updatedAt: ts("updated_at").notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("mastery_student_ability").on(t.studentId, t.ability)],
);

export const aiCalls = sqliteTable("ai_calls", {
  id: id(),
  purpose: text("purpose", { enum: aiPurposeEnum }).notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  userHash: text("user_hash"),
  inputTok: integer("input_tok"),
  outputTok: integer("output_tok"),
  latencyMs: integer("latency_ms").notNull(),
  ok: bool("ok").notNull(),
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
