import Link from "next/link";
import { ABILITIES, ABILITY_META } from "@/lib/domain";
import { LEARNER_SORT_KEYS, pct, sortLearners, type LearnerSortKey } from "@/server/admin/metrics";
import { adminOptions, learnerPerformance } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Singapore" }) : "—");
const cellPct = (v: number | null) => (v === null ? "—" : `${pct(v)}%`);

const COLUMNS: { key: LearnerSortKey; label: string }[] = [
  { key: "name", label: "学生" },
  { key: "completed", label: "已完成" },
  { key: "lastActive", label: "最近训练" },
  { key: "avgRecall", label: "回忆覆盖" },
  { key: "avgAnalysis", label: "结构分析" },
  { key: "avgExpress", label: "摘要量表" },
];

type SP = { q?: string; c?: string; sort?: string; dir?: string; flag?: string };

export default async function AdminLearners({ searchParams }: { searchParams: Promise<SP> }) {
  await pageUser("ADMIN");
  const sp = await searchParams;
  const sort = LEARNER_SORT_KEYS.find((k) => k === sp.sort) ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const [all, options] = await Promise.all([learnerPerformance({ classroomId: sp.c || undefined, q: sp.q }), adminOptions()]);
  const rows = sortLearners(sp.flag ? all.filter((r) => r.flags.length) : all, sort, dir);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const exportQs = new URLSearchParams({ ...(sp.c ? { classroomId: sp.c } : {}), ...(sp.q ? { q: sp.q } : {}) }).toString();

  return (
    <div className="admin">
      <div className="eyebrow">管理后台</div>
      <h2 className="admin-h">学情表现</h2>
      <p className="lede">按学生汇总已完成训练的平均表现与当前等级。点击表头排序，点击姓名查看完整报告。</p>

      <form className="toolbar" method="get">
        <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="搜索账号或姓名" aria-label="搜索账号或姓名" />
        <select name="c" defaultValue={sp.c ?? ""} aria-label="班级">
          <option value="">全部班级</option>
          {options.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" name="flag" value="1" defaultChecked={!!sp.flag} />只看有预警的学生</label>
        {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
        {sp.dir && <input type="hidden" name="dir" value={sp.dir} />}
        <button className="btn ghost">筛选</button>
        <a className="btn ghost sp" href={`/api/admin/learners/export${exportQs ? `?${exportQs}` : ""}`}>导出 CSV</a>
      </form>

      <p className="note" style={{ marginTop: 8 }}>
        共 {rows.length} 名学生 · 回忆覆盖、结构分析、摘要量表为已完成训练的平均达标率；等级默认 L2。
      </p>

      <div className="tablewrap" style={{ marginTop: 8 }}>
        <table className="admin-table num">
          <thead>
            <tr>
              {COLUMNS.slice(0, 1).map((c) => <SortTh key={c.key} c={c} sort={sort} dir={dir} qs={qs} />)}
              <th>班级</th>
              {COLUMNS.slice(1).map((c) => <SortTh key={c.key} c={c} sort={sort} dir={dir} qs={qs} />)}
              <th>能力等级</th>
              <th>待复习</th>
              <th>预警</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/learners/${r.id}`}>{r.name}</Link><div className="note"><code>{r.username}</code></div></td>
                <td>{r.classroomName ?? "未分班"}</td>
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
            {!rows.length && <tr><td colSpan={10} className="note">没有符合条件的学生。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortTh({ c, sort, dir, qs }: { c: { key: LearnerSortKey; label: string }; sort: LearnerSortKey; dir: "asc" | "desc"; qs: (p: Partial<SP>) => string }) {
  const on = sort === c.key;
  const next = on && dir === "asc" ? "desc" : "asc";
  return (
    <th aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={qs({ sort: c.key, dir: next })} className="sort">
        {c.label}
        <span aria-hidden>{on ? (dir === "asc" ? " ↑" : " ↓") : ""}</span>
      </Link>
    </th>
  );
}
