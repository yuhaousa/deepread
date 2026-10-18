// AI 导师对话：角色提示词 → 模型 → 护栏检测 → 必要时替换为安全提示。

import type { PassageSpec, StepKey } from "@/lib/domain";
import type { LearningMode } from "@/lib/modes";
import { callLlm, type ChatMessage } from "@/server/llm/router";
import { checkTutorOutput, safeHint, type GuardrailResult } from "@/server/tutor/guardrail";
import { roleForStep, tutorSystemPrompt } from "@/server/tutor/prompts";

export interface TutorReply {
  text: string;
  role: ReturnType<typeof roleForStep>;
  guardrail: GuardrailResult & { rewritten: boolean };
  ai: boolean;
}

const MAX_HISTORY = 8;

export async function tutorReply(p: PassageSpec, step: StepKey, history: ChatMessage[], userHash?: string, mode?: LearningMode): Promise<TutorReply> {
  const role = roleForStep(p, step, mode);
  const res = await callLlm({
    purpose: "TUTOR",
    tier: "quick",
    system: tutorSystemPrompt(p, step, mode),
    messages: history.slice(-MAX_HISTORY),
    maxTokens: 300,
    userHash,
  });
  if (!res) {
    return { text: safeHint(step), role, guardrail: { leaked: false, rewritten: false }, ai: false };
  }
  const check = checkTutorOutput(res.text, p, step);
  if (check.leaked) {
    return { text: safeHint(step), role, guardrail: { ...check, rewritten: true }, ai: true };
  }
  return { text: res.text.trim(), role, guardrail: { ...check, rewritten: false }, ai: true };
}
