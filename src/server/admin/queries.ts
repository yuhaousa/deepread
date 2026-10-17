// 管理后台 · 数据查询：平台总览、学情表现、用户列表、班级概况。
// 只供 ADMIN 使用，调用方负责鉴权。

import { and, asc, count, desc, eq, gte, ilike, isNotNull, or, sql } from "drizzle-orm";
import { ABILITIES, type AbilityKey } from "@/lib/domain";
import type { RoleKey } from "@/server/auth";
import { db, schema } from "@/lib/db";
import { localTimeAfter } from "@/server/learner/schedule";
import { learnerPerformance, like } from "@/server/learner/performance";

export { learnerPerformance, learnerSessions } from "@/server/learner/performance";
import { aiSummary, dailySeries, levelDistribution } from "@/server/admin/metrics";

const { users, classrooms, sessions, responses, abilityAttempts, aiCalls, tutorMessages, passages, assignments } = schema;
const DAY = 24 * 3600_000;

export async function dashboardData(now = new Date()) {
  const since7 = new Date(now.getTime() - 7 * DAY);
  const since14 = localTimeAfter(now, -13, 0, 0);
  const since28 = new Date(now.getTime() - 28 * DAY);

  const [roles, recent, abilityAvg, calls, flagged, tutor, top, learners] = await Promise.all([
    db.select({ role: users.role, n: count() }).from(users).groupBy(users.role),
    db
      .select({ studentId: sessions.studentId, startedAt: sessions.startedAt, completedAt: sessions.completedAt })
      .from(sessions)
      .where(or(gte(sessions.startedAt, since14), gte(sessions.completedAt, since14))),
    db
      .select({ ability: abilityAttempts.ability, avg: sql<number>`avg(${abilityAttempts.score})::float`, n: count() })
      .from(abilityAttempts)
      .where(gte(abilityAttempts.createdAt, since28))
      .groupBy(abilityAttempts.ability),
    db
      .select({
        purpose: aiCalls.purpose,
        calls: count(),
        failures: sql<number>`count(*) filter (where not ${aiCalls.ok})::int`,
        avgLatencyMs: sql<number | null>`avg(${aiCalls.latencyMs})::float`,
        tokens: sql<number>`coalesce(sum(coalesce(${aiCalls.inputTok}, 0) + coalesce(${aiCalls.outputTok}, 0)), 0)::int`,
      })
      .from(aiCalls)
      .where(gte(aiCalls.createdAt, since7))
      .groupBy(aiCalls.purpose),
    db.select({ n: count() }).from(responses).where(eq(responses.flagged, true)),
    db
      .select({
        replies: count(),
        rewritten: sql<number>`count(*) filter (where ${tutorMessages.guardrail}->>'rewritten' = 'true')::int`,
      })
      .from(tutorMessages)
      .where(and(eq(tutorMessages.role, "assistant"), gte(tutorMessages.createdAt, since7))),
    db
      .select({ title: passages.title, level: passages.level, n: count() })
      .from(sessions)
      .innerJoin(passages, eq(passages.id, sessions.passageId))
      .where(isNotNull(sessions.completedAt))
      .groupBy(passages.id, passages.title, passages.level)
      .orderBy(desc(count()))
      .limit(5),
    learnerPerformance({}, now),
  ]);

  const in7 = (d: Date | null) => !!d && d >= since7;
  const started7 = recent.filter((s) => in7(s.startedAt));
  const roleCount = (r: RoleKey) => roles.find((x) => x.role === r)?.n ?? 0;

  return {
    users: {
      students: roleCount("STUDENT"),
      teachers: roleCount("TEACHER"),
      admins: roleCount("ADMIN"),
      others: roleCount("PARENT") + roleCount("EDITOR"),
    },
    activeStudents7: new Set(recent.filter((s) => in7(s.startedAt) || in7(s.completedAt)).map((s) => s.studentId)).size,
    started7: started7.length,
    completed7: recent.filter((s) => in7(s.completedAt)).length,
    // 近 7 天开始的训练中已完成的比例
    completionRate7: started7.length ? started7.filter((s) => s.completedAt).length / started7.length : null,
    daily: dailySeries(
      recent.map((s) => s.completedAt).filter((d): d is Date => !!d),
      14,
      now,
    ),
    abilityAvg: abilityAvg.map((a) => ({ ability: a.ability as AbilityKey, avg: a.avg, n: a.n })),
    // 与学情表也一致：还没有等级记录的学生按默认 L2 计
    levels: levelDistribution(learners.flatMap((l) => ABILITIES.map((ability) => ({ ability, level: l.levels[ability], n: 1 })))),
    ai: aiSummary(calls.map((c) => ({ ...c, avgLatencyMs: c.avgLatencyMs === null ? null : Math.round(c.avgLatencyMs) }))),
    flaggedResponses: flagged[0]?.n ?? 0,
    tutor: { replies: tutor[0]?.replies ?? 0, rewritten: tutor[0]?.rewritten ?? 0 },
    topPassages: top,
    attention: learners.filter((l) => l.flags.some((f) => f.startsWith("回忆"))),
    inactive: learners.filter((l) => l.flags.some((f) => f.startsWith("超过") || f.startsWith("还没有"))).length,
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;

export async function listUsers(opts: { q?: string; role?: RoleKey; classroomId?: string } = {}) {
  const q = opts.q?.trim();
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      grade: users.grade,
      classroomId: users.classroomId,
      classroomName: classrooms.name,
      guardianConsentAt: users.guardianConsentAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(classrooms, eq(classrooms.id, users.classroomId))
    .where(
      and(
        opts.role ? eq(users.role, opts.role) : undefined,
        opts.classroomId ? eq(users.classroomId, opts.classroomId) : undefined,
        q ? or(ilike(users.username, like(q)), ilike(users.displayName, like(q))) : undefined,
      ),
    )
    .orderBy(asc(users.role), asc(users.username));
}

export type AdminUser = Awaited<ReturnType<typeof listUsers>>[number];

export async function classroomsOverview() {
  const [rows, studentCounts, assignmentCounts] = await Promise.all([
    db
      .select({ id: classrooms.id, name: classrooms.name, grade: classrooms.grade, teacherId: classrooms.teacherId, teacherName: users.displayName })
      .from(classrooms)
      .innerJoin(users, eq(users.id, classrooms.teacherId))
      .orderBy(asc(classrooms.name)),
    db.select({ classroomId: users.classroomId, n: count() }).from(users).where(eq(users.role, "STUDENT")).groupBy(users.classroomId),
    db.select({ classroomId: assignments.classroomId, n: count() }).from(assignments).groupBy(assignments.classroomId),
  ]);
  const n = (xs: { classroomId: string | null; n: number }[], id: string) => xs.find((x) => x.classroomId === id)?.n ?? 0;
  return rows.map((c) => ({ ...c, students: n(studentCounts, c.id), assignments: n(assignmentCounts, c.id) }));
}

/** 下拉选择用的班级与教师列表 */
export async function adminOptions() {
  const [cls, teachers] = await Promise.all([
    db.select({ id: classrooms.id, name: classrooms.name }).from(classrooms).orderBy(asc(classrooms.name)),
    db.select({ id: users.id, name: users.displayName, username: users.username }).from(users).where(eq(users.role, "TEACHER")).orderBy(asc(users.displayName)),
  ]);
  return { classrooms: cls, teachers };
}
