// 管理后台 · 请求体校验（路由与表单共用的字段规则）
import { z } from "zod";

export const ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN", "EDITOR"] as const;
export const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
  STUDENT: "学生",
  TEACHER: "教师",
  PARENT: "家长",
  ADMIN: "管理员",
  EDITOR: "编辑",
};

const password = z.string().min(8, "密码至少 8 位").max(200);
const name = z.string().trim().min(1, "请填写姓名").max(50);
const grade = z.string().trim().max(20).nullable().optional();
const classroomId = z.string().min(1).nullable().optional();

export const CreateUser = z.object({
  username: z
    .string()
    .trim()
    .min(2, "账号至少 2 个字符")
    .max(100)
    .regex(/^[A-Za-z0-9._@-]+$/, "账号只能包含字母、数字和 . _ @ -"),
  displayName: name,
  role: z.enum(ROLES),
  password,
  grade,
  classroomId,
  guardianConsent: z.boolean().optional(),
});

export const UpdateUser = z.object({
  displayName: name.optional(),
  role: z.enum(ROLES).optional(),
  password: password.optional(),
  grade,
  classroomId,
  guardianConsent: z.boolean().optional(),
});

export const CreateClassroom = z.object({
  name: z.string().trim().min(1, "请填写班级名称").max(50),
  grade: z.string().trim().min(1, "请填写年级").max(20),
  teacherId: z.string().min(1, "请选择教师"),
});

export const UpdateClassroom = CreateClassroom.partial();
