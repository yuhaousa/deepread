// 内容完整性：每篇种子材料的题目都必须有原文依据、答案下标合法。
import { describe, expect, it } from "vitest";
import { PASSAGES } from "@/content/passages";
import { ABILITIES, LEVELS } from "@/lib/domain";
import { matchKeyPoints } from "@/server/assessment/rules";

describe.each(PASSAGES)("材料《$title》", (p) => {
  it("基本字段合法", () => {
    expect(LEVELS).toContain(p.level);
    expect(ABILITIES).toContain(p.primaryAbility);
    expect(p.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(p.keyPoints.length).toBeGreaterThanOrEqual(4);
    expect(p.refSummary.length).toBeGreaterThan(40);
  });

  it("关键点指向存在的段落，且每个关键词都出现在原文或关键点中", () => {
    const source = p.lead + p.paragraphs.join("");
    for (const kp of p.keyPoints) {
      expect(kp.paragraph).toBeGreaterThanOrEqual(1);
      expect(kp.paragraph).toBeLessThanOrEqual(p.paragraphs.length);
      expect(kp.keywords.length).toBeGreaterThan(0);
      // 至少一个关键词能在原文中找到，保证回忆评分有据可依
      expect(kp.keywords.some((w) => source.includes(w))).toBe(true);
    }
  });

  it("参考摘要能覆盖大部分关键点", () => {
    const hit = matchKeyPoints(p.refSummary, p.keyPoints).length;
    expect(hit / p.keyPoints.length).toBeGreaterThanOrEqual(0.6);
  });

  it("所有选择题答案下标在选项范围内", () => {
    const mcqs = [p.predict];
    const a = p.analysis;
    if (a.kind === "roles") {
      for (const it of a.items) {
        expect(it.answer).toBeLessThan(a.roles.length);
        expect(it.paragraph).toBeLessThanOrEqual(p.paragraphs.length);
      }
      if (a.mcq) mcqs.push(a.mcq);
    }
    if (a.kind === "audit") for (const c of a.clauses) expect(c.answer).toBeLessThan(a.types.length);
    if (a.kind === "quiz") mcqs.push(...a.questions);
    if (a.kind === "sequence" && a.mcq) mcqs.push(a.mcq);
    for (const m of mcqs) {
      expect(m.answer).toBeGreaterThanOrEqual(0);
      expect(m.answer).toBeLessThan(m.options.length);
    }
  });
});

it("六项能力各有至少一篇主训练材料", () => {
  for (const a of ABILITIES) expect(PASSAGES.some((p) => p.primaryAbility === a)).toBe(true);
});

it("slug 唯一", () => {
  expect(new Set(PASSAGES.map((p) => p.slug)).size).toBe(PASSAGES.length);
});
