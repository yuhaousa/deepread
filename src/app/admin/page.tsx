import Link from "next/link";
import { ABILITY_META, LEVELS, LEVEL_META } from "@/lib/domain";
import { pct } from "@/server/admin/metrics";
import { dashboardData } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";

export const dynamic = "force-dynamic";

const PURPOSE_LABEL: Record<string, string> = { RECALL: "回忆判定", RUBRIC: "摘要量表", TUTOR: "导师对话", GUARDRAIL: "护栏" };
const n = (v: number) => v.toLocaleString("zh-CN");

export default async function AdminDashboard() {
  await pageUser("ADMIN");
  const d = await dashboardData();
  const peak = Math.max(0, ...d.daily.map((x) => x.n));
  const maxDaily = Math.max(1, peak);
  const totalDaily = d.daily.reduce((s, x) => s + x.n, 0);

  return (
    <div className="admin">
      <div className="eyebrow">管理后台</div>
      <h2 className="admin-h">平台总览</h2>

      <div className="kpis">
        <div className="kpi">
          <span>学生</span>
          <b>{n(d.users.students)}</b>
          <small>教师 {d.users.teachers} · 管理员 {d.users.admins}{d.users.others ? ` · 其他 ${d.users.others}` : ""}</small>
        </div>
        <div className="kpi">
          <span>近 7 天活跃学生</span>
          <b>{n(d.activeStudents7)}</b>
          <small>{d.users.students ? `占全部学生 ${Math.round((d.activeStudents7 / d.users.students) * 100)}%` : "暂无学生"}</small>
        </div>
        <div className="kpi">
          <span>近 7 天完成训练</span>
          <b>{n(d.completed7)}</b>
          <small>开始 {d.started7} 节 · 完成率 {d.completionRate7 === null ? "—" : `${pct(d.completionRate7)}%`}</small>
        </div>
        <div className="kpi">
          <span>需要关注</span>
          <b>{d.attention.length}</b>
          <small>回忆连续偏低 · {d.inactive} 人长期未训练</small>
        </div>
        <div className="kpi">
          <span>待教师抽检</span>
          <b>{d.flaggedResponses}</b>
          <small>AI 量表低置信度的作答</small>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 18, alignItems: "start" }}>
        <section className="card chart">
          <h3>每日完成训练 · 近 14 天</h3>
          <p className="note">共 {totalDaily} 节，单日最多 {peak} 节（UTC+8）</p>
          <div className="vbars" role="img" aria-label={`近 14 天每日完成训练：${d.daily.map((x) => `${x.day} ${x.n} 节`).join("，")}`}>
            {d.daily.map((x) => (
              <div className="col" key={x.day} tabIndex={0} data-tip={`${x.day} · ${x.n} 节`}>
                <i style={{ height: `${(x.n / maxDaily) * 100}%` }} className={x.n ? "" : "zero"} />
              </div>
            ))}
          </div>
          <div className="vbars-x" aria-hidden>
            {d.daily.map((x, i) => (
              <span key={x.day}>{i % 2 === 1 || i === d.daily.length - 1 ? x.day : ""}</span>
            ))}
          </div>
          <details className="tview">
            <summary>查看数据表</summary>
            <table>
              <thead><tr><th>日期</th><th>完成训练</th></tr></thead>
              <tbody>{d.daily.map((x) => <tr key={x.day}><td>{x.day}</td><td>{x.n}</td></tr>)}</tbody>
            </table>
          </details>
        </section>

        <section className="card chart">
          <h3>六项能力 · 近 28 天平均达标率</h3>
          <p className="note">每次训练结算时，各项能力任务的达标率平均值</p>
          {d.abilityAvg.length ? (
            <div className="hbars">
              {Object.entries(ABILITY_META).map(([key, meta]) => {
                const a = d.abilityAvg.find((x) => x.ability === key);
                const v = a ? pct(a.avg)! : null;
                return (
                  <div className="hrow" key={key}>
                    <span className="nm">{meta.name}</span>
                    <div className="track" tabIndex={0} data-tip={v === null ? `${meta.name} · 暂无数据` : `${meta.name} · ${v}%（${a!.n} 次）`}>
                      {v !== null && <i style={{ width: `${v}%` }} />}
                    </div>
                    <span className="v">{v === null ? "—" : `${v}%`}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">近 28 天还没有完成的训练。</p>
          )}
        </section>
      </div>

      <section className="card chart" style={{ marginTop: 14 }}>
        <h3>能力等级分布</h3>
        <p className="note">每项能力上处于各等级的学生人数</p>
        <div className="legend" aria-hidden>
          {LEVELS.map((l, i) => (
            <span key={l}><i className={`lv${i + 1}`} />{l} {LEVEL_META[l].name}</span>
          ))}
        </div>
        <div className="stacks">
          {d.levels.map((row) => (
            <div className="hrow" key={row.ability}>
              <span className="nm">{ABILITY_META[row.ability].name}</span>
              <div className="stack" role="img" aria-label={`${ABILITY_META[row.ability].name}：${LEVELS.map((l) => `${l} ${row.counts[l]} 人`).join("，")}`}>
                {row.total === 0 ? (
                  <span className="note">暂无</span>
                ) : (
                  LEVELS.filter((l) => row.counts[l]).map((l) => (
                    <i
                      key={l}
                      tabIndex={0}
                      className={`lv${LEVELS.indexOf(l) + 1}`}
                      style={{ flexGrow: row.counts[l] }}
                      data-tip={`${ABILITY_META[row.ability].name} · ${l} · ${row.counts[l]} 人（${Math.round((row.counts[l] / row.total) * 100)}%）`}
                    />
                  ))
                )}
              </div>
              <span className="v">{row.total} 人</span>
            </div>
          ))}
        </div>
        <details className="tview">
          <summary>查看数据表</summary>
          <table>
            <thead><tr><th>能力</th>{LEVELS.map((l) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {d.levels.map((row) => (
                <tr key={row.ability}><td>{ABILITY_META[row.ability].name}</td>{LEVELS.map((l) => <td key={l}>{row.counts[l]}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <div className="grid g2" style={{ marginTop: 14, alignItems: "start" }}>
        <section className="card">
          <h3>需要关注的学生</h3>
          {d.attention.length ? (
            <ul className="plain">
              {d.attention.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/learners/${l.id}`}>{l.name}</Link>
                  <span className="note">{l.classroomName ?? "未分班"} · {l.flags.filter((f) => f.startsWith("回忆")).join("；")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>暂无回忆覆盖率连续偏低的学生。</p>
          )}
          <Link className="note" href="/admin/learners?sort=avgRecall&dir=asc">查看全部学情 →</Link>
        </section>

        <section className="card">
          <h3>完成最多的材料</h3>
          {d.topPassages.length ? (
            <table className="mini">
              <thead><tr><th>材料</th><th>等级</th><th>完成</th></tr></thead>
              <tbody>
                {d.topPassages.map((p) => (
                  <tr key={p.title}><td>{p.title}</td><td><span className="lvl">{p.level}</span></td><td>{p.n}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>还没有完成的训练。</p>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <h3>AI 调用与护栏 · 近 7 天</h3>
        <div className="kpis compact">
          <div className="kpi"><span>调用次数</span><b>{n(d.ai.calls)}</b></div>
          <div className="kpi"><span>失败率</span><b>{d.ai.failRate === null ? "—" : `${pct(d.ai.failRate)}%`}</b><small>失败时自动降级为规则评分</small></div>
          <div className="kpi"><span>平均延迟</span><b>{d.ai.avgLatencyMs === null ? "—" : `${n(d.ai.avgLatencyMs)} ms`}</b></div>
          <div className="kpi"><span>Token 用量</span><b>{n(d.ai.tokens)}</b></div>
          <div className="kpi"><span>导师回复被护栏改写</span><b>{d.tutor.rewritten} / {d.tutor.replies}</b><small>复述原文或给出答案时替换为提示</small></div>
        </div>
        {d.ai.byPurpose.length > 0 ? (
          <table className="mini" style={{ marginTop: 12 }}>
            <thead><tr><th>用途</th><th>调用</th><th>失败</th><th>平均延迟</th><th>Token</th></tr></thead>
            <tbody>
              {d.ai.byPurpose.map((r) => (
                <tr key={r.purpose}>
                  <td>{PURPOSE_LABEL[r.purpose] ?? r.purpose}</td><td>{n(r.calls)}</td><td>{r.failures}</td>
                  <td>{r.avgLatencyMs === null ? "—" : `${n(r.avgLatencyMs)} ms`}</td><td>{n(r.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="note" style={{ marginTop: 10 }}>近 7 天没有模型调用。未配置模型时，评分和导师提示使用内置规则。</p>
        )}
      </section>
    </div>
  );
}
