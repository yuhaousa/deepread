// 开发 / 演示种子数据。会清空现有数据，生产环境需显式设置 SEED_FORCE=1。
// 演示账号：教师 teacher@deepread.local / deepread123；学生 s2401–s2408 / deepread123

import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import { PASSAGES } from "../src/content/passages";
import { ABILITIES, charCount, type AbilityKey, type AnalysisSpec, type PassageSpec } from "../src/lib/domain";
import { matchKeyPoints, scoreAnalysis, type AnalysisAnswer } from "../src/server/assessment/rules";
import { abilityScores } from "../src/server/learner/levels";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const DAY = 24 * 3600_000;

// 确定性伪随机，保证每次种子数据一致
let state = 20261017;
const rand = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;

const analysisType = (a: AnalysisSpec) => ({ roles: "ROLES", audit: "AUDIT", quiz: "QUIZ", sequence: "SEQUENCE" }) as const satisfies Record<AnalysisSpec["kind"], string>;

async function seedPassage(p: PassageSpec) {
  const [row] = await db
    .insert(schema.passages)
    .values({
      slug: p.slug,
      title: p.title,
      genre: p.genre,
      grade: p.grade,
      level: p.level,
      primaryAbility: p.primaryAbility,
      tutorRole: p.tutorRole,
      lead: p.lead,
      paragraphs: p.paragraphs,
      charCount: charCount(p),
      status: "PUBLISHED",
    })
    .returning();
  await db.insert(schema.contentCards).values({
    passageId: row.id,
    ...p.card,
    review: { factCheck: true, ageFit: true, groundedQuestions: true, reviewer: "教研组", version: "v1.0" },
    refSummary: p.refSummary,
  });
  const kps = await db
    .insert(schema.keyPoints)
    .values(p.keyPoints.map((k, order) => ({ passageId: row.id, order, ...k })))
    .returning();
  await db.insert(schema.exercises).values([
    { passageId: row.id, order: 0, step: "PREDICT", type: "PREDICT", ability: p.primaryAbility, spec: p.predict },
    { passageId: row.id, order: 1, step: "ANALYZE", type: analysisType(p.analysis)[p.analysis.kind], ability: p.analysisAbility, spec: p.analysis },
    { passageId: row.id, order: 2, step: "EXPRESS", type: "SUMMARY", ability: "EXPRESS", spec: { mode: p.expressMode } },
    ...(p.transfer ? [{ passageId: row.id, order: 3, step: "EXPRESS" as const, type: "TRANSFER" as const, ability: "EXPRESS" as const, spec: { prompt: p.transfer } }] : []),
  ]);
  return { ...row, keyPoints: kps.sort((a, b) => a.order - b.order) };
}

/** 按“正确率”模拟一份结构分析作答 */
function simulateAnalysis(a: AnalysisSpec, p: number): AnalysisAnswer {
  const pick = (right: number, n: number) => (rand() < p ? right : (right + 1 + Math.floor(rand() * (n - 1))) % n);
  switch (a.kind) {
    case "roles":
      return { kind: "roles", roles: a.items.map((i) => pick(i.answer, a.roles.length)), mcq: a.mcq ? pick(a.mcq.answer, a.mcq.options.length) : undefined };
    case "audit":
      return { kind: "audit", verdicts: a.clauses.map((c) => pick(c.answer, a.types.length)) };
    case "quiz":
      return { kind: "quiz", answers: a.questions.map((q) => pick(q.answer, q.options.length)) };
    case "sequence": {
      const order = a.steps.map((_, i) => i);
      if (rand() > p) [order[1], order[2]] = [order[2], order[1]];
      return { kind: "sequence", order, mcq: a.mcq ? pick(a.mcq.answer, a.mcq.options.length) : undefined };
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    throw new Error("拒绝在生产环境清空数据：如确需执行，设置 SEED_FORCE=1");
  }
  await db.execute(sql`TRUNCATE ai_calls, tutor_messages, responses, ability_attempts, review_items, sessions, assignments, mastery, classrooms, users, schools, exercises, key_points, content_cards, passages CASCADE`);

  const pw = await bcrypt.hash("deepread123", 10);
  const [school] = await db.insert(schema.schools).values({ name: "深读示范学校", region: "intl" }).returning();
  const [teacher] = await db.insert(schema.users).values({ username: "teacher@deepread.local", passwordHash: pw, displayName: "王老师", role: "TEACHER" }).returning();
  await db.insert(schema.users).values({ username: "admin@deepread.local", passwordHash: pw, displayName: "平台管理员", role: "ADMIN" });
  const [classroom] = await db.insert(schema.classrooms).values({ name: "初二（3）班", grade: "初二", schoolId: school.id, teacherId: teacher.id }).returning();

  const names = ["林同学", "陈同学", "张同学", "李同学", "王同学", "赵同学", "周同学", "吴同学"];
  const students = await db
    .insert(schema.users)
    .values(
      names.map((name, i) => ({
        username: `s24${String(i + 1).padStart(2, "0")}`,
        passwordHash: pw,
        displayName: name,
        role: "STUDENT" as const,
        grade: "初二",
        classroomId: classroom.id,
        // 最后一名学生演示“监护人尚未同意”：可以训练，但不能使用 AI 导师对话
        guardianConsentAt: i === names.length - 1 ? null : new Date(),
      })),
    )
    .returning();
  students.sort((a, b) => a.username.localeCompare(b.username));

  const passages = new Map<string, Awaited<ReturnType<typeof seedPassage>>>();
  for (const p of PASSAGES) passages.set(p.slug, await seedPassage(p));
  const spec = (slug: string) => PASSAGES.find((p) => p.slug === slug)!;

  await db.insert(schema.mastery).values(
    students.flatMap((s) => ABILITIES.map((ability) => ({ studentId: s.id, ability, level: ability === "RECALL" && s.username === "s2401" ? ("L3" as const) : ("L2" as const) }))),
  );

  // 本周任务：《刷短视频会让人变笨吗？》；下周任务：《我们学校的剩饭调查》
  const [assignment] = await db.insert(schema.assignments).values({ classroomId: classroom.id, passageId: passages.get("short-video")!.id, dueAt: new Date(Date.now() + 5 * DAY) }).returning();
  await db.insert(schema.assignments).values({ classroomId: classroom.id, passageId: passages.get("cafeteria-leftovers")!.id, dueAt: new Date(Date.now() + 9 * DAY), createdAt: new Date(Date.now() - DAY) });

  async function demoSession(
    student: { id: string },
    p: PassageSpec,
    opts: { recall: number[]; acc: number; mins: number; at: Date; assignmentId?: string; rubric?: number; summaryText?: string },
  ) {
    const passage = passages.get(p.slug)!;
    const recallText = opts.recall.map((i) => p.keyPoints[i].keywords[0]).join("，") + "。";
    const covered = matchKeyPoints(recallText, p.keyPoints);
    const analysis = scoreAnalysis(p.analysis, simulateAnalysis(p.analysis, opts.acc));
    const readingSeconds = Math.round(opts.mins * 60 * 0.35);
    const rubric = opts.rubric ?? null;
    const [session] = await db
      .insert(schema.sessions)
      .values({
        studentId: student.id,
        passageId: passage.id,
        passageVersion: 1,
        assignmentId: opts.assignmentId,
        step: "DONE",
        readingSeconds,
        lookbacks: Math.floor(rand() * 3),
        confidence: 3 + Math.floor(rand() * 3),
        startedAt: new Date(opts.at.getTime() - opts.mins * 60_000),
        completedAt: opts.at,
        summary: { demo: true },
      })
      .returning();
    await db.insert(schema.responses).values([
      { sessionId: session.id, kind: "recall", answer: { text: recallText }, score: covered.length / p.keyPoints.length, detail: { covered, keyword: covered, ai: null, misconception: "" }, source: "KEYWORD", createdAt: opts.at },
      { sessionId: session.id, kind: "analysis", answer: { demo: true }, score: analysis.score, detail: analysis, source: "RULE", createdAt: opts.at },
      ...(rubric !== null ? [{ sessionId: session.id, kind: "summary", answer: { summary: opts.summaryText ?? "（演示数据）", transfer: null }, score: rubric / 6, source: "AI" as const, createdAt: opts.at }] : []),
    ]);
    const scores = abilityScores({
      charCount: charCount(p),
      readingSeconds,
      lookbacks: 1,
      recallCoverage: covered.length / p.keyPoints.length,
      analysisScore: analysis.score,
      analysisAbility: p.analysisAbility,
      rubricTotal: rubric,
    });
    const rows = Object.entries(scores).map(([ability, score]) => ({ studentId: student.id, sessionId: session.id, ability: ability as AbilityKey, level: p.level, genre: p.genre, score: score as number, createdAt: opts.at }));
    if (rows.length) await db.insert(schema.abilityAttempts).values(rows);
  }

  // ── 演示历史：前 6 名学生完成了本周任务 ──
  const VIDEO_SUMMARIES = [
    "作者认为短视频本身不会让人变笨，但无节制地刷会削弱专注和深度阅读。理由是快速刺激让人坐不住，专注又需要练习。作者指出用表哥的例子证明不了结论，短视频也有价值，关键在怎么用、用多久。",
    "这篇文章说刷短视频会让人变笨，因为表哥刷了五个小时成绩下降了。所以我们要少刷短视频，多读书。",
    "短视频切换很快，会让人习惯快刺激，读长文坐不住。专注需要练习。作者建议每天留时间读完整的文章。",
  ];
  const profiles = [
    { recall: [0, 1, 2, 3, 5], acc: 0.85, mins: 19 },
    { recall: [0, 3], acc: 0.6, mins: 22 },
    { recall: [0, 1, 4], acc: 0.4, mins: 18 },
    { recall: [0], acc: 0.7, mins: 9 },
    { recall: [0, 1, 2, 3], acc: 0.9, mins: 21 },
    { recall: [0, 2, 3, 4, 5], acc: 0.5, mins: 24 },
  ];
  for (const [i, prof] of profiles.entries()) {
    await demoSession(students[i], spec("short-video"), {
      ...prof,
      at: new Date(Date.now() - (i + 1) * 3600_000),
      assignmentId: assignment.id,
      rubric: 2 + Math.round(prof.acc * 4),
      summaryText: VIDEO_SUMMARIES[i % VIDEO_SUMMARIES.length],
    });
  }
  // 李同学（第 4 名）上一次训练回忆覆盖也很低，演示“需要关注”
  await demoSession(students[3], spec("bee-dance"), { recall: [0], acc: 0.6, mins: 6, at: new Date(Date.now() - 3 * DAY) });

  // ── 林同学近四周：回忆、核查、表达逐步提升 ──
  const lin = students[0];
  const history: [string, number, number[], number, number, string?][] = [
    ["urban-heat-island", 25, [0, 3], 0.5, 2, "文章讲了城市很热的原因，有很多原因，城市里人很多，我们要保护环境。"],
    ["nap-memory", 20, [0, 2], 0.6, 3],
    ["bee-dance", 16, [0, 1, 2], 0.67, 3],
    ["autumn-leaves", 12, [0, 1, 2], 0.5, 4],
    ["meandering-river", 9, [1, 2, 3], 0.8, 4],
    ["cafeteria-leftovers", 5, [0, 1, 2, 4], 0.8, 5, "初二六个班调查了三天午餐剩饭，平均每天剩 18 公斤，周三最多。问卷中 62% 的人觉得菜太咸。小组建议试点小份菜、少放盐，但调查只覆盖一个年级，不一定代表全校。"],
  ];
  for (const [slug, daysAgo, recall, acc, rubric, summaryText] of history) {
    await demoSession(lin, spec(slug), { recall, acc, mins: 18, at: new Date(Date.now() - daysAgo * DAY), rubric, summaryText });
  }
  // 一条已到期的复习
  await db.insert(schema.reviewItems).values({ studentId: lin.id, keyPointId: passages.get("cafeteria-leftovers")!.keyPoints[1].id, dueAt: new Date(Date.now() - 3600_000), intervalD: 1 });

  console.log(`种子数据完成：${PASSAGES.length} 篇材料，${students.length} 名学生，1 名教师，1 名管理员。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
