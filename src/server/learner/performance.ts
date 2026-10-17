// 学情表现：每名学生的训练汇总与训练记录。管理后台（全部学生）与教师端（本班学生）共用，调用方负责鉴权。

import { and, asc, count, desc, eq, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import type { AbilityKey, LevelKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import { buildLearnerRows, type LearnerRow } from "@/server/admin/metrics";

const { users, classrooms, sessions, mastery, reviewItems } = schema;

/** 搜索词中的 % _ \\ 按字面匹配 */
export const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export async function learnerPerformance(opts: { classroomId?: string; q?: string } = {}, now = new Date()): Promise<LearnerRow[]> {
  const q = opts.q?.trim();
  const students = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.displayName,
      grade: users.grade,
      classroomId: users.classroomId,
      classroomName: classrooms.name,
      consentAt: users.guardianConsentAt,
    })
    .from(users)
    .leftJoin(classrooms, eq(classrooms.id, users.classroomId))
    .where(
      and(
        eq(users.role, "STUDENT"),
        opts.classroomId ? eq(users.classroomId, opts.classroomId) : undefined,
        q ? or(ilike(users.username, like(q)), ilike(users.displayName, like(q))) : undefined,
      ),
    )
    .orderBy(asc(users.username));
  if (!students.length) return [];
  const ids = students.map((s) => s.id);

  const [sessionRows, masteryRows, due] = await Promise.all([
    db.query.sessions.findMany({
      where: inArray(sessions.studentId, ids),
      columns: { studentId: true, startedAt: true, completedAt: true },
      with: { responses: { columns: { kind: true, score: true } } },
    }),
    db.select({ studentId: mastery.studentId, ability: mastery.ability, level: mastery.level }).from(mastery).where(inArray(mastery.studentId, ids)),
    db
      .select({ studentId: reviewItems.studentId, n: count() })
      .from(reviewItems)
      .where(and(inArray(reviewItems.studentId, ids), isNull(reviewItems.doneAt), lte(reviewItems.dueAt, now)))
      .groupBy(reviewItems.studentId),
  ]);

  const score = (rs: { kind: string; score: number | null }[], kind: string) => rs.find((r) => r.kind === kind)?.score ?? null;
  return buildLearnerRows(
    students.map(({ consentAt, ...s }) => ({ ...s, consent: !!consentAt })),
    sessionRows.map((s) => ({
      studentId: s.studentId,
      startedAt: s.startedAt,
      completedAt: s.completedAt,
      recall: score(s.responses, "recall"),
      analysis: score(s.responses, "analysis"),
      express: score(s.responses, "summary"),
    })),
    masteryRows.map((m) => ({ ...m, ability: m.ability as AbilityKey, level: m.level as LevelKey })),
    Object.fromEntries(due.map((d) => [d.studentId, d.n])),
    now,
  );
}

/** 单个学生最近的训练记录（含各环节得分） */
export async function learnerSessions(studentId: string, limit = 20) {
  const rows = await db.query.sessions.findMany({
    where: eq(sessions.studentId, studentId),
    columns: { id: true, step: true, startedAt: true, completedAt: true, readingSeconds: true, lookbacks: true },
    with: { passage: { columns: { title: true, level: true, genre: true } }, responses: { columns: { kind: true, score: true, flagged: true } } },
    orderBy: desc(sessions.startedAt),
    limit,
  });
  const score = (rs: { kind: string; score: number | null }[], kind: string) => rs.find((r) => r.kind === kind)?.score ?? null;
  return rows.map((s) => ({
    id: s.id,
    title: s.passage.title,
    level: s.passage.level,
    genre: s.passage.genre,
    step: s.step,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    readingSeconds: s.readingSeconds,
    lookbacks: s.lookbacks,
    recall: score(s.responses, "recall"),
    analysis: score(s.responses, "analysis"),
    express: score(s.responses, "summary"),
    flagged: s.responses.some((r) => r.flagged),
  }));
}
