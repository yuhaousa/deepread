// 测评引擎 · AI 部分：回忆语义判定（quick 档）与摘要量表评分（deep 档）。
// 结果用 zod 校验；模型不可用或输出不合规时返回 null，由调用方降级。

import { z } from "zod";
import type { PassageSpec } from "@/lib/domain";
import type { LearningMode } from "@/lib/modes";
import { callLlm } from "@/server/llm/router";
import { recallPrompt, rubricPrompt } from "@/server/tutor/prompts";
import { checkTutorOutput } from "@/server/tutor/guardrail";
import { extractJson } from "@/server/text";

const RecallAi = z.object({
  covered: z.array(z.coerce.number().int()).default([]),
  misconception: z.string().default(""),
  feedback: z.string().default(""),
});
export type RecallAiResult = z.infer<typeof RecallAi> & { model: string };

const score02 = z.coerce.number().int().min(0).max(2);
const Rubric = z.object({
  main: score02,
  relation: score02,
  selection: score02,
  praise: z.string().default(""),
  issue: z.string().default(""),
  transfer: z.string().default(""),
  next_step: z.string().default(""),
  confidence: z.coerce.number().min(0).max(1).default(0.8),
});
export type RubricResult = z.infer<typeof Rubric> & { total: number; model: string };

/** 量表置信度低于此值的作答进入教师抽检 */
export const LOW_CONFIDENCE = 0.6;

export async function aiRecall(p: PassageSpec, recall: string, userHash?: string): Promise<RecallAiResult | null> {
  const res = await callLlm({ purpose: "RECALL", tier: "quick", json: true, userHash, messages: [{ role: "user", content: recallPrompt(p, recall) }] });
  if (!res) return null;
  const parsed = RecallAi.safeParse(extractJson(res.text));
  if (!parsed.success) return null;
  const covered = parsed.data.covered.filter((n) => n >= 0 && n < p.keyPoints.length);
  // 回忆反馈也要过护栏：不得复述原文或关键点
  const feedback = checkTutorOutput(parsed.data.feedback, p, "RECALL").leaked
    ? "你已经写出了一部分内容。想想文章还有哪一段你没有提到？先回忆那一段讲的是哪一类事情。"
    : parsed.data.feedback;
  return { ...parsed.data, covered, feedback, model: res.model };
}

export async function aiRubric(p: PassageSpec, summary: string, transfer: string | null, userHash?: string, extra?: { mode: LearningMode; text: string }): Promise<RubricResult | null> {
  const res = await callLlm({ purpose: "RUBRIC", tier: "deep", json: true, userHash, messages: [{ role: "user", content: rubricPrompt(p, summary, transfer, extra) }] });
  if (!res) return null;
  const parsed = Rubric.safeParse(extractJson(res.text));
  if (!parsed.success) return null;
  const r = parsed.data;
  return { ...r, total: r.main + r.relation + r.selection, model: res.model };
}
