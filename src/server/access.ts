// 数据可见性：班级是边界。学生只看自己；教师只看自己任教班级的学生；管理员看全部。

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { SessionUser } from "@/server/auth";

export async function canManageClassroom(viewer: SessionUser, classroomId: string): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;
  if (viewer.role !== "TEACHER") return false;
  const c = await db.query.classrooms.findFirst({ where: and(eq(schema.classrooms.id, classroomId), eq(schema.classrooms.teacherId, viewer.id)) });
  return !!c;
}

export async function canViewStudent(viewer: SessionUser, studentId: string): Promise<boolean> {
  if (viewer.role === "ADMIN") return true;
  if (viewer.role === "STUDENT") return viewer.id === studentId;
  if (viewer.role === "TEACHER") {
    const s = await db.query.users.findFirst({ where: eq(schema.users.id, studentId), columns: { classroomId: true } });
    return !!s?.classroomId && (await canManageClassroom(viewer, s.classroomId));
  }
  return false;
}
