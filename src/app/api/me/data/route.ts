// 合规：学生（或代为操作的监护人）一键删除作答原文与导师对话；保留不含原文的能力统计。
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isResponse, ok, requireUser } from "@/server/http";
import { handle } from "@/server/route";

export const DELETE = handle(async () => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const { sessions, responses, tutorMessages, reviewItems } = schema;
  const ids = (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.studentId, user.id))).map((s) => s.id);
  const result = await db.transaction(async (tx) => {
    const r = ids.length ? await tx.delete(responses).where(inArray(responses.sessionId, ids)).returning({ id: responses.id }) : [];
    const m = ids.length ? await tx.delete(tutorMessages).where(inArray(tutorMessages.sessionId, ids)).returning({ id: tutorMessages.id }) : [];
    const v = await tx
      .update(reviewItems)
      .set({ answer: null })
      .where(and(eq(reviewItems.studentId, user.id), isNotNull(reviewItems.answer)))
      .returning({ id: reviewItems.id });
    await tx.update(sessions).set({ question: null, highlights: [], summary: null }).where(eq(sessions.studentId, user.id));
    return { responses: r.length, tutorMessages: m.length, reviewAnswers: v.length };
  });
  return ok({ deleted: result });
});
