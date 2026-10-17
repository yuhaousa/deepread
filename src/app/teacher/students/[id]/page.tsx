import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionHistory } from "@/app/learner-table";
import { ReportView } from "@/app/report/report-view";
import { learnerSessions } from "@/server/learner/performance";
import { canViewStudent } from "@/server/access";
import { pageUser } from "@/server/pages";
import { studentReport } from "@/server/reports";

export const dynamic = "force-dynamic";

export default async function StudentForTeacher({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("TEACHER", "ADMIN");
  const { id } = await params;
  if (!(await canViewStudent(user, id))) notFound();
  const [r, history] = await Promise.all([studentReport(id), learnerSessions(id)]);
  if (!r) notFound();
  return (
    <>
      <Link href={r.classroomId ? `/teacher?c=${r.classroomId}#students` : "/teacher"} className="note">← 返回班级</Link>
      <div className="eyebrow" style={{ marginTop: 10 }}>学生报告</div>
      <ReportView r={r} parentTip={false} />
      <section className="sec">
        <h2 style={{ fontSize: 19 }}>训练记录{history.length ? ` · 最近 ${history.length} 节` : ""}</h2>
        <SessionHistory history={history} />
      </section>
    </>
  );
}
