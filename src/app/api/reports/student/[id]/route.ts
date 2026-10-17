import { canViewStudent } from "@/server/access";
import { fail, isResponse, ok, requireUser } from "@/server/http";
import { studentReport } from "@/server/reports";
import { handle } from "@/server/route";

export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const { id } = await params;
  if (!(await canViewStudent(user, id))) return fail(403, "没有权限查看该学生");
  const report = await studentReport(id);
  return report ? ok(report) : fail(404, "学生不存在");
});
