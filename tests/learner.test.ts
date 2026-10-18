import { describe, expect, it } from "vitest";
import { abilityScores, decideLevel, todayTip, type Attempt } from "@/server/learner/levels";
import { localTimeAfter, planReviews } from "@/server/learner/schedule";

const at = (daysAgo: number) => new Date(Date.UTC(2026, 9, 17) - daysAgo * 864e5);
const attempts = (scores: number[], level: Attempt["level"] = "L2"): Attempt[] => scores.map((score, i) => ({ level, score, createdAt: at(i) }));

describe("等级规则", () => {
  it("连续 4 次达标且最近 7 天复习未失败 → 升级", () => {
    expect(decideLevel("L2", attempts([0.8, 0.75, 0.9, 0.7]), true)).toEqual({ action: "upgrade", to: "L3" });
    expect(decideLevel("L2", attempts([0.8, 0.75, 0.9, 0.7]), null)).toEqual({ action: "upgrade", to: "L3" });
  });
  it("7 天复习失败时不升级", () => {
    expect(decideLevel("L2", attempts([0.8, 0.75, 0.9, 0.7]), false).action).toBe("stay");
  });
  it("只有 3 次达标、或中间一次未达标 → 不升级", () => {
    expect(decideLevel("L2", attempts([0.8, 0.8, 0.8]), true).action).toBe("stay");
    expect(decideLevel("L2", attempts([0.8, 0.6, 0.8, 0.8]), true).action).toBe("stay");
  });
  it("低于当前等级的材料不计入升级", () => {
    expect(decideLevel("L3", attempts([0.9, 0.9, 0.9, 0.9], "L2"), true).action).toBe("stay");
  });
  it("L6 不再升级", () => {
    expect(decideLevel("L6", attempts([1, 1, 1, 1], "L6"), true).action).toBe("stay");
  });
  it("本级连续 3 次 < 40% → 补练", () => {
    expect(decideLevel("L3", attempts([0.2, 0.3, 0.1], "L3"), null)).toEqual({ action: "remedial" });
  });
});

describe("能力折算", () => {
  it("跳读（> 900 字/分）降低专注分", () => {
    const fast = abilityScores({ charCount: 500, readingSeconds: 20, lookbacks: 0, recallCoverage: 0.5, analysisScore: 0.5, analysisAbility: "ANALYZE", rubricTotal: 4 });
    const normal = abilityScores({ charCount: 500, readingSeconds: 90, lookbacks: 0, recallCoverage: 0.5, analysisScore: 0.5, analysisAbility: "ANALYZE", rubricTotal: 4 });
    expect(fast.FOCUS).toBeLessThan(normal.FOCUS!);
    expect(normal.EXPRESS).toBeCloseTo(4 / 6);
  });
  it("没有作答的能力不出分", () => {
    const s = abilityScores({ charCount: 500, readingSeconds: null, lookbacks: 0, recallCoverage: null, analysisScore: null, analysisAbility: "VERIFY", rubricTotal: null });
    expect(s).toEqual({});
  });
  it("今日建议指向最弱的一项", () => {
    expect(todayTip({ FOCUS: 1, RECALL: 0.3, ANALYZE: 0.8, EXPRESS: 0.5 }).ability).toBe("RECALL");
    expect(todayTip({ FOCUS: 1, RECALL: 0.9, ANALYZE: 0.8 }).ability).toBe("EXPRESS");
  });
});

describe("复习调度", () => {
  it("次日 07:30（UTC+8）与 7 天后", () => {
    const now = new Date("2026-10-17T14:00:00Z"); // 新加坡 22:00
    expect(localTimeAfter(now, 1).toISOString()).toBe("2026-10-17T23:30:00.000Z"); // 10 月 18 日 07:30 SGT
    expect(localTimeAfter(now, 7).toISOString()).toBe("2026-10-23T23:30:00.000Z");
  });
  it("跨过当地午夜时仍按当地日期计算", () => {
    const now = new Date("2026-10-17T17:00:00Z"); // 新加坡 10 月 18 日 01:00
    expect(localTimeAfter(now, 1).toISOString()).toBe("2026-10-18T23:30:00.000Z");
  });
  it("次日优先复习没想起来的关键点，7 天后全部混合", () => {
    const plan = planReviews(6, [0, 1, 2, 3], new Date());
    const nextDay = plan.filter((p) => p.intervalD === 1).map((p) => p.keyPointIndex);
    expect(nextDay).toEqual([4, 5, 0]);
    expect(plan.filter((p) => p.intervalD === 7)).toHaveLength(6);
  });
});
