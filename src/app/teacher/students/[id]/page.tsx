import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportView } from "@/app/report/report-view";
import { canViewStudent } from "@/server/access";
import { pageUser } from "@/server/pages";
import { studentReport } from "@/server/reports";

export const dynamic = "force-dynamic";

export default async function StudentForTeacher({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("TEACHER", "ADMIN");
  const { id } = await params;
  if (!(await canViewStudent(user, id))) notFound();
  const r = await studentReport(id);
  if (!r) notFound();
  return (
    <>
      <Link href="/teacher" className="note">← 返回班级</Link>
      <div className="eyebrow" style={{ marginTop: 10 }}>学生报告</div>
      <ReportView r={r} parentTip={false} />
    </>
  );
}
