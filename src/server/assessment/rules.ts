// 测评引擎 · 规则评分与关键点匹配。
// 规则评分用于预测、段落作用、推理选择、逐句核查、排序、定位题；
// 关键点匹配是回忆评分的离线基线，AI 判定结果与其取并集。

import type { AnalysisSpec, KeyPointSpec, Mcq } from "@/lib/domain";
import { normalize } from "@/server/text";

export interface ItemResult {
  label: string; // 题目简述，用于教师端共性错误
  correct: boolean;
  given: number | null;
  expected: number;
  explanation?: string;
}

export interface AnalysisResult {
  score: number; // 0–1
  correct: number;
  total: number;
  items: ItemResult[];
  selfCheck?: { chosen: number | null; consistent: boolean };
}

/** 回忆：按关键词匹配覆盖的关键点（返回 0-based 序号） */
export function matchKeyPoints(text: string, keyPoints: Pick<KeyPointSpec, "keywords">[]): number[] {
  const t = normalize(text);
  return keyPoints
    .map((kp, i) => (kp.keywords.some((w) => t.includes(normalize(w))) ? i : -1))
    .filter((i) => i >= 0);
}

export function scorePredict(predict: Mcq, choice: number) {
  return { correct: choice === predict.answer, explanation: predict.explanation };
}

function scoreMcq(mcq: Mcq, given: number | null | undefined): ItemResult {
  return {
    label: mcq.question,
    correct: given === mcq.answer,
    given: given ?? null,
    expected: mcq.answer,
    explanation: mcq.explanation,
  };
}

export type AnalysisAnswer =
  | { kind: "roles"; roles: (number | null)[]; mcq?: number | null }
  | { kind: "audit"; verdicts: (number | null)[] }
  | { kind: "quiz"; answers: (number | null)[]; selfCheck?: number | null }
  | { kind: "sequence"; order: number[]; mcq?: number | null };

export function scoreAnalysis(spec: AnalysisSpec, answer: AnalysisAnswer): AnalysisResult {
  if (spec.kind !== answer.kind) throw new Error(`analysis kind mismatch: ${spec.kind} vs ${answer.kind}`);
  const items: ItemResult[] = [];

  switch (spec.kind) {
    case "roles": {
      const a = answer as Extract<AnalysisAnswer, { kind: "roles" }>;
      spec.items.forEach((it, k) => {
        const given = a.roles[k] ?? null;
        items.push({
          label: `第 ${it.paragraph} 段的作用（${spec.roles[it.answer]}）`,
          correct: given === it.answer,
          given,
          expected: it.answer,
          explanation: `参考：${spec.roles[it.answer]}`,
        });
      });
      if (spec.mcq) items.push(scoreMcq(spec.mcq, a.mcq));
      break;
    }
    case "audit": {
      const a = answer as Extract<AnalysisAnswer, { kind: "audit" }>;
      spec.clauses.forEach((c, k) => {
        const given = a.verdicts[k] ?? null;
        items.push({
          label: `核查第 ${k + 1} 句（${spec.types[c.answer]}）`,
          correct: given === c.answer,
          given,
          expected: c.answer,
          explanation: c.explanation,
        });
      });
      break;
    }
    case "quiz": {
      const a = answer as Extract<AnalysisAnswer, { kind: "quiz" }>;
      spec.questions.forEach((q, k) => items.push(scoreMcq(q, a.answers[k])));
      const result = summarize(items);
      if (spec.selfCheck) {
        // 走神自查：学生选出“最不专心的段落”（null = 一直很专注）。
        // 若所选段落恰有答错的题，或全对且自报专注，则视为自我觉察准确。
        const chosen = a.selfCheck ?? null;
        const wrongParas = spec.questions.filter((q, k) => !items[k].correct).map((q) => q.paragraph);
        const consistent = chosen === null ? wrongParas.length === 0 : wrongParas.length === 0 || wrongParas.includes(chosen);
        return { ...result, selfCheck: { chosen, consistent } };
      }
      return result;
    }
    case "sequence": {
      const a = answer as Extract<AnalysisAnswer, { kind: "sequence" }>;
      // order[p] = 学生放在第 p 位的环节原序号。
      // 每一对相邻因果环节（i → i+1）单独计分：学生排序中 i+1 紧跟在 i 之后即为正确。
      const pos = (step: number) => a.order.indexOf(step);
      for (let i = 0; i < spec.steps.length - 1; i++) {
        const p = pos(i);
        items.push({
          label: `因果顺序：${spec.steps[i]} → ${spec.steps[i + 1]}`,
          correct: p >= 0 && pos(i + 1) === p + 1,
          given: p >= 0 ? (a.order[p + 1] ?? null) : null,
          expected: i + 1,
        });
      }
      if (spec.mcq) items.push(scoreMcq(spec.mcq, a.mcq));
      break;
    }
  }
  return summarize(items);
}

function summarize(items: ItemResult[]): AnalysisResult {
  const correct = items.filter((i) => i.correct).length;
  return { score: items.length ? correct / items.length : 0, correct, total: items.length, items };
}
