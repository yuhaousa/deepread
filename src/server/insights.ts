// 教师端 · 班级洞察：完成情况、共性错误、分组建议、需要关注名单。纯函数，便于测试。

import type { ItemResult } from "@/server/assessment/rules";

export interface StudentRow {
  id: string;
  name: string;
}

export interface SessionRow {
  studentId: string;
  completed: boolean;
  readingSeconds: number | null;
  charCount: number;
  recallCoverage: number | null;
  analysisScore: number | null;
  analysisItems: ItemResult[];
  missedKeyPoints: string[];
  minutes: number | null;
}

export interface Insights {
  total: number;
  completed: number;
  avgMinutes: number | null;
  commonErrors: { label: string; rate: number; explanation?: string }[];
  groups: { key: "A" | "B" | "C"; title: string; action: string; students: StudentRow[] }[];
  attention: { student: StudentRow; reason: string }[];
  suggestion: string | null;
}

export function buildInsights(
  students: StudentRow[],
  sessions: SessionRow[],
  recentCoverage: Record<string, number[]>, // 每名学生最近几次回忆覆盖率（新→旧）
  recentSpeed: Record<string, number[]> = {}, // 每名学生最近几次阅读速度（字/分，新→旧）
): Insights {
  const done = sessions.filter((s) => s.completed);
  const byStudent = new Map(done.map((s) => [s.studentId, s]));

  const minutes = done.map((s) => s.minutes).filter((m): m is number => m !== null);
  const avgMinutes = minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null;

  // 共性错误：按“答错人数 / 完成人数”排序
  const errorMap = new Map<string, { wrong: number; explanation?: string }>();
  for (const s of done) {
    for (const it of s.analysisItems) {
      if (it.correct) continue;
      const e = errorMap.get(it.label) ?? { wrong: 0, explanation: it.explanation };
      e.wrong += 1;
      errorMap.set(it.label, e);
    }
    for (const kp of s.missedKeyPoints) {
      const label = `回忆遗漏：${kp}`;
      const e = errorMap.get(label) ?? { wrong: 0 };
      e.wrong += 1;
      errorMap.set(label, e);
    }
  }
  const commonErrors = done.length
    ? [...errorMap.entries()]
        .map(([label, e]) => ({ label, rate: e.wrong / done.length, explanation: e.explanation }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5)
    : [];

  const A: StudentRow[] = [];
  const B: StudentRow[] = [];
  const C: StudentRow[] = [];
  for (const st of students) {
    const s = byStudent.get(st.id);
    if (!s) continue;
    if ((s.recallCoverage ?? 0) < 0.5) A.push(st);
    else if ((s.analysisScore ?? 0) < 0.6) B.push(st);
    else C.push(st);
  }

  const attention: Insights["attention"] = [];
  for (const st of students) {
    const cov = recentCoverage[st.id] ?? [];
    const speed = recentSpeed[st.id] ?? [];
    if (cov.length >= 2 && cov[0] < 0.3 && cov[1] < 0.3) {
      const fast = speed.slice(0, 2).some((v) => v > 900);
      attention.push({
        student: st,
        reason: fast ? "回忆覆盖率连续两次低于 30%，且阅读速度明显偏快" : "回忆覆盖率连续两次低于 30%",
      });
    }
  }

  const top = commonErrors[0];
  const suggestion = top
    ? `全班 ${Math.round(top.rate * 100)}% 在“${top.label}”上出错。${top.explanation ? `讲解要点：${top.explanation}` : "建议投影原文对应段落，请学生先口头复述，再对照原文。"}`
    : null;

  return {
    total: students.length,
    completed: done.length,
    avgMinutes,
    commonErrors,
    groups: [
      { key: "A", title: "回忆与证据定位偏弱", action: "推送“合书回忆 + 证据定位”短练习 3 篇", students: A },
      { key: "B", title: "能回忆，结构 / 论证判断偏弱", action: "推送“段落作用 / 推理错误”专项练习", students: B },
      { key: "C", title: "全部达标", action: "推送高一级材料或双文本对比阅读", students: C },
    ],
    attention,
    suggestion,
  };
}
