import { canManageClassroom } from "@/server/access";
import { fail, isResponse, ok, requireUser } from "@/server/http";
import { classroomInsights } from "@/server/reports";
import { handle } from "@/server/route";

export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("TEACHER", "ADMIN");
  if (isResponse(user)) return user;
  const { id } = await params;
  if (!(await canManageClassroom(user, id))) return fail(403, "不是你任教的班级");
  const assignmentId = new URL(req.url).searchParams.get("assignmentId") ?? undefined;
  const data = await classroomInsights(id, assignmentId);
  if (!data) return fail(404, "班级不存在");
  return ok({ assignment: data.assignment, insights: data.insights });
});
