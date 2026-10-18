import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { startSession } from "@/server/training";
import { LEARNING_MODES } from "@/lib/modes";

const Body = z.object({ passageId: z.string().min(1), assignmentId: z.string().min(1).optional(), mode: z.enum(LEARNING_MODES).optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const session = await startSession(user, body.passageId, body.assignmentId, body.mode);
  return ok({ id: session.id }, { status: 201 });
});
