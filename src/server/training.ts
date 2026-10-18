// 训练闭环服务：开始训练 → 预测 → 阅读 → 合书回忆 → 结构分析 → 表达迁移 → 结算反馈与复习。
// 路由处理器只做鉴权和参数校验，业务都在这里。

import { and, asc, count, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { ABILITY_META, type AbilityKey, type LevelKey, type StepKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import { userHash, type SessionUser } from "@/server/auth";
import { loadPassage } from "@/server/content";
import { matchKeyPoints, scoreAnalysis, scorePredict, type AnalysisAnswer, type AnalysisResult } from "@/server/assessment/rules";
import { aiRecall, aiRubric, LOW_CONFIDENCE, type RubricResult } from "@/server/assessment/ai";
import { abilityScores, decideLevel, todayTip } from "@/server/learner/levels";
import { localTimeAfter, planReviews } from "@/server/learner/schedule";
import { isLearningMode, type LearningMode } from "@/lib/modes";

/** 本次训练的学习方式；旧数据没有记录时用材料默认导师 */
export const sessionMode = (mode: string | null | undefined, fallback: LearningMode): LearningMode => (isLearningMode(mode) ? mode : fallback);

const { sessions, responses, passages, assignments, users, keyPoints, abilityAttempts, mastery, reviewItems } = schema;

export class TrainingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type ResponseInsert = typeof responses.$inferInsert;

/** 每次训练每类作答只保留一条（重交覆盖）。返回未执行的查询，可直接 await，也可放进 db.batch。 */
function upsertResponse(r: ResponseInsert) {
  const { sessionId: _s, kind: _k, ...set } = r;
  return db
    .insert(responses)
    .values(r)
    .onConflictDoUpdate({ target: [responses.sessionId, responses.kind], set: { ...set, createdAt: new Date() } });
}

/** D1 单条语句最多 100 个绑定参数：多行插入按行数分批 */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** 防沉迷：每日可开始的训练节数（按 UTC+8 自然日）。继续进行中的训练不受限制。 */
export async function dailyStarts(studentId: string) {
  const limit = Number(process.env.DAILY_SESSION_LIMIT ?? 2);
  const dayStart = localTimeAfter(new Date(), 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(sessions).where(and(eq(sessions.studentId, studentId), gte(sessions.startedAt, dayStart)));
  return { started: n, limit, left: Math.max(0, limit - n) };
}

export async function startSession(user: SessionUser, passageId: string, assignmentId?: string, mode?: LearningMode) {
  const passage = await db.query.passages.findFirst({ where: and(eq(passages.id, passageId), eq(passages.status, "PUBLISHED")) });
  if (!passage) throw new TrainingError(404, "材料不存在或未发布");

  // 同一篇未完成的训练直接继续
  const open = await db.query.sessions.findFirst({
    where: and(eq(sessions.studentId, user.id), eq(sessions.passageId, passageId), isNull(sessions.completedAt)),
    orderBy: desc(sessions.startedAt),
  });
  if (open) return open;

  const { started, limit } = await dailyStarts(user.id);
  if (started >= limit) throw new TrainingError(429, `今天已开始 ${started} 节训练，明天再来吧。间隔练习比一次练很多更有效。进行中的训练可以随时继续。`);

  if (assignmentId) {
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
    const me = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { classroomId: true } });
    if (!a || a.passageId !== passageId || a.classroomId !== me?.classroomId) throw new TrainingError(400, "任务与材料不匹配");
  }
  // 未选择学习方式时，用材料默认的导师角色
  const [created] = await db
    .insert(sessions)
    .values({ studentId: user.id, passageId, passageVersion: passage.version, assignmentId, mode: mode ?? passage.tutorRole })
    .returning();
  return created;
}

export async function getOwnedSession(user: SessionUser, id: string) {
  const s = await db.query.sessions.findFirst({ where: eq(sessions.id, id), with: { responses: true } });
  if (!s || s.studentId !== user.id) throw new TrainingError(404, "训练记录不存在");
  const passage = await loadPassage(s.passageId);
  if (!passage) throw new TrainingError(404, "材料不存在");
  return { session: s, passage };
}

export interface ProgressPatch {
  mode?: LearningMode;
  step?: StepKey;
  question?: string;
  highlights?: string[];
  readingSeconds?: number;
  lookback?: boolean;
  predictChoice?: number;
}

export async function updateProgress(user: SessionUser, id: string, patch: ProgressPatch) {
  const { session, passage } = await getOwnedSession(user, id);
  if (session.completedAt) throw new TrainingError(409, "这次训练已经结束");
  let predict: { correct: boolean; explanation: string } | undefined;
  if (patch.predictChoice !== undefined) {
    predict = scorePredict(passage.predict, patch.predictChoice);
    await upsertResponse({ sessionId: id, kind: "predict", answer: { choice: patch.predictChoice }, score: predict.correct ? 1 : 0, source: "RULE" });
  }
  const set: Partial<typeof sessions.$inferInsert> = {};
  if (patch.step) set.step = patch.step;
  if (patch.mode) set.mode = patch.mode;
  if (patch.question !== undefined) set.question = patch.question;
  if (patch.highlights) set.highlights = patch.highlights;
  if (patch.readingSeconds !== undefined) set.readingSeconds = patch.readingSeconds;
  if (patch.lookback) set.lookbacks = sql`${sessions.lookbacks} + 1` as unknown as number;
  if (Object.keys(set).length) await db.update(sessions).set(set).where(eq(sessions.id, id));
  return { predict };
}

export async function submitRecall(user: SessionUser, id: string, text: string, confidence: number) {
  const { passage } = await getOwnedSession(user, id);
  const keyword = matchKeyPoints(text, passage.keyPoints);
  const ai = await aiRecall(passage, text, userHash(user.id));
  const covered = [...new Set([...keyword, ...(ai?.covered ?? [])])].sort((a, b) => a - b);
  const coverage = covered.length / passage.keyPoints.length;
  const self = confidence / 5;
  const gap = self - coverage;
  const calibration =
    gap >= 0.3 ? "自评明显偏高，下次读完先试着在心里复述一遍再判断。" : gap <= -0.3 ? "你比自己以为的记得更多，可以更有信心一些。" : "自评和实际比较接近，判断得很准。";

  // D1 不支持交互式事务；batch 中的语句按顺序执行，任一失败则整体回滚
  await db.batch([
    db.update(sessions).set({ confidence, step: "RECALL" }).where(eq(sessions.id, id)),
    upsertResponse({
      sessionId: id,
      kind: "recall",
      answer: { text },
      score: coverage,
      detail: { covered, keyword, ai: ai?.covered ?? null, misconception: ai?.misconception ?? "" },
      source: ai ? "AI" : "KEYWORD",
      feedback: ai ? { text: ai.feedback, model: ai.model, label: "AI 回忆教练" } : null,
    }),
  ]);

  return {
    total: passage.keyPoints.length,
    coverage,
    calibration,
    selfPercent: Math.round(self * 100),
    // 已回忆出的关键点可以展示；未覆盖的只给段落线索
    points: passage.keyPoints.map((k, i) => (covered.includes(i) ? { covered: true, text: k.text } : { covered: false, hint: `提示：在第 ${k.paragraph} 段附近` })),
    ai: ai ? { feedback: ai.feedback, misconception: ai.misconception } : null,
  };
}

export async function submitAnalysis(user: SessionUser, id: string, answer: AnalysisAnswer) {
  const { passage } = await getOwnedSession(user, id);
  let result: AnalysisResult;
  try {
    result = scoreAnalysis(passage.analysis, answer);
  } catch {
    throw new TrainingError(400, "作答格式与题型不符");
  }
  await upsertResponse({ sessionId: id, kind: "analysis", answer, score: result.score, detail: result, source: "RULE" });
  await db.update(sessions).set({ step: "ANALYZE" }).where(eq(sessions.id, id));
  return result;
}

const publicRubric = (r: RubricResult) => ({
  main: r.main,
  relation: r.relation,
  selection: r.selection,
  total: r.total,
  praise: r.praise,
  issue: r.issue,
  transfer: r.transfer,
  nextStep: r.next_step,
});

/** extra：论证对练的反方回应，或核查陪练的原文依据 */
export async function submitSummary(user: SessionUser, id: string, summary: string, transfer: string | null, extra: string | null = null) {
  const { session, passage } = await getOwnedSession(user, id);
  const mode = sessionMode(session.mode, passage.tutorRole);
  const rubric = await aiRubric(passage, summary, transfer, userHash(user.id), extra ? { mode, text: extra } : undefined);
  await upsertResponse({
    sessionId: id,
    kind: "summary",
    answer: { summary, transfer, ...(extra ? { extra, mode } : {}) },
    score: rubric ? rubric.total / 6 : null,
    detail: rubric,
    source: rubric ? "AI" : "RULE",
    feedback: rubric ? { label: "AI 导师", model: rubric.model } : null,
    flagged: !!rubric && rubric.confidence < LOW_CONFIDENCE, // 低置信度进入教师抽检
  });
  await db.update(sessions).set({ step: "EXPRESS" }).where(eq(sessions.id, id));
  return { rubric: rubric ? publicRubric(rubric) : null, refSummary: passage.refSummary };
}

export async function completeSession(user: SessionUser, id: string) {
  const { session, passage } = await getOwnedSession(user, id);
  if (session.completedAt && session.summary) return session.summary;

  const resp = (kind: string) => session.responses.find((r) => r.kind === kind);
  const recall = resp("recall");
  const analysis = resp("analysis");
  const summary = resp("summary");
  const covered = ((recall?.detail as { covered?: number[] } | null)?.covered ?? []) as number[];
  const analysisDetail = analysis?.detail as AnalysisResult | undefined;
  const rubricTotal = summary?.score != null ? Math.round(summary.score * 6) : null;
  const charCount = passage.paragraphs.join("").replace(/\s/g, "").length + passage.lead.length;

  const scores = abilityScores({
    charCount,
    readingSeconds: session.readingSeconds,
    lookbacks: session.lookbacks,
    recallCoverage: recall?.score ?? null,
    analysisScore: analysis?.score ?? null,
    analysisAbility: passage.analysisAbility,
    rubricTotal,
  });
  const tip = todayTip(scores);
  const now = new Date();
  const kps = await db.query.keyPoints.findMany({ where: eq(keyPoints.passageId, passage.id), orderBy: asc(keyPoints.order) });
  const plan = planReviews(kps.length, covered, now, { intensive: sessionMode(session.mode, passage.tutorRole) === "RECALL_COACH" });

  // 先读：当前等级、各能力最近的作答、最近一次 7 天复习。D1 不支持在事务里边读边写，所以判定在内存中完成。
  const abilities = Object.entries(scores) as [AbilityKey, number][];
  const [levelRows, recentByAbility, lastWeek] = await Promise.all([
    db.query.mastery.findMany({ where: eq(mastery.studentId, user.id) }),
    Promise.all(
      abilities.map(([ability]) =>
        db.query.abilityAttempts.findMany({
          where: and(eq(abilityAttempts.studentId, user.id), eq(abilityAttempts.ability, ability)),
          orderBy: desc(abilityAttempts.createdAt),
          limit: 9,
        }),
      ),
    ),
    db.query.reviewItems.findFirst({
      where: and(eq(reviewItems.studentId, user.id), eq(reviewItems.intervalD, 7), isNotNull(reviewItems.doneAt)),
      orderBy: desc(reviewItems.doneAt),
    }),
  ]);

  const levelChanges: { ability: AbilityKey; to: LevelKey }[] = [];
  abilities.forEach(([ability, score], i) => {
    const current = (levelRows.find((m) => m.ability === ability)?.level ?? "L2") as LevelKey;
    const attempts = [
      { level: passage.level, score, createdAt: now }, // 本次作答
      ...recentByAbility[i].map((a) => ({ level: a.level as LevelKey, score: a.score, createdAt: a.createdAt })),
    ];
    const decision = decideLevel(current, attempts, lastWeek?.passed ?? null);
    if (decision.action === "upgrade") levelChanges.push({ ability, to: decision.to });
  });

  const minutes = session.readingSeconds ? session.readingSeconds / 60 : null;
  const result = {
    metrics: {
      readingSeconds: session.readingSeconds,
      charsPerMinute: minutes ? Math.round(charCount / minutes) : null,
      recallHits: covered.length,
      keyPointCount: kps.length,
      efficiency: minutes ? Number((covered.length / minutes).toFixed(1)) : null,
      analysisCorrect: analysisDetail?.correct ?? null,
      analysisTotal: analysisDetail?.total ?? null,
      analysisLabel: passage.analysis.kind === "audit" ? "AI 摘要核查" : ABILITY_META[passage.analysisAbility].name,
      rubricTotal,
    },
    scores,
    tip,
    question: session.question,
    reviews: {
      nextDay: { dueAt: plan.find((p) => p.intervalD === 1)?.dueAt ?? null, items: plan.filter((p) => p.intervalD === 1).length },
      week: { dueAt: plan.find((p) => p.intervalD === 7)?.dueAt ?? null, items: plan.filter((p) => p.intervalD === 7).length },
    },
    levelChanges,
  };
  // 再一次性写入：能力记录、等级、复习计划、结算结果
  const missingLevels = abilities.filter(([ability]) => !levelRows.some((m) => m.ability === ability));
  const reviewRows = plan.map((r) => ({ studentId: user.id, keyPointId: kps[r.keyPointIndex].id, dueAt: r.dueAt, intervalD: r.intervalD }));
  // batch 整体原子执行，顺序不影响结果；结算语句放第一位以满足非空元组类型
  await db.batch([
    db.update(sessions).set({ step: "DONE", completedAt: now, summary: result }).where(eq(sessions.id, id)),
    ...(abilities.length
      ? [db.insert(abilityAttempts).values(abilities.map(([ability, score]) => ({ studentId: user.id, sessionId: id, ability, level: passage.level, genre: passage.genre, score, createdAt: now })))]
      : []),
    ...(missingLevels.length ? [db.insert(mastery).values(missingLevels.map(([ability]) => ({ studentId: user.id, ability }))).onConflictDoNothing()] : []),
    ...levelChanges.map((c) => db.update(mastery).set({ level: c.to }).where(and(eq(mastery.studentId, user.id), eq(mastery.ability, c.ability)))),
    ...chunk(reviewRows, 10).map((rows) => db.insert(reviewItems).values(rows)),
  ]);
  return result;
}

export type CompleteResult = Awaited<ReturnType<typeof completeSession>>;
