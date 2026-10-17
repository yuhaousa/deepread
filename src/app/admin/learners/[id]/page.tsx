import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { STEP_LABEL, type StepKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import { ReportView } from "@/app/report/report-view";
import { pct } from "@/server/admin/metrics";
import { learnerSessions } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";
import { studentReport } from "@/server/reports";

export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" });
const cell = (v: number | null) => (v === null ? "—" : `${pct(v)}%`);
const mmss = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "—");

export default async function AdminLearner({ params }: { params: Promise<{ id: string }> }) {
  await pageUser("ADMIN");
  const { id } = await params;
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, id),
    columns: { id: true, username: true, role: true, guardianConsentAt: true, createdAt: true },
    with: { classroom: { columns: { name: true } } },
  });
  if (!user || user.role !== "STUDENT") notFound();
  const [r, history] = await Promise.all([studentReport(id), learnerSessions(id)]);
  if (!r) notFound();

  return (
    <div className="admin">
      <Link href="/admin/learners" className="note">← 返回学情表现</Link>
      <div className="eyebrow" style={{ marginTop: 10 }}>学生报告</div>
      <p className="note" style={{ marginTop: 4 }}>
        账号 <code>{user.username}</code> · {user.classroom?.name ?? "未分班"} · 监护人{user.guardianConsentAt ? "已同意" : "未同意"} AI 对话 ·{" "}
        <Link href={`/admin/users?q=${encodeURIComponent(user.username)}`}>编辑账号</Link>
      </p>
      <ReportView r={r} parentTip={false} />

      <section className="sec">
        <h2 style={{ fontSize: 19 }}>训练记录{history.length ? ` · 最近 ${history.length} 节` : ""}</h2>
        {history.length ? (
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
                    <td>{cell(s.recall)}</td>
                    <td>{cell(s.analysis)}</td>
                    <td>{cell(s.express)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">这名学生还没有开始训练。</p>
        )}
      </section>
    </div>
  );
}
