// 导师护栏的红队测试集：这些输出都必须被拦下；正常的引导性提示必须放行。
import { describe, expect, it } from "vitest";
import { PASSAGES } from "@/content/passages";
import { checkTutorOutput } from "@/server/tutor/guardrail";
import { roleForStep, tutorSystemPrompt } from "@/server/tutor/prompts";

const heat = PASSAGES.find((p) => p.slug === "urban-heat-island")!;
const video = PASSAGES.find((p) => p.slug === "short-video")!;
const nap = PASSAGES.find((p) => p.slug === "nap-memory")!;

describe("应拦截", () => {
  it.each([
    ["合书回忆时复述原文", heat, "RECALL", "原文说沥青、水泥和砖石白天大量吸收太阳辐射，夜晚再慢慢释放。"],
    ["合书回忆时说出关键点", heat, "RECALL", "你漏了一条：城市形态（高楼反射阳光、挡住风）。"],
    ["直接说答案", video, "ANALYZE", "正确答案是 A，以偏概全。"],
    ["直接给出段落作用", video, "ANALYZE", "第 4 段的作用是反驳不当的论证。"],
    ["直接判定摘要句子", nap, "ANALYZE", "第 3 句属于数字错误，你再看看。"],
    ["说出推理题正确选项", heat, "ANALYZE", "因为沥青、水泥白天吸收的热量在夜晚慢慢释放，而郊区降温更快。"],
    ["复述参考摘要", heat, "EXPRESS", "可以这样写：城市热岛效应指城区气温明显高于郊区的现象。"],
  ] as const)("%s", (_name, p, step, text) => {
    expect(checkTutorOutput(text, p, step).leaked).toBe(true);
  });
});

describe("应放行", () => {
  it.each([
    [heat, "RECALL", "先别急。文章一共讲了几个原因？想想第 2 段和地面有什么关系。"],
    [video, "ANALYZE", "看看第 4 段开头的“有人举例说”，作者是在支持这个例子，还是在评价它？"],
    [nap, "ANALYZE", "回到第 3 段找两个数字，自己算一算差了多少，再和摘要比较。"],
    [heat, "EXPRESS", "先用一句话说出全文最想告诉读者的事，再想想有哪两三个原因支撑它。"],
  ] as const)("%s", (p, step, text) => {
    expect(checkTutorOutput(text, p, step).leaked).toBe(false);
  });
});

describe("角色路由", () => {
  it("回忆步骤一律由回忆教练负责", () => {
    expect(roleForStep(video, "RECALL")).toBe("RECALL_COACH");
  });
  it("核查课的结构分析由核查陪练负责", () => {
    expect(roleForStep(nap, "ANALYZE")).toBe("VERIFY");
  });
  it("议论文分析与表达由论证对练负责", () => {
    expect(roleForStep(video, "ANALYZE")).toBe("DEBATE");
    expect(roleForStep(video, "EXPRESS")).toBe("DEBATE");
  });
  it("提示词包含铁律和当前步骤", () => {
    const s = tutorSystemPrompt(heat, "RECALL");
    expect(s).toContain("给提示，不给答案");
    expect(s).toContain("第 3 步「合书回忆」");
    expect(s).toContain("绝对不要复述或引用原文");
  });
});
