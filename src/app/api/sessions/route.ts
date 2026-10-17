import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { startSession } from "@/server/training";

const Body = z.object({ passageId: z.string().min(1), assignmentId: z.string().min(1).optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const session = await startSession(user, body.passageId, body.assignmentId);
  return ok({ id: session.id }, { status: 201 });
});
