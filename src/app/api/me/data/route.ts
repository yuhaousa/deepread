// 合规：学生（或代为操作的监护人）一键删除作答原文与导师对话；保留不含原文的能力统计。
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isResponse, ok, requireUser } from "@/server/http";
import { handle } from "@/server/route";

export const DELETE = handle(async () => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  const { sessions, responses, tutorMessages, reviewItems } = schema;
  // 用子查询而不是把所有训练 ID 传进来：D1 单条语句最多 100 个绑定参数
  const mine = db.select({ id: sessions.id }).from(sessions).where(eq(sessions.studentId, user.id));
  const [r, m, v] = await db.batch([
    db.delete(responses).where(inArray(responses.sessionId, mine)).returning({ id: responses.id }),
    db.delete(tutorMessages).where(inArray(tutorMessages.sessionId, mine)).returning({ id: tutorMessages.id }),
    db
      .update(reviewItems)
      .set({ answer: null })
      .where(and(eq(reviewItems.studentId, user.id), isNotNull(reviewItems.answer)))
      .returning({ id: reviewItems.id }),
    db.update(sessions).set({ question: null, highlights: [], summary: null }).where(eq(sessions.studentId, user.id)),
  ]);
  const result = { responses: r.length, tutorMessages: m.length, reviewAnswers: v.length };
  return ok({ deleted: result });
});
