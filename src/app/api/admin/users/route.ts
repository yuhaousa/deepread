import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { listUsers } from "@/server/admin/queries";
import { CreateUser, ROLES } from "@/server/admin/schemas";
import { createUser } from "@/server/admin/users";

export const GET = handle(async (req: Request) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const role = url.searchParams.get("role");
  const users = await listUsers({
    q: url.searchParams.get("q") ?? undefined,
    role: ROLES.find((r) => r === role),
    classroomId: url.searchParams.get("classroomId") ?? undefined,
  });
  return ok({ users });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const body = await parseBody(req, CreateUser);
  if (isResponse(body)) return body;
  return ok(await createUser(body), { status: 201 });
});
