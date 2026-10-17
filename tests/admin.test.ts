// 管理后台：学情行与预警、排序、按日序列、等级分布、AI 汇总、CSV、请求体校验、角色首页。
import { describe, expect, it } from "vitest";
import { homeFor } from "@/lib/home";
import {
  aiSummary,
  buildLearnerRows,
  dailySeries,
  levelDistribution,
  sortLearners,
  toCsv,
  type LearnerInput,
  type SessionInput,
} from "@/server/admin/metrics";
import { CreateUser, UpdateUser } from "@/server/admin/schemas";
import { hashPassword, verifyPassword } from "@/server/password";

const NOW = new Date("2026-10-17T04:00:00Z"); // UTC+8 12:00
const DAY = 24 * 3600_000;
const ago = (d: number) => new Date(NOW.getTime() - d * DAY);

const student = (id: string, over: Partial<LearnerInput> = {}): LearnerInput => ({
  id,
  username: id,
  name: id,
  grade: "初二",
  classroomId: "c1",
  classroomName: "初二（3）班",
  consent: true,
  ...over,
});
const session = (studentId: string, daysAgo: number, over: Partial<SessionInput> = {}): SessionInput => ({
  studentId,
  startedAt: ago(daysAgo),
  completedAt: ago(daysAgo),
  recall: 0.6,
  analysis: 0.8,
  express: 0.5,
  ...over,
});

describe("buildLearnerRows", () => {
  it("汇总已完成训练的平均分，并计入进行中的训练", () => {
    const [r] = buildLearnerRows(
      [student("a")],
      [session("a", 3, { recall: 0.4 }), session("a", 1, { recall: 0.8, express: null }), session("a", 0, { completedAt: null, recall: null })],
      [{ studentId: "a", ability: "RECALL", level: "L3" }],
      { a: 2 },
      NOW,
    );
    expect(r.completed).toBe(2);
    expect(r.inProgress).toBe(1);
    expect(r.avgRecall).toBeCloseTo(0.6);
    expect(r.avgExpress).toBeCloseTo(0.5);
    expect(r.levels.RECALL).toBe("L3");
    expect(r.levels.FOCUS).toBe("L2");
    expect(r.dueReviews).toBe(2);
    expect(r.lastActive).toEqual(ago(0));
    expect(r.flags).toEqual([]);
  });

  it("最近两次回忆都低于 30% 时预警；较早的低分不触发", () => {
    const low = buildLearnerRows([student("a")], [session("a", 2, { recall: 0.2 }), session("a", 1, { recall: 0.1 })], [], {}, NOW)[0];
    expect(low.flags).toContain("回忆覆盖率连续两次低于 30%");
    const recovered = buildLearnerRows([student("a")], [session("a", 3, { recall: 0.2 }), session("a", 2, { recall: 0.1 }), session("a", 1, { recall: 0.7 })], [], {}, NOW)[0];
    expect(recovered.flags).not.toContain("回忆覆盖率连续两次低于 30%");
  });

  it("标出未开始、长期未训练和监护人未同意", () => {
    const rows = buildLearnerRows([student("new", { consent: false }), student("idle")], [session("idle", 20)], [], {}, NOW);
    expect(rows[0].flags).toEqual(["还没有开始训练", "监护人尚未同意 AI 对话"]);
    expect(rows[1].flags).toEqual(["超过 14 天没有训练"]);
  });
});

describe("sortLearners", () => {
  const rows = buildLearnerRows([student("b"), student("a"), student("c")], [session("a", 1, { recall: 0.9 }), session("b", 1, { recall: 0.3 })], [], {}, NOW);

  it("按数值排序，空值始终在最后", () => {
    expect(sortLearners(rows, "avgRecall", "asc").map((r) => r.id)).toEqual(["b", "a", "c"]);
    expect(sortLearners(rows, "avgRecall", "desc").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("按姓名排序", () => {
    expect(sortLearners(rows, "name", "asc").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});

describe("dailySeries", () => {
  it("按 UTC+8 自然日分桶，窗口外的事件忽略", () => {
    const s = dailySeries(
      [
        new Date("2026-10-17T00:30:00Z"), // 10/17 08:30 本地
        new Date("2026-10-16T17:00:00Z"), // 10/17 01:00 本地
        new Date("2026-10-16T15:00:00Z"), // 10/16 23:00 本地
        new Date("2026-10-01T00:00:00Z"), // 窗口外
      ],
      3,
      NOW,
    );
    expect(s.map((x) => x.day)).toEqual(["10/15", "10/16", "10/17"]);
    expect(s.map((x) => x.n)).toEqual([0, 1, 2]);
  });
});

it("levelDistribution 为每项能力补齐五个等级", () => {
  const d = levelDistribution([
    { ability: "RECALL", level: "L2", n: 5 },
    { ability: "RECALL", level: "L3", n: 2 },
  ]);
  expect(d).toHaveLength(6);
  const recall = d.find((x) => x.ability === "RECALL")!;
  expect(recall.counts).toEqual({ L1: 0, L2: 5, L3: 2, L4: 0, L5: 0 });
  expect(recall.total).toBe(7);
  expect(d.find((x) => x.ability === "FOCUS")!.total).toBe(0);
});

it("aiSummary 按调用次数加权平均延迟", () => {
  const s = aiSummary([
    { purpose: "TUTOR", calls: 3, failures: 1, avgLatencyMs: 100, tokens: 300 },
    { purpose: "RUBRIC", calls: 1, failures: 0, avgLatencyMs: 500, tokens: 700 },
  ]);
  expect(s).toMatchObject({ calls: 4, failures: 1, failRate: 0.25, avgLatencyMs: 200, tokens: 1000 });
  expect(aiSummary([])).toMatchObject({ calls: 0, failRate: null, avgLatencyMs: null });
});

describe("toCsv", () => {
  it("带 BOM，转义引号、逗号和换行", () => {
    expect(toCsv([["姓名", "备注"], ["林同学", '说"好",再见\n']])).toBe('﻿姓名,备注\r\n林同学,"说""好"",再见\n"\r\n');
  });

  it("以公式字符开头的文本加单引号，数字和空值不受影响", () => {
    expect(toCsv([["=HYPERLINK(1)", "+1", "-x", "@a", -3, null]])).toBe("﻿'=HYPERLINK(1),'+1,'-x,'@a,-3,\r\n");
  });
});

describe("请求体校验", () => {
  it("账号格式与密码长度", () => {
    expect(CreateUser.safeParse({ username: "s2409", displayName: "新同学", role: "STUDENT", password: "Bamboo123" }).success).toBe(true);
    expect(CreateUser.safeParse({ username: "有空格 的账号", displayName: "x", role: "STUDENT", password: "Bamboo123" }).success).toBe(false);
    expect(CreateUser.safeParse({ username: "s2409", displayName: "x", role: "STUDENT", password: "short" }).success).toBe(false);
    expect(CreateUser.safeParse({ username: "s2409", displayName: "x", role: "ROOT", password: "Bamboo123" }).success).toBe(false);
  });

  it("修改时所有字段可选，但给出的密码仍需满足长度", () => {
    expect(UpdateUser.safeParse({}).success).toBe(true);
    expect(UpdateUser.safeParse({ password: "1234" }).success).toBe(false);
  });
});

it("homeFor 按角色返回首页", () => {
  expect(homeFor("STUDENT")).toBe("/");
  expect(homeFor("ADMIN")).toBe("/admin");
  expect(homeFor("TEACHER")).toBe("/teacher");
  expect(homeFor("PARENT")).toBe("/teacher");
});

describe("密码哈希（PBKDF2）", () => {
  it("同一密码每次加盐不同，且都能验证通过", async () => {
    const a = await hashPassword("Bamboo123");
    const b = await hashPassword("Bamboo123");
    expect(a).toMatch(/^pbkdf2\$100000\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("Bamboo123", a)).toBe(true);
    expect(await verifyPassword("bamboo123", a)).toBe(false);
  });

  it("格式不对或迭代次数超限的哈希一律拒绝", async () => {
    expect(await verifyPassword("x", "$2a$10$bcrypt-style")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$999999999$AAAA$AAAA")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });
});
