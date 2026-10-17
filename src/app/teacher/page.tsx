import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canManageClassroom } from "@/server/access";
import { pageUser, publishedPassages } from "@/server/pages";
import { classroomInsights } from "@/server/reports";
import { AssignForm } from "./assign-form";
import { LearnerTable } from "@/app/learner-table";
import { LEARNER_SORT_KEYS, sortLearners } from "@/server/admin/metrics";
import { learnerPerformance } from "@/server/learner/performance";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Singapore" });

type SP = { c?: string; a?: string; sort?: string; dir?: string };

export default async function Teacher({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await pageUser("TEACHER", "ADMIN");
  const sp = await searchParams;
  const { c, a } = sp;
  const classes = await db.query.classrooms.findMany({
    where: user.role === "ADMIN" ? undefined : eq(schema.classrooms.teacherId, user.id),
    orderBy: asc(schema.classrooms.name),
  });
  if (!classes.length) return <div className="empty">还没有任教班级，请联系学校管理员开通。</div>;
  const classId = c && classes.some((x) => x.id === c) ? c : classes[0].id;
  if (!(await canManageClassroom(user, classId))) redirect("/teacher");

  const [data, passages, learners] = await Promise.all([classroomInsights(classId, a), publishedPassages(), learnerPerformance({ classroomId: classId })]);
  if (!data) redirect("/teacher");
  const { classroom, assignment, insights } = data;

  const sort = LEARNER_SORT_KEYS.find((k) => k === sp.sort) ?? "name";
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const rows = sortLearners(learners, sort, dir);
  const sortHref = (k: string, d: string) => `/teacher?${new URLSearchParams({ c: classId, ...(a ? { a } : {}), sort: k, dir: d })}#students`;
  const classAvg = (key: "avgRecall" | "avgAnalysis" | "avgExpress") => {
    const v = learners.map((l) => l[key]).filter((x): x is number => x !== null);
    return v.length ? `${Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 100)}%` : "—";
  };
  const trained = learners.filter((l) => l.completed > 0).length;
  const flagged = learners.filter((l) => l.flags.some((f) => !f.startsWith("监护人"))).length;

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

      <div style={{ marginTop: 36, maxWidth: 560 }}>
        <div className="card">
          <h3>布置新任务</h3>
          <AssignForm classroomId={classId} passages={passages.map((p) => ({ id: p.id, label: `${p.level} · ${p.genre} ·《${p.title}》` }))} />
        </div>
      </div>

      <section className="sec" id="students">
        <div className="eyebrow">学生学习情况</div>
        <h2>{classroom.name} · {learners.length} 名学生</h2>
        <div className="kpis compact" style={{ marginTop: 0 }}>
          <div className="kpi"><span>已开始训练</span><b>{trained} / {learners.length}</b></div>
          <div className="kpi"><span>班级平均回忆覆盖</span><b>{classAvg("avgRecall")}</b></div>
          <div className="kpi"><span>班级平均结构分析</span><b>{classAvg("avgAnalysis")}</b></div>
          <div className="kpi"><span>班级平均摘要量表</span><b>{classAvg("avgExpress")}</b></div>
          <div className="kpi"><span>有学习预警</span><b>{flagged} 人</b><small>回忆偏低、长期未训练或未开始</small></div>
        </div>
        <p className="note">回忆覆盖、结构分析、摘要量表为该生已完成训练的平均达标率。点击表头排序，点击姓名查看完整报告与训练记录。</p>
        <LearnerTable rows={rows} linkFor={(id) => `/teacher/students/${id}`} showClass={false} sort={{ sort, dir, href: sortHref }} />
      </section>
    </>
  );
}
