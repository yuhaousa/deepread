// 个人能力报告视图（学生本人与教师共用）。行为化描述 + 作品证据，不出总分、不排名。
import type { StudentReport } from "@/server/reports";

const fmt = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Singapore" }) : "");

export function ReportView({ r, parentTip = true }: { r: StudentReport; parentTip?: boolean }) {
  return (
    <>
      <h2 style={{ fontSize: 24, marginTop: 6 }}>
        {r.student.displayName} · {r.student.grade} · 已完成 {r.completed} 节训练
      </h2>

      <div className="grid g2" style={{ marginTop: 22, alignItems: "start" }}>
        <div className="card">
          <h3>六项能力 · 当前等级与近四周</h3>
          <p className="note" style={{ marginBottom: 6 }}>柱高为该周任务平均达标率；绿色柱为本周；空白表示该周没有相关任务</p>
          {r.abilities.map((a) => {
            const last = [...a.weeks].reverse().find((w) => w !== null) ?? null;
            const first = a.weeks.find((w) => w !== null) ?? null;
            return (
              <div className="skill" key={a.ability}>
                <div className="nm">
                  {a.name} <span className="lvl on">{a.level}</span>
                  <small>{a.descriptor}</small>
                </div>
                <div className="weeks" aria-label={`${a.name} 近四周 ${a.weeks.map((w) => (w === null ? "无" : `${w}%`)).join("、")}`}>
                  {a.weeks.map((w, i) => (
                    <i key={i} style={{ height: `${w ?? 0}%`, opacity: w === null ? 0 : 1 }} />
                  ))}
                </div>
                <div className={`v${last !== null && first !== null && last - first >= 10 ? " up" : ""}`}>{last === null ? "—" : `${last}%`}</div>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gap: 14 }}>
          <div className="card">
            <h3>信心与实际表现</h3>
            <p className="note">读完后先自评“读懂了多少”，再与回忆覆盖率比较</p>
            {r.calibration.length ? (
              <div className="calib" style={{ marginTop: 10 }}>
                <div className="r note"><span /><span>自评读懂</span><span>实际回忆覆盖</span></div>
                {r.calibration.map((c) => (
                  <div className="r" key={c.genre}>
                    <span>{c.genre}</span>
                    <div className="t"><i style={{ width: `${c.self}%`, background: "var(--gold)" }} /></div>
                    <div className="t"><i style={{ width: `${c.actual}%`, background: "var(--bamboo)" }} /></div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ marginTop: 8 }}>完成第一节训练后显示。</p>
            )}
          </div>
          <div className="card">
            <h3>下一级目标</h3>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, color: "var(--ink-2)" }}>
              {r.abilities.filter((a) => a.nextDescriptor).slice(0, 3).map((a) => (
                <li key={a.ability}>{a.name}：{a.nextDescriptor}</li>
              ))}
            </ul>
          </div>
          {parentTip && (
            <div className="card">
              <h3>给家长的一个陪练问题</h3>
              <p>晚饭时问孩子：“今天读的那篇文章，作者最想让读者相信什么？他拿出了什么证据？”听孩子讲完，不纠正，只追问一句“还有别的可能吗？”</p>
            </div>
          )}
        </div>
      </div>

      {r.works.length > 0 && (
        <div className="sec">
          <h2 style={{ fontSize: 19 }}>作品对比：摘要</h2>
          <div className="works">
            {r.works.map((w, i) => (
              <div className="card" key={i}>
                <span className={`tag${i === r.works.length - 1 && r.works.length > 1 ? " g" : ""}`}>
                  {fmt(w.date)} · 《{w.title}》{w.rubric !== null ? ` · 量表 ${w.rubric} / 6` : ""}
                </span>
                <p style={{ marginTop: 8 }}>{w.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sec">
        <h2 style={{ fontSize: 19 }}>复习计划</h2>
        {r.upcomingReviews.length ? (
          <div className="review">
            {r.upcomingReviews.map((u, i) => (
              <span key={i} className={`tag${i === 0 ? " o" : ""}`}>
                {fmt(u.dueAt)} · 《{u.title}》{u.intervalD === 7 ? "混合回忆" : "再提取"}
              </span>
            ))}
          </div>
        ) : (
          <p className="note">暂无待复习内容。</p>
        )}
      </div>
    </>
  );
}
