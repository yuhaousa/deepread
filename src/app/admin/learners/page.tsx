import { LearnerTable } from "@/app/learner-table";
import { LEARNER_SORT_KEYS, sortLearners } from "@/server/admin/metrics";
import { adminOptions, learnerPerformance } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";

export const dynamic = "force-dynamic";

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

      <div style={{ marginTop: 8 }}>
        <LearnerTable rows={rows} linkFor={(id) => `/admin/learners/${id}`} sort={{ sort, dir, href: (k, d) => qs({ sort: k, dir: d }) }} />
      </div>
    </div>
  );
}
