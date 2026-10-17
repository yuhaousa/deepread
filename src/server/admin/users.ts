// 管理后台 · 用户与班级的增删改。业务规则集中在这里，路由只做鉴权和参数校验。

import { asc, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashPassword, type RoleKey, type SessionUser } from "@/server/auth";
import { TrainingError } from "@/server/training";

const { users, classrooms, schools } = schema;

export interface UserInput {
  username: string;
  displayName: string;
  role: RoleKey;
  password: string;
  grade?: string | null;
  classroomId?: string | null;
  guardianConsent?: boolean;
}

export type UserPatch = Partial<Omit<UserInput, "username" | "password">> & { password?: string };

/** 只有学生属于班级、需要监护人同意；其他角色清空这两项 */
async function studentFields(role: RoleKey, classroomId: string | null | undefined, consent: boolean | undefined, current?: Date | null) {
  if (role !== "STUDENT") return { classroomId: null, guardianConsentAt: null };
  if (classroomId) {
    const c = await db.query.classrooms.findFirst({ where: eq(classrooms.id, classroomId), columns: { id: true } });
    if (!c) throw new TrainingError(400, "班级不存在");
  }
  return {
    classroomId: classroomId ?? null,
    guardianConsentAt: consent === undefined ? (current ?? null) : consent ? (current ?? new Date()) : null,
  };
}

/** 唯一约束冲突。D1 / SQLite 报 "UNIQUE constraint failed"；drizzle 可能把驱动错误包在 cause 里 */
const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { message?: string; cause?: unknown } | null;
  return !!err && (/UNIQUE constraint failed/i.test(err.message ?? "") || (err.cause !== undefined && isUniqueViolation(err.cause)));
};

export async function createUser(input: UserInput) {
  const extra = await studentFields(input.role, input.classroomId, input.guardianConsent);
  try {
    const [u] = await db
      .insert(users)
      .values({
        username: input.username,
        displayName: input.displayName,
        role: input.role,
        grade: input.grade ?? null,
        passwordHash: await hashPassword(input.password),
        ...extra,
      })
      .returning({ id: users.id });
    return u;
  } catch (e) {
    if (isUniqueViolation(e)) throw new TrainingError(409, "账号已存在");
    throw e;
  }
}

async function ownedClassrooms(userId: string) {
  const [{ n }] = await db.select({ n: count() }).from(classrooms).where(eq(classrooms.teacherId, userId));
  return n;
}

export async function updateUser(actor: SessionUser, id: string, patch: UserPatch) {
  const u = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!u) throw new TrainingError(404, "用户不存在");
  const role = patch.role ?? (u.role as RoleKey);
  if (id === actor.id && role !== u.role) throw new TrainingError(400, "不能修改自己的角色");
  if (u.role === "TEACHER" && role !== "TEACHER" && (await ownedClassrooms(id))) {
    throw new TrainingError(409, "该教师仍有任教班级，请先把班级转给其他教师");
  }
  const extra = await studentFields(role, patch.classroomId === undefined ? u.classroomId : patch.classroomId, patch.guardianConsent, u.guardianConsentAt);
  await db
    .update(users)
    .set({
      role,
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.grade !== undefined ? { grade: patch.grade } : {}),
      ...(patch.password ? { passwordHash: await hashPassword(patch.password) } : {}),
      ...extra,
    })
    .where(eq(users.id, id));
  return { id };
}

export async function deleteUser(actor: SessionUser, id: string) {
  if (id === actor.id) throw new TrainingError(400, "不能删除自己的账号");
  const u = await db.query.users.findFirst({ where: eq(users.id, id), columns: { id: true, role: true } });
  if (!u) throw new TrainingError(404, "用户不存在");
  if (u.role === "ADMIN") {
    const [{ n }] = await db.select({ n: count() }).from(users).where(eq(users.role, "ADMIN"));
    if (n <= 1) throw new TrainingError(409, "至少需要保留一名管理员");
  }
  if (u.role === "TEACHER" && (await ownedClassrooms(id))) throw new TrainingError(409, "该教师仍有任教班级，请先把班级转给其他教师");
  // 学生的训练记录、复习、能力记录随账号级联删除
  await db.delete(users).where(eq(users.id, id));
  return { id };
}

export interface ClassroomInput {
  name: string;
  grade: string;
  teacherId: string;
}

async function requireTeacher(teacherId: string) {
  const t = await db.query.users.findFirst({ where: eq(users.id, teacherId), columns: { role: true } });
  if (!t || t.role !== "TEACHER") throw new TrainingError(400, "请选择一名教师");
}

export async function createClassroom(input: ClassroomInput) {
  await requireTeacher(input.teacherId);
  let school = await db.query.schools.findFirst({ orderBy: asc(schools.createdAt) });
  if (!school) [school] = await db.insert(schools).values({ name: "默认学校" }).returning();
  const [c] = await db.insert(classrooms).values({ ...input, schoolId: school.id }).returning({ id: classrooms.id });
  return c;
}

export async function updateClassroom(id: string, patch: Partial<ClassroomInput>) {
  const c = await db.query.classrooms.findFirst({ where: eq(classrooms.id, id), columns: { id: true } });
  if (!c) throw new TrainingError(404, "班级不存在");
  if (patch.teacherId) await requireTeacher(patch.teacherId);
  if (Object.keys(patch).length) await db.update(classrooms).set(patch).where(eq(classrooms.id, id));
  return { id };
}
