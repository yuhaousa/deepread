// 页面（Server Components）共用的数据加载。
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUser, type RoleKey } from "@/server/auth";

export async function pageUser(...roles: RoleKey[]) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(user.role === "STUDENT" ? "/" : "/teacher");
  return user;
}

export async function publishedPassages() {
  const p = schema.passages;
  return db
    .select({ id: p.id, slug: p.slug, title: p.title, genre: p.genre, grade: p.grade, level: p.level, primaryAbility: p.primaryAbility, tutorRole: p.tutorRole, charCount: p.charCount })
    .from(p)
    .where(eq(p.status, "PUBLISHED"))
    .orderBy(asc(p.level), asc(p.title));
}

/** 学生首页：本班未完成的任务、进行中的训练、已完成的材料 */
export async function studentHome(studentId: string) {
  const me = await db.query.users.findFirst({ where: eq(schema.users.id, studentId), columns: { classroomId: true, displayName: true } });
  const assignments = me?.classroomId
    ? await db.query.assignments.findMany({
        where: eq(schema.assignments.classroomId, me.classroomId),
        with: { passage: { columns: { id: true, title: true, genre: true, level: true, charCount: true } } },
        orderBy: asc(schema.assignments.dueAt),
      })
    : [];
  const mine = await db.query.sessions.findMany({
    where: eq(schema.sessions.studentId, studentId),
    columns: { id: true, passageId: true, assignmentId: true, step: true, completedAt: true },
    orderBy: desc(schema.sessions.startedAt),
  });
  const inProgress = await db.query.sessions.findMany({
    where: and(eq(schema.sessions.studentId, studentId), isNull(schema.sessions.completedAt)),
    with: { passage: { columns: { title: true } } },
  });
  const levels = await db.query.mastery.findMany({ where: eq(schema.mastery.studentId, studentId) });
  return { name: me?.displayName ?? "", assignments, mine, inProgress, levels };
}
