import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { UpdateClassroom } from "@/server/admin/schemas";
import { updateClassroom } from "@/server/admin/users";

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const body = await parseBody(req, UpdateClassroom);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await updateClassroom(id, body));
});
