import { isResponse, ok, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { learnerPerformance } from "@/server/admin/queries";

export const GET = handle(async (req: Request) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const learners = await learnerPerformance({ classroomId: url.searchParams.get("classroomId") ?? undefined, q: url.searchParams.get("q") ?? undefined });
  return ok({ learners });
});
