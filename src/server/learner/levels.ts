// 学习者模型 · 能力打分与等级规则（方案文档第 7 节“定级与升级规则”）。

import { LEVELS, type AbilityKey, type LevelKey } from "@/lib/domain";

export const PASS_RATE = 0.7; // 达标
export const STRUGGLE_RATE = 0.4; // 需要补练
export const UPGRADE_STREAK = 4; // 连续达标次数
export const REMEDIAL_STREAK = 3; // 连续未达标次数

export interface Attempt {
  level: LevelKey;
  score: number; // 0–1
  createdAt: Date;
}

export type LevelDecision =
  | { action: "upgrade"; to: LevelKey }
  | { action: "remedial" } // 推送本级补练，不降级显示
  | { action: "stay" };

const rank = (l: LevelKey) => LEVELS.indexOf(l);

/**
 * 升级：在当前等级（或更高）的材料上连续 UPGRADE_STREAK 次达标率 ≥ 70%，且最近一次 7 天复习未失败。
 * 补练：在当前等级上连续 REMEDIAL_STREAK 次 < 40%。
 */
export function decideLevel(current: LevelKey, attempts: Attempt[], lastWeekReviewPassed: boolean | null): LevelDecision {
  const relevant = attempts
    .filter((a) => rank(a.level) >= rank(current))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const recent = relevant.slice(0, UPGRADE_STREAK);
  if (
    recent.length === UPGRADE_STREAK &&
    recent.every((a) => a.score >= PASS_RATE) &&
    lastWeekReviewPassed !== false &&
    rank(current) < LEVELS.length - 1
  ) {
    return { action: "upgrade", to: LEVELS[rank(current) + 1] };
  }

  const atLevel = attempts
    .filter((a) => a.level === current)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, REMEDIAL_STREAK);
  if (atLevel.length === REMEDIAL_STREAK && atLevel.every((a) => a.score < STRUGGLE_RATE)) {
    return { action: "remedial" };
  }
  return { action: "stay" };
}

export interface SessionEvidence {
  charCount: number;
  readingSeconds: number | null;
  lookbacks: number;
  recallCoverage: number | null; // 0–1
  analysisScore: number | null; // 0–1
  analysisAbility: AbilityKey;
  rubricTotal: number | null; // 0–6
}

/** 把一次训练的作答折算为各项能力的 0–1 得分（只返回本次有证据的能力） */
export function abilityScores(e: SessionEvidence): Partial<Record<AbilityKey, number>> {
  const out: Partial<Record<AbilityKey, number>> = {};

  if (e.readingSeconds) {
    const cpm = e.charCount / (e.readingSeconds / 60);
    // 初中默读通常 300–500 字/分；明显过快视为跳读，回看过多视为不够专注
    let focus = cpm > 900 ? 0.4 : 1;
    if (e.lookbacks >= 3) focus = Math.min(focus, e.lookbacks >= 5 ? 0.3 : 0.6);
    out.FOCUS = focus;
  }
  if (e.recallCoverage !== null) out.RECALL = e.recallCoverage;
  if (e.analysisScore !== null) {
    out[e.analysisAbility] =
      e.analysisAbility === "FOCUS" && out.FOCUS !== undefined ? (out.FOCUS + e.analysisScore) / 2 : e.analysisScore;
  }
  if (e.rubricTotal !== null) out.EXPRESS = e.rubricTotal / 6;
  return out;
}

/** 今日最重要的一条建议：选出最弱的一项 */
export function todayTip(scores: Partial<Record<AbilityKey, number>>): { ability: AbilityKey; tip: string } {
  const TIPS: Record<AbilityKey, string> = {
    FOCUS: "今天读得偏快或回看较多。下次每读完一段，停一秒问自己：这段讲了什么？再往下读。",
    RECALL: "今天的合书回忆还漏了几个关键点。下次读完每一段，停下来用一句话在心里说出这段讲了什么，再往下读。",
    COMPREHEND: "结构判断还有几处不准。下次先找每段的第一句和关联词（首先、其次、当然、所以），它们往往标出了段落的作用。",
    ANALYZE: "论证分析还有几处不准。先分清哪句是作者的主张，再看后面每段是在给理由、举证据，还是在让步。",
    VERIFY: "核查时有几句判断不准。记住三步：找到原文对应的句子，比较数字和程度词，确认原文是否真的提到。",
    EXPRESS: "回忆和分析都不错。下次写摘要时试着把字数压到 100 字以内，逼自己做取舍。",
  };
  const entries = Object.entries(scores) as [AbilityKey, number][];
  const weakest = entries.filter(([k]) => k !== "EXPRESS").sort((a, b) => a[1] - b[1])[0];
  const ability: AbilityKey = weakest && weakest[1] < PASS_RATE ? weakest[0] : "EXPRESS";
  return { ability, tip: TIPS[ability] };
}
