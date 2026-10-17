import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { classroomsOverview } from "@/server/admin/queries";
import { CreateClassroom } from "@/server/admin/schemas";
import { createClassroom } from "@/server/admin/users";

export const GET = handle(async () => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  return ok({ classrooms: await classroomsOverview() });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const body = await parseBody(req, CreateClassroom);
  if (isResponse(body)) return body;
  return ok(await createClassroom(body), { status: 201 });
});
