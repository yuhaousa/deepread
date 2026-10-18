import { z } from "zod";
import { STEPS } from "@/lib/domain";
import { toClient } from "@/server/content";
import { isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { getOwnedSession, sessionMode, updateProgress } from "@/server/training";
import { LEARNING_MODES } from "@/lib/modes";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const { id } = await params;
  const { session, passage } = await getOwnedSession(user, id);
  const chars = passage.paragraphs.join("").replace(/\s/g, "").length + passage.lead.length;
  return ok({
    session: { id: session.id, step: session.step, mode: sessionMode(session.mode, passage.tutorRole), question: session.question, highlights: session.highlights, completedAt: session.completedAt },
    passage: toClient(passage, chars, session.id),
  });
});

const Patch = z.object({
  step: z.enum(STEPS).optional(),
  question: z.string().max(300).optional(),
  highlights: z.array(z.string().regex(/^\d+-\d+$/)).max(200).optional(),
  readingSeconds: z.number().int().min(0).max(4 * 3600).optional(),
  lookback: z.boolean().optional(),
  predictChoice: z.number().int().min(0).max(10).optional(),
  mode: z.enum(LEARNING_MODES).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Patch);
  if (isResponse(body)) return body;
  const { id } = await params;
  return ok(await updateProgress(user, id, body));
});
