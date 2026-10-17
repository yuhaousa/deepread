import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canManageClassroom } from "@/server/access";
import { pageUser, publishedPassages } from "@/server/pages";
import { classroomInsights } from "@/server/reports";
import { AssignForm } from "./assign-form";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Singapore" });

export default async function Teacher({ searchParams }: { searchParams: Promise<{ c?: string; a?: string }> }) {
  const user = await pageUser("TEACHER", "ADMIN");
  const { c, a } = await searchParams;
  const classes = await db.query.classrooms.findMany({
    where: user.role === "ADMIN" ? undefined : eq(schema.classrooms.teacherId, user.id),
    orderBy: asc(schema.classrooms.name),
  });
  if (!classes.length) return <div className="empty">还没有任教班级，请联系学校管理员开通。</div>;
  const classId = c && classes.some((x) => x.id === c) ? c : classes[0].id;
  if (!(await canManageClassroom(user, classId))) redirect("/teacher");

  const [data, passages] = await Promise.all([classroomInsights(classId, a), publishedPassages()]);
  if (!data) redirect("/teacher");
  const { classroom, assignment, insights } = data;

  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className="eyebrow">教师端 · {classroom.name}</div>
        {classes.length > 1 &&
          classes.map((x) => (
            <Link key={x.id} href={`/teacher?c=${x.id}`} className="tag">
              {x.name}
            </Link>
          ))}
      </div>

      {assignment ? (
        <>
          <h2 style={{ fontSize: 24, marginTop: 6 }}>任务：《{assignment.passage.title}》</h2>
          <p className="lede" style={{ marginTop: 6 }}>
            {insights.total} 人中 {insights.completed} 人完成{insights.avgMinutes !== null ? `，平均用时 ${insights.avgMinutes} 分钟` : ""}。截止 {fmt(assignment.dueAt)}。系统汇总了全班的共性错误和分组建议，老师不用逐份批改。
          </p>
          <div className="filter" style={{ marginTop: 10 }}>
            {classroom.assignments.map((x) => (
              <Link key={x.id} className="pill" aria-pressed={x.id === assignment.id} href={`/teacher?c=${classId}&a=${x.id}`}>
                {x.passage.title}
              </Link>
            ))}
          </div>

          <div className="grid g2" style={{ marginTop: 20, alignItems: "start" }}>
            <div className="card">
              <h3>共性错误（按人数比例）</h3>
              {insights.commonErrors.length ? (
                insights.commonErrors.map((e) => (
                  <div className="err" key={e.label}>
                    <div>
                      {e.label}
                      <div className="t"><i style={{ width: `${Math.round(e.rate * 100)}%` }} /></div>
                    </div>
                    <b>{Math.round(e.rate * 100)}%</b>
                  </div>
                ))
              ) : (
                <p>还没有学生完成，完成后这里会显示全班的共性错误。</p>
              )}
            </div>
            <div className="grid" style={{ gap: 14 }}>
              {insights.suggestion && (
                <div className="card">
                  <h3>下一节课建议（10 分钟）</h3>
                  <p>{insights.suggestion}</p>
                </div>
              )}
              <div className="card">
                <h3>分组练习推荐</h3>
                {insights.groups.map((g) => (
                  <p key={g.key} style={{ marginTop: 6 }}>
                    <b>{g.key} 组 · {g.students.length} 人</b>　{g.title}：{g.action}
                    {g.students.length > 0 && <span className="note"> （{g.students.map((s) => s.name).join("、")}）</span>}
                  </p>
                ))}
              </div>
              <div className="card">
                <h3>需要关注 · {insights.attention.length} 人</h3>
                {insights.attention.length ? (
                  insights.attention.map((x) => (
                    <p key={x.student.id}>
                      <Link href={`/teacher/students/${x.student.id}`}>{x.student.name}</Link>：{x.reason}。建议面谈了解是材料太难还是赶时间。
                    </p>
                  ))
                ) : (
                  <p>暂无。</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <h2 style={{ fontSize: 24, marginTop: 6 }}>还没有布置任务</h2>
      )}

      <div className="grid g2" style={{ marginTop: 36, alignItems: "start" }}>
        <div className="card">
          <h3>布置新任务</h3>
          <AssignForm classroomId={classId} passages={passages.map((p) => ({ id: p.id, label: `${p.level} · ${p.genre} ·《${p.title}》` }))} />
        </div>
        <div className="card">
          <h3>学生</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {classroom.students.map((s) => (
              <Link key={s.id} href={`/teacher/students/${s.id}`} className="tag">
                {s.displayName}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
