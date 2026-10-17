import { isResponse, ok, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { completeSession } from "@/server/training";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const { id } = await params;
  return ok(await completeSession(user, id));
});
