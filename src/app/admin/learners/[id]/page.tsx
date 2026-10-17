import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { SessionHistory } from "@/app/learner-table";
import { ReportView } from "@/app/report/report-view";
import { learnerSessions } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";
import { studentReport } from "@/server/reports";

export const dynamic = "force-dynamic";

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
        <SessionHistory history={history} />
      </section>
    </div>
  );
}
