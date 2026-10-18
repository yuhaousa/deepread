// 四种学习方式：定义完整、导师角色与提示词随方式变化、回忆教练的复习更密。
import { describe, expect, it } from "vitest";
import { PASSAGES } from "@/content/passages";
import { STEPS } from "@/lib/domain";
import { LEARNING_MODES, MODE_SPECS, isLearningMode } from "@/lib/modes";
import { planReviews } from "@/server/learner/schedule";
import { roleForStep, rubricPrompt, tutorSystemPrompt } from "@/server/tutor/prompts";

const heat = PASSAGES.find((p) => p.slug === "urban-heat-island")!;
const NOW = new Date("2026-10-18T04:00:00Z");

describe.each(LEARNING_MODES)("学习方式 %s", (m) => {
  const s = MODE_SPECS[m];
  it("每一步都有推荐问题定义，重点步骤合法", () => {
    for (const step of STEPS) expect(Array.isArray(s.chips[step])).toBe(true);
    expect(s.focus.length).toBeGreaterThan(0);
    for (const f of s.focus) expect(STEPS).toContain(f);
  });

  it("选定方式后，整节课导师都使用该角色", () => {
    for (const step of STEPS) expect(roleForStep(heat, step, m)).toBe(m);
  });

  it("合书回忆环节无论哪种方式都要求不复述原文", () => {
    expect(tutorSystemPrompt(heat, "RECALL", m)).toContain("绝对不要复述或引用原文");
    expect(tutorSystemPrompt(heat, "RECALL", m)).toContain(s.label);
  });
});

it("未选方式时沿用材料与步骤的默认导师", () => {
  expect(roleForStep(heat, "RECALL")).toBe("RECALL_COACH");
  expect(roleForStep(heat, "READ")).toBe("READING");
});

it("只有论证对练与核查陪练有表达环节附加任务", () => {
  expect(LEARNING_MODES.filter((m) => MODE_SPECS[m].extraTask)).toEqual(["DEBATE", "VERIFY"]);
});

it("附加任务会写进量表提示词", () => {
  const p = rubricPrompt(heat, "摘要", "迁移", { mode: "DEBATE", text: "有人可能会说空调不是主因" });
  expect(p).toContain("有人可能会说空调不是主因");
  expect(p).toContain("反方意见是否站得住");
  expect(rubricPrompt(heat, "摘要", "迁移")).not.toContain("学生回答：有人");
});

it("isLearningMode 只接受四种方式", () => {
  expect(isLearningMode("DEBATE")).toBe(true);
  expect(isLearningMode("ADMIN")).toBe(false);
  expect(isLearningMode(null)).toBe(false);
});

describe("回忆教练的复习安排", () => {
  it("默认：次日 3 个关键点 + 7 天全部", () => {
    const plan = planReviews(6, [0, 1], NOW);
    expect(plan.filter((r) => r.intervalD === 1)).toHaveLength(3);
    expect(plan.filter((r) => r.intervalD === 3)).toHaveLength(0);
    expect(plan.filter((r) => r.intervalD === 7)).toHaveLength(6);
  });

  it("加强：次日 5 个，第 3 天复习全部遗漏点", () => {
    const plan = planReviews(6, [0, 1], NOW, { intensive: true });
    expect(plan.filter((r) => r.intervalD === 1)).toHaveLength(5);
    expect(plan.filter((r) => r.intervalD === 3).map((r) => r.keyPointIndex)).toEqual([2, 3, 4, 5]);
    expect(plan.filter((r) => r.intervalD === 7)).toHaveLength(6);
  });
});
