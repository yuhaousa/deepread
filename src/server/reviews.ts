// 间隔复习：今日到期的再提取题与作答判定。

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { matchKeyPoints } from "@/server/assessment/rules";
import { retryAfterFail } from "@/server/learner/schedule";
import { TrainingError } from "@/server/training";

const { reviewItems } = schema;

/** 只给线索，不给答案：关键点“标签：内容”只露出标签，无标签时只给段落位置 */
export function reviewCue(keyPointText: string, paragraph: number) {
  const [label, body] = keyPointText.split("：");
  return body ? `${label}是什么？` : `第 ${paragraph} 段讲了什么？`;
}

export async function dueReviews(studentId: string, now = new Date()) {
  const items = await db.query.reviewItems.findMany({
    where: and(eq(reviewItems.studentId, studentId), isNull(reviewItems.doneAt), lte(reviewItems.dueAt, now)),
    with: { keyPoint: { with: { passage: { columns: { title: true } } } } },
    orderBy: asc(reviewItems.dueAt),
    limit: 12,
  });
  return items.map((r) => ({
    id: r.id,
    title: r.keyPoint.passage.title,
    cue: reviewCue(r.keyPoint.text, r.keyPoint.paragraph),
    intervalD: r.intervalD,
    dueAt: r.dueAt,
  }));
}

export async function answerReview(studentId: string, id: string, answer: string) {
  const item = await db.query.reviewItems.findFirst({ where: eq(reviewItems.id, id), with: { keyPoint: true } });
  if (!item || item.studentId !== studentId) throw new TrainingError(404, "复习题不存在");
  if (item.doneAt) throw new TrainingError(409, "这道复习题已经完成");
  const passed = matchKeyPoints(answer, [item.keyPoint]).length > 0;
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(reviewItems).set({ answer, passed, doneAt: now }).where(eq(reviewItems.id, id));
    if (!passed) await tx.insert(reviewItems).values({ studentId, keyPointId: item.keyPointId, dueAt: retryAfterFail(now), intervalD: 2 });
  });
  return { passed, keyPoint: item.keyPoint.text };
}
