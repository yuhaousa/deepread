import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canManageClassroom } from "@/server/access";
import { fail, isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";

const Body = z.object({
  classroomId: z.string().min(1),
  passageId: z.string().min(1),
  dueAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), "截止时间需要在未来"),
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser("TEACHER", "ADMIN");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  if (!(await canManageClassroom(user, body.classroomId))) return fail(403, "不是你任教的班级");
  const passage = await db.query.passages.findFirst({ where: and(eq(schema.passages.id, body.passageId), eq(schema.passages.status, "PUBLISHED")) });
  if (!passage) return fail(404, "材料不存在或未发布");
  const [assignment] = await db.insert(schema.assignments).values(body).returning();
  return ok({ id: assignment.id }, { status: 201 });
});
