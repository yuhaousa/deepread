import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { answerReview } from "@/server/reviews";
import { handle } from "@/server/route";

const Body = z.object({ answer: z.string().trim().min(2).max(500) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await answerReview(user.id, id, body.answer));
});
