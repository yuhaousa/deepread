import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { UpdateUser } from "@/server/admin/schemas";
import { deleteUser, updateUser } from "@/server/admin/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const body = await parseBody(req, UpdateUser);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await updateUser(user, id, body));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const { id } = await params;
  return ok(await deleteUser(user, id));
});
