import { describe, expect, it } from "vitest";
import { PASSAGES } from "@/content/passages";
import { matchKeyPoints, scoreAnalysis } from "@/server/assessment/rules";

const get = (slug: string) => PASSAGES.find((p) => p.slug === slug)!;

describe("回忆关键点匹配", () => {
  it("命中关键词即覆盖，忽略标点与空白", () => {
    const heat = get("urban-heat-island");
    const covered = matchKeyPoints("城区比郊区热。沥青、水泥白天吸热；高楼 挡风；空调排热会循环。", heat.keyPoints);
    expect(covered).toEqual([0, 1, 2, 3]);
  });

  it("全角数字也能匹配", () => {
    const nap = get("nap-memory");
    expect(matchKeyPoints("午睡组１５.２个，自习组13.8个", nap.keyPoints)).toContain(2);
  });

  it("空回忆不覆盖任何关键点", () => {
    expect(matchKeyPoints("我不记得了", get("bike-tides").keyPoints)).toEqual([]);
  });
});

describe("结构分析规则评分", () => {
  it("段落作用全对得满分", () => {
    const p = get("short-video");
    if (p.analysis.kind !== "roles") throw new Error();
    const r = scoreAnalysis(p.analysis, { kind: "roles", roles: p.analysis.items.map((i) => i.answer), mcq: p.analysis.mcq!.answer });
    expect(r.score).toBe(1);
    expect(r.total).toBe(7);
  });

  it("逐句核查记录每句对错与解析", () => {
    const p = get("cafeteria-leftovers");
    if (p.analysis.kind !== "audit") throw new Error();
    const r = scoreAnalysis(p.analysis, { kind: "audit", verdicts: [0, 2, 0, 3, 4] });
    expect(r.correct).toBe(4);
    expect(r.items[2].correct).toBe(false);
    expect(r.items[2].explanation).toContain("240");
  });

  it("因果排序：正确顺序满分，交换两环只扣相关的两对", () => {
    const p = get("meandering-river");
    if (p.analysis.kind !== "sequence") throw new Error();
    const n = p.analysis.steps.length;
    const right = scoreAnalysis(p.analysis, { kind: "sequence", order: [...Array(n).keys()], mcq: p.analysis.mcq!.answer });
    expect(right.score).toBe(1);
    const swapped = [0, 2, 1, 3, 4, 5];
    const r = scoreAnalysis(p.analysis, { kind: "sequence", order: swapped, mcq: p.analysis.mcq!.answer });
    // 5 个相邻对中 0→1、1→2、2→3 三对被打乱，3→4、4→5 仍正确；外加推理题正确
    expect(r.correct).toBe(3);
    expect(r.total).toBe(6);
  });

  it("走神自查：答错题所在段落与自报一致即为准确", () => {
    const p = get("bee-dance");
    if (p.analysis.kind !== "quiz") throw new Error();
    const [q0, q1, q2] = p.analysis.questions;
    const wrong1 = (q1.answer + 1) % q1.options.length;
    const r = scoreAnalysis(p.analysis, { kind: "quiz", answers: [q0.answer, wrong1, q2.answer], selfCheck: q1.paragraph });
    expect(r.selfCheck).toEqual({ chosen: q1.paragraph, consistent: true });
    const r2 = scoreAnalysis(p.analysis, { kind: "quiz", answers: [q0.answer, wrong1, q2.answer], selfCheck: null });
    expect(r2.selfCheck?.consistent).toBe(false);
  });

  it("题型不符时报错", () => {
    const p = get("short-video");
    expect(() => scoreAnalysis(p.analysis, { kind: "audit", verdicts: [] })).toThrow();
  });
});
