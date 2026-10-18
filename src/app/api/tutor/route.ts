import { z } from "zod";
import type { StepKey } from "@/lib/domain";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { userHash } from "@/server/auth";
import { fail, isResponse, ok, parseBody, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { getOwnedSession, sessionMode } from "@/server/training";
import { tutorReply } from "@/server/tutor/service";

const Body = z.object({ sessionId: z.string().min(1), message: z.string().trim().min(1).max(300) });

/** 每次训练的导师对话轮数上限，防止把导师当成闲聊工具 */
const MAX_TURNS = 20;

export const POST = handle(async (req: Request) => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;

  const me = await db.query.users.findFirst({ where: eq(schema.users.id, user.id), columns: { guardianConsentAt: true } });
  if (!me?.guardianConsentAt) return fail(403, "需要监护人同意后才能使用 AI 导师。训练的其他步骤不受影响。");

  const { session, passage } = await getOwnedSession(user, body.sessionId);
  if (session.completedAt) return fail(409, "这次训练已经结束");
  const step = (session.step === "DONE" ? "FEEDBACK" : session.step) as StepKey;

  const history = await db.query.tutorMessages.findMany({ where: eq(schema.tutorMessages.sessionId, session.id), orderBy: asc(schema.tutorMessages.createdAt) });
  if (history.filter((m) => m.role === "user").length >= MAX_TURNS) {
    return fail(429, "这节课已经问了很多次啦。试着自己再读一遍原文，先想一想。");
  }

  const reply = await tutorReply(
    passage,
    step,
    [...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })), { role: "user", content: body.message }],
    userHash(user.id),
    sessionMode(session.mode, passage.tutorRole),
  );

  await db.insert(schema.tutorMessages).values(
    [
      { sessionId: session.id, role: "user", tutorRole: reply.role, step, content: body.message },
      { sessionId: session.id, role: "assistant", tutorRole: reply.role, step, content: reply.text, guardrail: reply.guardrail },
    ],
  );
  return ok({ text: reply.text, role: reply.role, ai: reply.ai, label: "AI 导师" });
});
