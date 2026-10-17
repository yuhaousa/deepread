import Link from "next/link";
import { adminOptions, classroomsOverview } from "@/server/admin/queries";
import { pageUser } from "@/server/pages";
import { ClassTeacherSelect, CreateClassForm } from "./classes-client";

export const dynamic = "force-dynamic";

export default async function AdminClasses() {
  await pageUser("ADMIN");
  const [rows, options] = await Promise.all([classroomsOverview(), adminOptions()]);

  return (
    <div className="admin">
      <div className="eyebrow">管理后台</div>
      <h2 className="admin-h">班级</h2>
      <p className="lede">班级是数据可见性的边界：教师只能看到自己任教班级的学生。</p>

      <div className="tablewrap" style={{ marginTop: 14 }}>
        <table className="admin-table num">
          <thead><tr><th>班级</th><th>年级</th><th>任课教师</th><th>学生</th><th>已布置任务</th><th aria-label="操作" /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.grade}</td>
                <td><ClassTeacherSelect classroomId={c.id} teacherId={c.teacherId} teachers={options.teachers} /></td>
                <td><Link href={`/admin/learners?c=${c.id}`}>{c.students} 人</Link></td>
                <td>{c.assignments}</td>
                <td><Link className="btn ghost sm" href={`/teacher?c=${c.id}`}>班级洞察</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="note">还没有班级。</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>新建班级</h3>
        {options.teachers.length ? (
          <CreateClassForm teachers={options.teachers} />
        ) : (
          <p>请先在<Link href="/admin/users">用户管理</Link>中创建一名教师。</p>
        )}
      </section>
    </div>
  );
}
