import { pageUser } from "@/server/pages";
import { adminOptions, listUsers } from "@/server/admin/queries";
import { ROLES, ROLE_LABEL } from "@/server/admin/schemas";
import { CreateUserForm, UserRow } from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; c?: string }> }) {
  const me = await pageUser("ADMIN");
  const sp = await searchParams;
  const role = ROLES.find((r) => r === sp.role);
  const [users, options] = await Promise.all([listUsers({ q: sp.q, role, classroomId: sp.c || undefined }), adminOptions()]);

  return (
    <div className="admin">
      <div className="eyebrow">管理后台</div>
      <h2 className="admin-h">用户管理</h2>
      <p className="lede">创建账号、调整角色与班级、重置密码。学生账号只收集学号与姓名，不收集手机号。</p>

      <form className="toolbar" method="get">
        <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="搜索账号或姓名" aria-label="搜索账号或姓名" />
        <select name="role" defaultValue={role ?? ""} aria-label="角色">
          <option value="">全部角色</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
        <select name="c" defaultValue={sp.c ?? ""} aria-label="班级">
          <option value="">全部班级</option>
          {options.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn ghost">筛选</button>
        <span className="note sp">共 {users.length} 人</span>
      </form>

      <div className="tablewrap" style={{ marginTop: 12 }}>
        <table className="admin-table">
          <thead>
            <tr><th>账号</th><th>姓名</th><th>角色</th><th>班级 / 年级</th><th>监护人同意</th><th>创建</th><th aria-label="操作" /></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRow
                key={u.id}
                user={{ ...u, guardianConsentAt: u.guardianConsentAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString() }}
                classrooms={options.classrooms}
                isSelf={u.id === me.id}
              />
            ))}
            {!users.length && <tr><td colSpan={7} className="note">没有符合条件的用户。</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ marginTop: 18 }}>
        <h3>新建用户</h3>
        <CreateUserForm classrooms={options.classrooms} />
      </section>
    </div>
  );
}
