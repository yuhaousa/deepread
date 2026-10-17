// 管理后台 · 纯函数：学情行、预警标记、按日序列、等级分布、AI 调用汇总、CSV。
// 数据库查询在 queries.ts，这里只做计算，便于测试。

import { ABILITIES, LEVELS, type AbilityKey, type LevelKey } from "@/lib/domain";
import { localTimeAfter } from "@/server/learner/schedule";

const DAY = 24 * 3600_000;

export interface LearnerInput {
  id: string;
  username: string;
  name: string;
  grade: string | null;
  classroomId: string | null;
  classroomName: string | null;
  consent: boolean;
}

export interface SessionInput {
  studentId: string;
  startedAt: Date;
  completedAt: Date | null;
  recall: number | null; // 0–1
  analysis: number | null; // 0–1
  express: number | null; // 0–1（量表总分 / 6）
}

export interface MasteryInput {
  studentId: string;
  ability: AbilityKey;
  level: LevelKey;
}

export interface LearnerRow extends LearnerInput {
  completed: number;
  inProgress: number;
  lastActive: Date | null;
  avgRecall: number | null;
  avgAnalysis: number | null;
  avgExpress: number | null;
  levels: Record<AbilityKey, LevelKey>;
  dueReviews: number;
  flags: string[];
}

/** 预警阈值：与教师端“需要关注”一致 */
export const LOW_RECALL = 0.3;
export const INACTIVE_DAYS = 14;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function buildLearnerRows(
  students: LearnerInput[],
  sessions: SessionInput[],
  mastery: MasteryInput[],
  dueReviews: Record<string, number>,
  now = new Date(),
): LearnerRow[] {
  const byStudent = new Map<string, SessionInput[]>();
  for (const s of sessions) (byStudent.get(s.studentId) ?? byStudent.set(s.studentId, []).get(s.studentId)!).push(s);

  return students.map((st) => {
    const mine = byStudent.get(st.id) ?? [];
    // 已完成的训练，新 → 旧
    const done = mine.filter((s) => s.completedAt).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
    const lastActive = mine.reduce<Date | null>((latest, s) => {
      const t = s.completedAt ?? s.startedAt;
      return !latest || t > latest ? t : latest;
    }, null);

    const levels = Object.fromEntries(ABILITIES.map((a) => [a, "L2"])) as Record<AbilityKey, LevelKey>;
    for (const m of mastery) if (m.studentId === st.id) levels[m.ability] = m.level;

    const recalls = done.map((s) => s.recall).filter((v): v is number => v !== null);
    const flags: string[] = [];
    if (recalls.length >= 2 && recalls[0] < LOW_RECALL && recalls[1] < LOW_RECALL) flags.push("回忆覆盖率连续两次低于 30%");
    if (!lastActive) flags.push("还没有开始训练");
    else if (now.getTime() - lastActive.getTime() > INACTIVE_DAYS * DAY) flags.push(`超过 ${INACTIVE_DAYS} 天没有训练`);
    if (!st.consent) flags.push("监护人尚未同意 AI 对话");

    return {
      ...st,
      completed: done.length,
      inProgress: mine.length - done.length,
      lastActive,
      avgRecall: mean(recalls),
      avgAnalysis: mean(done.map((s) => s.analysis).filter((v): v is number => v !== null)),
      avgExpress: mean(done.map((s) => s.express).filter((v): v is number => v !== null)),
      levels,
      dueReviews: dueReviews[st.id] ?? 0,
      flags,
    };
  });
}

export type LearnerSortKey = "name" | "completed" | "lastActive" | "avgRecall" | "avgAnalysis" | "avgExpress";
export const LEARNER_SORT_KEYS: LearnerSortKey[] = ["name", "completed", "lastActive", "avgRecall", "avgAnalysis", "avgExpress"];

/** 排序；空值始终排在最后 */
export function sortLearners(rows: LearnerRow[], key: LearnerSortKey, dir: "asc" | "desc"): LearnerRow[] {
  const val = (r: LearnerRow) => (key === "lastActive" ? (r.lastActive?.getTime() ?? null) : r[key]);
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    if (typeof x === "string" && typeof y === "string") return sign * x.localeCompare(y, "zh-CN");
    return sign * ((x as number) - (y as number));
  });
}

/** 近 days 天（含今天，UTC+8 自然日）每天的事件数，旧 → 新 */
export function dailySeries(times: Date[], days: number, now = new Date()): { day: string; date: Date; n: number }[] {
  const starts = Array.from({ length: days }, (_, i) => localTimeAfter(now, i - days + 1, 0, 0));
  const out = starts.map((date) => {
    const local = new Date(date.getTime() + 8 * 3600_000);
    return { day: `${local.getUTCMonth() + 1}/${local.getUTCDate()}`, date, n: 0 };
  });
  // UTC+8 没有夏令时，自然日之间正好相隔 24 小时
  for (const t of times) {
    const i = Math.floor((t.getTime() - starts[0].getTime()) / DAY);
    if (i >= 0 && i < days) out[i].n += 1;
  }
  return out;
}

/** 每项能力在各等级上的学生人数 */
export function levelDistribution(rows: { ability: AbilityKey; level: LevelKey; n: number }[]) {
  return ABILITIES.map((ability) => {
    const counts = Object.fromEntries(LEVELS.map((l) => [l, 0])) as Record<LevelKey, number>;
    for (const r of rows) if (r.ability === ability) counts[r.level] += r.n;
    return { ability, counts, total: LEVELS.reduce((s, l) => s + counts[l], 0) };
  });
}

export interface CallRow {
  purpose: string;
  calls: number;
  failures: number;
  avgLatencyMs: number | null;
  tokens: number;
}

export function aiSummary(rows: CallRow[]) {
  const calls = rows.reduce((s, r) => s + r.calls, 0);
  const failures = rows.reduce((s, r) => s + r.failures, 0);
  const weighted = rows.reduce((s, r) => s + (r.avgLatencyMs ?? 0) * r.calls, 0);
  return {
    calls,
    failures,
    failRate: calls ? failures / calls : null,
    avgLatencyMs: calls ? Math.round(weighted / calls) : null,
    tokens: rows.reduce((s, r) => s + r.tokens, 0),
    byPurpose: rows,
  };
}

/** CSV（带 BOM，Excel 可直接打开中文）。以 = + - @ 开头的单元格加单引号，防止公式注入。 */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export const pct = (v: number | null) => (v === null ? null : Math.round(v * 100));
