// AI 导师护栏：输出后检测是否泄露答案，命中则替换为按步骤准备的安全提示。
// 第一层是角色提示词（prompts.ts），这里是第二层（规则检测）；
// 第三层是学生连续要答案时只升级提示粒度（由提示词约束 + 本模块兜底）。

import type { PassageSpec, StepKey } from "@/lib/domain";
import { longestCommonSubstring, normalize } from "@/server/text";

export interface GuardrailResult {
  leaked: boolean;
  reason?: string;
}

/** 合书回忆时与原文连续重合的字数上限；其他步骤的上限 */
const RECALL_OVERLAP_LIMIT = 8;
const SOURCE_OVERLAP_LIMIT = 16;
const SUMMARY_OVERLAP_LIMIT = 12;

const PARA_REF = /第\s*[一二三四五六七八九十\d]+\s*(段|句)/;
const ANSWER_PHRASE = /(答案|正确答案|正确选项)\s*(是|为|就是|应该是)|选\s*[A-DＡ-Ｄ①-④]\b/;

export function checkTutorOutput(output: string, passage: PassageSpec, step: StepKey): GuardrailResult {
  const out = normalize(output);
  if (!out) return { leaked: false };

  if (ANSWER_PHRASE.test(output)) return { leaked: true, reason: "直接给出答案" };

  if (longestCommonSubstring(out, normalize(passage.refSummary)) >= SUMMARY_OVERLAP_LIMIT) {
    return { leaked: true, reason: "复述参考摘要" };
  }

  const limit = step === "RECALL" ? RECALL_OVERLAP_LIMIT : SOURCE_OVERLAP_LIMIT;
  for (const para of passage.paragraphs) {
    if (longestCommonSubstring(out, normalize(para)) >= limit) {
      return { leaked: true, reason: step === "RECALL" ? "回忆环节复述原文" : "大段引用原文" };
    }
  }

  if (step === "RECALL") {
    for (const kp of passage.keyPoints) {
      const body = normalize(kp.text.split("：").pop() ?? kp.text);
      if (body.length >= 6 && longestCommonSubstring(out, body) >= Math.min(8, body.length)) {
        return { leaked: true, reason: "说出了关键点内容" };
      }
    }
  }

  if (step === "ANALYZE") {
    const a = passage.analysis;
    if (a.kind === "roles" && PARA_REF.test(output) && a.roles.some((r) => output.includes(r))) {
      return { leaked: true, reason: "直接给出段落作用" };
    }
    if (a.kind === "audit" && PARA_REF.test(output) && a.types.slice(1).some((t) => output.includes(t))) {
      return { leaked: true, reason: "直接判定摘要句子" };
    }
    const mcqs = a.kind === "quiz" ? a.questions : "mcq" in a && a.mcq ? [a.mcq] : [];
    for (const q of mcqs) {
      const right = normalize(q.options[q.answer]);
      if (right.length >= 6 && longestCommonSubstring(out, right) >= Math.min(10, right.length)) {
        return { leaked: true, reason: "说出了选择题正确选项" };
      }
    }
  }
  return { leaked: false };
}

const SAFE_HINTS: Record<StepKey, string> = {
  PREDICT: "先看标题是不是一个问题，再看导语描述了什么。你觉得作者接下来最可能先讲什么？",
  READ: "这一段的第一句往往点出它要讲什么。你能用五个字概括这一段吗？",
  RECALL: "先别急着想细节。这篇文章一共讲了几件事？先把“几件事”数出来，再一件件回想。",
  ANALYZE: "找找每段开头的关联词，比如“首先”“当然”“所以”，它们常常标出这一段在全文里干什么。你先看哪一段？",
  EXPRESS: "先用一句话说出全文最想告诉读者的事，再想想有哪两三个原因或理由支撑它。",
  FEEDBACK: "回看今天最难的一步，想想下次读之前可以先做什么准备？",
};

export function safeHint(step: StepKey): string {
  return SAFE_HINTS[step];
}
