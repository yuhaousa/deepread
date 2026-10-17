import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { submitAnalysis } from "@/server/training";

const choice = z.number().int().min(0).max(20).nullable();
const Body = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("roles"), roles: z.array(choice).max(20), mcq: choice.optional() }),
  z.object({ kind: z.literal("audit"), verdicts: z.array(choice).max(20) }),
  z.object({ kind: z.literal("quiz"), answers: z.array(choice).max(20), selfCheck: z.number().int().min(1).max(20).nullable().optional() }),
  z.object({ kind: z.literal("sequence"), order: z.array(z.number().int().min(0).max(20)).max(20), mcq: choice.optional() }),
]);

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await submitAnalysis(user, id, body));
});
