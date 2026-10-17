// 报告服务：个人能力报告（行为化描述 + 作品证据，不出总分、不排名）与班级洞察。

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { ABILITIES, ABILITY_META, LEVEL_DESCRIPTORS, LEVEL_META, type LevelKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import type { AnalysisResult } from "@/server/assessment/rules";
import { buildInsights, type SessionRow } from "@/server/insights";

const { users, mastery, abilityAttempts, sessions, reviewItems, classrooms, assignments, keyPoints } = schema;
const WEEK = 7 * 24 * 3600_000;
const chars = (p: { paragraphs: string[]; lead: string }) => p.paragraphs.join("").length + p.lead.length;

export async function studentReport(studentId: string, now = new Date()) {
  const [user, levels, attempts, done] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, studentId), columns: { id: true, displayName: true, grade: true, classroomId: true } }),
    db.query.mastery.findMany({ where: eq(mastery.studentId, studentId) }),
    db.query.abilityAttempts.findMany({ where: and(eq(abilityAttempts.studentId, studentId), gte(abilityAttempts.createdAt, new Date(now.getTime() - 4 * WEEK))) }),
    db.query.sessions.findMany({
      where: and(eq(sessions.studentId, studentId), isNotNull(sessions.completedAt)),
      with: { passage: { columns: { title: true, genre: true } }, responses: true },
      orderBy: desc(sessions.completedAt),
    }),
  ]);
  if (!user) return null;

  const abilities = ABILITIES.map((a) => {
    const level = (levels.find((m) => m.ability === a)?.level ?? "L2") as LevelKey;
    // 近四周每周平均达标率（旧 → 新），无数据为 null
    const weeks = [3, 2, 1, 0].map((w) => {
      const from = now.getTime() - (w + 1) * WEEK;
      const to = now.getTime() - w * WEEK;
      const xs = attempts.filter((t) => t.ability === a && t.createdAt.getTime() >= from && t.createdAt.getTime() < to).map((t) => t.score);
      return xs.length ? Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 100) : null;
    });
    return {
      ability: a,
      name: ABILITY_META[a].name,
      level,
      levelName: LEVEL_META[level].name,
      descriptor: LEVEL_DESCRIPTORS[a][level],
      nextDescriptor: level === "L5" ? null : LEVEL_DESCRIPTORS[a][`L${Number(level[1]) + 1}` as LevelKey],
      weeks,
    };
  });

  // 信心校准：按文体比较自评（confidence × 20%）与回忆覆盖率
  const calib = new Map<string, { self: number[]; actual: number[] }>();
  for (const s of done) {
    const recall = s.responses.find((r) => r.kind === "recall");
    if (s.confidence == null || recall?.score == null) continue;
    const c = calib.get(s.passage.genre) ?? { self: [], actual: [] };
    c.self.push(s.confidence * 20);
    c.actual.push(Math.round(recall.score * 100));
    calib.set(s.passage.genre, c);
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const calibration = [...calib.entries()].map(([genre, c]) => ({ genre, self: avg(c.self), actual: avg(c.actual) }));

  // 作品证据：最早与最近一篇摘要
  const withSummary = done.filter((s) => s.responses.some((r) => r.kind === "summary"));
  const work = (s: (typeof done)[number]) => {
    const r = s.responses.find((x) => x.kind === "summary")!;
    return {
      title: s.passage.title,
      date: s.completedAt,
      text: (r.answer as { summary?: string }).summary ?? "",
      rubric: r.score != null ? Math.round(r.score * 6) : null,
    };
  };
  const works = withSummary.length >= 2 ? [work(withSummary.at(-1)!), work(withSummary[0])] : withSummary.map(work);

  const upcoming = await db.query.reviewItems.findMany({
    where: and(eq(reviewItems.studentId, studentId), isNull(reviewItems.doneAt)),
    with: { keyPoint: { with: { passage: { columns: { title: true } } } } },
    orderBy: asc(reviewItems.dueAt),
    limit: 6,
  });

  return {
    student: { id: user.id, displayName: user.displayName, grade: user.grade },
    classroomId: user.classroomId,
    completed: done.length,
    abilities,
    calibration,
    works,
    upcomingReviews: upcoming.map((d) => ({ dueAt: d.dueAt, title: d.keyPoint.passage.title, intervalD: d.intervalD })),
  };
}

export type StudentReport = NonNullable<Awaited<ReturnType<typeof studentReport>>>;

export async function classroomInsights(classroomId: string, assignmentId?: string) {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, classroomId),
    with: {
      students: { columns: { id: true, displayName: true, username: true }, orderBy: asc(users.username) },
      assignments: { with: { passage: { columns: { id: true, title: true } } }, orderBy: desc(assignments.createdAt) },
    },
  });
  if (!classroom) return null;
  const assignment = assignmentId ? classroom.assignments.find((a) => a.id === assignmentId) : classroom.assignments[0];
  const students = classroom.students.filter((s) => s.username).map((s) => ({ id: s.id, name: s.displayName }));
  if (!assignment) return { classroom, assignment: null, insights: buildInsights(students, [], {}) };

  const assigned = await db.query.sessions.findMany({
    where: eq(sessions.assignmentId, assignment.id),
    with: { responses: true, passage: { with: { keyPoints: { orderBy: asc(keyPoints.order) } } } },
  });
  const rows: SessionRow[] = assigned.map((s) => {
    const recall = s.responses.find((r) => r.kind === "recall");
    const analysis = s.responses.find((r) => r.kind === "analysis");
    const covered = ((recall?.detail as { covered?: number[] } | null)?.covered ?? []) as number[];
    return {
      studentId: s.studentId,
      completed: !!s.completedAt,
      readingSeconds: s.readingSeconds,
      charCount: chars(s.passage),
      recallCoverage: recall?.score ?? null,
      analysisScore: analysis?.score ?? null,
      analysisItems: (analysis?.detail as AnalysisResult | null)?.items ?? [],
      missedKeyPoints: recall ? s.passage.keyPoints.filter((_, i) => !covered.includes(i)).map((k) => k.text.split("：")[0]) : [],
      minutes: s.completedAt ? Math.max(1, Math.round((s.completedAt.getTime() - s.startedAt.getTime()) / 60000)) : null,
    };
  });

  // 需要关注：每名学生最近两次已完成训练的回忆覆盖率与阅读速度
  const recentCoverage: Record<string, number[]> = {};
  const recentSpeed: Record<string, number[]> = {};
  if (students.length) {
    const recent = await db.query.sessions.findMany({
      where: and(inArray(sessions.studentId, students.map((s) => s.id)), isNotNull(sessions.completedAt)),
      with: { responses: true, passage: { columns: { paragraphs: true, lead: true } } },
      orderBy: desc(sessions.completedAt),
    });
    for (const s of recent) {
      const cov = s.responses.find((r) => r.kind === "recall")?.score;
      if (cov == null) continue;
      (recentCoverage[s.studentId] ??= []).push(cov);
      if (s.readingSeconds) (recentSpeed[s.studentId] ??= []).push(chars(s.passage) / (s.readingSeconds / 60));
    }
  }

  return { classroom, assignment, insights: buildInsights(students, rows, recentCoverage, recentSpeed) };
}
