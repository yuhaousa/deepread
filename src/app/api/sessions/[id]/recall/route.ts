import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { submitRecall } from "@/server/training";

const Body = z.object({ text: z.string().trim().min(15, "至少写出主旨和一个原因或理由").max(2000), confidence: z.number().int().min(1).max(5) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await submitRecall(user, id, body.text, body.confidence));
});
