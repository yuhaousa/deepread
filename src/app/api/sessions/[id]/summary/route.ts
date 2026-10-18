import { z } from "zod";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { submitSummary } from "@/server/training";

const Body = z.object({ summary: z.string().trim().min(20, "摘要至少写两三句").max(1500), transfer: z.string().trim().max(1500).nullable().optional(), extra: z.string().trim().max(1500).nullable().optional() });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await submitSummary(user, id, body.summary, body.transfer ?? null, body.extra || null));
});
