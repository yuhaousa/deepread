import { describe, expect, it, vi } from "vitest";
import { buildInsights } from "@/server/insights";
import { callLlm, resolveRoute } from "@/server/llm/router";

describe("模型路由", () => {
  const base = { LLM_QUICK_PROVIDER: "anthropic", LLM_QUICK_MODEL: "m", ANTHROPIC_API_KEY: "k" } as unknown as NodeJS.ProcessEnv;

  it("海外区可用 Anthropic", () => {
    expect(resolveRoute("quick", { ...base, DEPLOY_REGION: "intl" })).toMatchObject({ provider: "anthropic", model: "m" });
  });
  it("中国区拒绝境外模型（数据驻留）", () => {
    expect(resolveRoute("quick", { ...base, DEPLOY_REGION: "cn" })).toHaveProperty("error");
  });
  it("中国区可用 DeepSeek", () => {
    const env = { DEPLOY_REGION: "cn", LLM_DEEP_PROVIDER: "deepseek", LLM_DEEP_MODEL: "deepseek-chat", DEEPSEEK_API_KEY: "k" } as unknown as NodeJS.ProcessEnv;
    expect(resolveRoute("deep", env)).toMatchObject({ provider: "deepseek" });
  });
  it("缺少 Key 时不路由", () => {
    expect(resolveRoute("quick", { LLM_QUICK_PROVIDER: "openai", LLM_QUICK_MODEL: "x" } as unknown as NodeJS.ProcessEnv)).toHaveProperty("error");
  });
  it("未配置模型时 callLlm 返回 null，由调用方降级", async () => {
    vi.stubEnv("LLM_QUICK_PROVIDER", "none");
    const fetchSpy = vi.fn();
    expect(await callLlm({ purpose: "TUTOR", tier: "quick", messages: [{ role: "user", content: "hi" }] }, fetchSpy as unknown as typeof fetch)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
  it("上游报错时返回 null", async () => {
    vi.stubEnv("LLM_QUICK_PROVIDER", "anthropic");
    vi.stubEnv("LLM_QUICK_MODEL", "m");
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubEnv("DEPLOY_REGION", "intl");
    const fetchStub = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    expect(await callLlm({ purpose: "TUTOR", tier: "quick", messages: [{ role: "user", content: "hi" }] }, fetchStub as unknown as typeof fetch)).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("班级洞察", () => {
  const students = [1, 2, 3, 4].map((i) => ({ id: `s${i}`, name: `学生${i}` }));
  const row = (id: string, recall: number, analysis: number, wrong: string[] = []) => ({
    studentId: id,
    completed: true,
    readingSeconds: 120,
    charCount: 500,
    recallCoverage: recall,
    analysisScore: analysis,
    analysisItems: wrong.map((label) => ({ label, correct: false, given: 0, expected: 1 })),
    missedKeyPoints: [],
    minutes: 20,
  });

  it("共性错误按比例排序，分组互斥", () => {
    const ins = buildInsights(
      students,
      [row("s1", 0.3, 0.9, ["表哥例子"]), row("s2", 0.8, 0.4, ["表哥例子", "让步段"]), row("s3", 0.9, 0.9)],
      {},
    );
    expect(ins.completed).toBe(3);
    expect(ins.commonErrors[0]).toMatchObject({ label: "表哥例子", rate: 2 / 3 });
    expect(ins.groups.map((g) => g.students.map((s) => s.id))).toEqual([["s1"], ["s2"], ["s3"]]);
    expect(ins.suggestion).toContain("表哥例子");
  });

  it("连续两次回忆 < 30% 进入关注名单，速度过快时注明", () => {
    const ins = buildInsights(students, [], { s4: [0.2, 0.1, 0.9], s1: [0.2, 0.5] }, { s4: [1200, 300] });
    expect(ins.attention).toHaveLength(1);
    expect(ins.attention[0].reason).toContain("偏快");
  });
});
