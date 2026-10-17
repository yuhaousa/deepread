// 训练闭环服务：开始训练 → 预测 → 阅读 → 合书回忆 → 结构分析 → 表达迁移 → 结算反馈与复习。
// 路由处理器只做鉴权和参数校验，业务都在这里。

import { and, asc, count, desc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { ABILITY_META, type AbilityKey, type LevelKey, type StepKey } from "@/lib/domain";
import { db, schema, type Tx } from "@/lib/db";
import { userHash, type SessionUser } from "@/server/auth";
import { loadPassage } from "@/server/content";
import { matchKeyPoints, scoreAnalysis, scorePredict, type AnalysisAnswer, type AnalysisResult } from "@/server/assessment/rules";
import { aiRecall, aiRubric, LOW_CONFIDENCE, type RubricResult } from "@/server/assessment/ai";
import { abilityScores, decideLevel, todayTip } from "@/server/learner/levels";
import { localTimeAfter, planReviews } from "@/server/learner/schedule";

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

/** 每次训练每类作答只保留一条（重交覆盖） */
async function upsertResponse(r: ResponseInsert, tx: Tx | typeof db = db) {
  const { sessionId: _s, kind: _k, ...set } = r;
  await tx
    .insert(responses)
    .values(r)
    .onConflictDoUpdate({ target: [responses.sessionId, responses.kind], set: { ...set, createdAt: new Date() } });
}

export async function startSession(user: SessionUser, passageId: string, assignmentId?: string) {
  const passage = await db.query.passages.findFirst({ where: and(eq(passages.id, passageId), eq(passages.status, "PUBLISHED")) });
  if (!passage) throw new TrainingError(404, "材料不存在或未发布");

  // 同一篇未完成的训练直接继续
  const open = await db.query.sessions.findFirst({
    where: and(eq(sessions.studentId, user.id), eq(sessions.passageId, passageId), isNull(sessions.completedAt)),
    orderBy: desc(sessions.startedAt),
  });
  if (open) return open;

  // 防沉迷：每日可开始的训练节数（按 UTC+8 自然日）
  const limit = Number(process.env.DAILY_SESSION_LIMIT ?? 2);
  const dayStart = localTimeAfter(new Date(), 0, 0, 0);
  const [{ n }] = await db.select({ n: count() }).from(sessions).where(and(eq(sessions.studentId, user.id), gte(sessions.startedAt, dayStart)));
  if (n >= limit) throw new TrainingError(429, `今天已开始 ${n} 节训练，明天再来吧。间隔练习比一次练很多更有效。`);

  if (assignmentId) {
    const a = await db.query.assignments.findFirst({ where: eq(assignments.id, assignmentId) });
    const me = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { classroomId: true } });
    if (!a || a.passageId !== passageId || a.classroomId !== me?.classroomId) throw new TrainingError(400, "任务与材料不匹配");
  }
  const [created] = await db.insert(sessions).values({ studentId: user.id, passageId, passageVersion: passage.version, assignmentId }).returning();
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

  await db.transaction(async (tx) => {
    await tx.update(sessions).set({ confidence, step: "RECALL" }).where(eq(sessions.id, id));
    await upsertResponse(
      {
        sessionId: id,
        kind: "recall",
        answer: { text },
        score: coverage,
        detail: { covered, keyword, ai: ai?.covered ?? null, misconception: ai?.misconception ?? "" },
        source: ai ? "AI" : "KEYWORD",
        feedback: ai ? { text: ai.feedback, model: ai.model, label: "AI 回忆教练" } : null,
      },
      tx,
    );
  });

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

export async function submitSummary(user: SessionUser, id: string, summary: string, transfer: string | null) {
  const { passage } = await getOwnedSession(user, id);
  const rubric = await aiRubric(passage, summary, transfer, userHash(user.id));
  await upsertResponse({
    sessionId: id,
    kind: "summary",
    answer: { summary, transfer },
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
  const plan = planReviews(kps.length, covered, now);

  const levelChanges: { ability: AbilityKey; to: LevelKey }[] = [];
  await db.transaction(async (tx) => {
    for (const [ability, score] of Object.entries(scores) as [AbilityKey, number][]) {
      await tx.insert(abilityAttempts).values({ studentId: user.id, sessionId: id, ability, level: passage.level, genre: passage.genre, score });
      await tx.insert(mastery).values({ studentId: user.id, ability }).onConflictDoNothing();
      const m = await tx.query.mastery.findFirst({ where: and(eq(mastery.studentId, user.id), eq(mastery.ability, ability)) });
      const attempts = await tx.query.abilityAttempts.findMany({
        where: and(eq(abilityAttempts.studentId, user.id), eq(abilityAttempts.ability, ability)),
        orderBy: desc(abilityAttempts.createdAt),
        limit: 10,
      });
      const lastWeek = await tx.query.reviewItems.findFirst({
        where: and(eq(reviewItems.studentId, user.id), eq(reviewItems.intervalD, 7), isNotNull(reviewItems.doneAt)),
        orderBy: desc(reviewItems.doneAt),
      });
      const decision = decideLevel(
        (m?.level ?? "L2") as LevelKey,
        attempts.map((a) => ({ level: a.level as LevelKey, score: a.score, createdAt: a.createdAt })),
        lastWeek?.passed ?? null,
      );
      if (decision.action === "upgrade" && m) {
        await tx.update(mastery).set({ level: decision.to }).where(eq(mastery.id, m.id));
        levelChanges.push({ ability, to: decision.to });
      }
    }
    if (plan.length) {
      await tx.insert(reviewItems).values(plan.map((r) => ({ studentId: user.id, keyPointId: kps[r.keyPointIndex].id, dueAt: r.dueAt, intervalD: r.intervalD })));
    }
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
  await db.update(sessions).set({ step: "DONE", completedAt: now, summary: result }).where(eq(sessions.id, id));
  return result;
}

export type CompleteResult = Awaited<ReturnType<typeof completeSession>>;
