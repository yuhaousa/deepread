// 内容完整性：每篇种子材料的题目都必须有原文依据、答案下标合法。
import { describe, expect, it } from "vitest";
import { PASSAGES } from "@/content/passages";
import { LEVELED_PASSAGES } from "@/content/passages-leveled";
import { ABILITIES, LEVEL_META, LEVELS, charCount } from "@/lib/domain";
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

it("五个等级各有至少两篇材料，且每级覆盖至少两项能力", () => {
  for (const l of LEVELS) {
    const at = PASSAGES.filter((p) => p.level === l);
    expect(at.length).toBeGreaterThanOrEqual(2);
    expect(new Set(at.map((p) => p.primaryAbility)).size).toBeGreaterThanOrEqual(2);
  }
});

describe.each(LEVELED_PASSAGES)("分级扩充材料《$title》", (p) => {
  it("篇幅符合该等级的字数区间", () => {
    const [min, max] = LEVEL_META[p.level].length.match(/\d+/g)!.map(Number);
    const n = charCount(p);
    expect(n).toBeGreaterThanOrEqual(min);
    expect(n).toBeLessThanOrEqual(max);
  });

  it("段落作用 / 核查题的答案不是按位置依次排列", () => {
    const a = p.analysis;
    const answers = a.kind === "roles" ? a.items.map((i) => i.answer) : a.kind === "audit" ? a.clauses.map((c) => c.answer) : null;
    if (answers) expect(answers.some((v, i) => v !== i)).toBe(true);
  });
});
