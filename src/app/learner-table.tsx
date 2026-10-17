// 学情表格与训练记录：管理后台与教师端共用。
import Link from "next/link";
import { ABILITIES, ABILITY_META, STEP_LABEL, type StepKey } from "@/lib/domain";
import { pct, type LearnerRow, type LearnerSortKey } from "@/server/admin/metrics";
import type { learnerSessions } from "@/server/learner/performance";

const day = (d: Date | null) => (d ? d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Singapore" }) : "—");
const when = (d: Date) => d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" });
const cellPct = (v: number | null) => (v === null ? "—" : `${pct(v)}%`);
const mmss = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

const COLUMNS: { key: LearnerSortKey; label: string }[] = [
  { key: "name", label: "学生" },
  { key: "completed", label: "已完成" },
  { key: "lastActive", label: "最近训练" },
  { key: "avgRecall", label: "回忆覆盖" },
  { key: "avgAnalysis", label: "结构分析" },
  { key: "avgExpress", label: "摘要量表" },
];

export interface SortState {
  sort: LearnerSortKey;
  dir: "asc" | "desc";
  /** 生成点击表头后的链接 */
  href: (sort: LearnerSortKey, dir: "asc" | "desc") => string;
}

export function LearnerTable({ rows, linkFor, sort, showClass = true }: { rows: LearnerRow[]; linkFor: (id: string) => string; sort?: SortState; showClass?: boolean }) {
  const th = (c: (typeof COLUMNS)[number]) => {
    if (!sort) return <th key={c.key}>{c.label}</th>;
    const on = sort.sort === c.key;
    return (
      <th key={c.key} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <Link href={sort.href(c.key, on && sort.dir === "asc" ? "desc" : "asc")} className="sort">
          {c.label}
          <span aria-hidden>{on ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}</span>
        </Link>
      </th>
    );
  };
  const cols = 9 + (showClass ? 1 : 0);

  return (
    <div className="tablewrap">
      <table className="admin-table num">
        <thead>
          <tr>
            {th(COLUMNS[0])}
            {showClass && <th>班级</th>}
            {COLUMNS.slice(1).map(th)}
            <th>能力等级</th>
            <th>待复习</th>
            <th>预警</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <Link href={linkFor(r.id)}>{r.name}</Link>
                <div className="note"><code>{r.username}</code></div>
              </td>
              {showClass && <td>{r.classroomName ?? "未分班"}</td>}
              <td>{r.completed}{r.inProgress ? <span className="note"> +{r.inProgress} 进行中</span> : null}</td>
              <td>{day(r.lastActive)}</td>
              <td>{cellPct(r.avgRecall)}</td>
              <td>{cellPct(r.avgAnalysis)}</td>
              <td>{cellPct(r.avgExpress)}</td>
              <td>
                <div className="lvl-row">
                  {ABILITIES.map((a) => (
                    <span key={a} className="lvl" title={`${ABILITY_META[a].name} ${r.levels[a]}`}>
                      {ABILITY_META[a].name}<b>{r.levels[a].slice(1)}</b>
                    </span>
                  ))}
                </div>
              </td>
              <td>{r.dueReviews || "—"}</td>
              <td>{r.flags.length ? <ul className="flags">{r.flags.map((f) => <li key={f}>{f}</li>)}</ul> : <span className="note">—</span>}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={cols} className="note">没有符合条件的学生。</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function SessionHistory({ history }: { history: Awaited<ReturnType<typeof learnerSessions>> }) {
  if (!history.length) return <p className="empty">这名学生还没有开始训练。</p>;
  return (
    <div className="tablewrap">
      <table className="admin-table num">
        <thead>
          <tr><th>材料</th><th>开始</th><th>状态</th><th>阅读用时</th><th>回看</th><th>回忆覆盖</th><th>结构分析</th><th>摘要量表</th></tr>
        </thead>
        <tbody>
          {history.map((s) => (
            <tr key={s.id}>
              <td><span className="lvl">{s.level}</span> {s.title}</td>
              <td>{when(s.startedAt)}</td>
              <td>{s.completedAt ? "已完成" : `进行中 · ${STEP_LABEL[s.step as StepKey] ?? s.step}`}{s.flagged && <span className="tag o" style={{ marginLeft: 6 }}>待抽检</span>}</td>
              <td>{mmss(s.readingSeconds)}</td>
              <td>{s.lookbacks}</td>
              <td>{cellPct(s.recall)}</td>
              <td>{cellPct(s.analysis)}</td>
              <td>{cellPct(s.express)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
