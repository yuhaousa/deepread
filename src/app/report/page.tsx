import { notFound } from "next/navigation";
import { pageUser } from "@/server/pages";
import { studentReport } from "@/server/reports";
import { ReportView } from "./report-view";

export const dynamic = "force-dynamic";

export default async function MyReport() {
  const user = await pageUser("STUDENT");
  const r = await studentReport(user.id);
  if (!r) notFound();
  return (
    <>
      <div className="eyebrow">我的学习报告</div>
      <ReportView r={r} />
    </>
  );
}
