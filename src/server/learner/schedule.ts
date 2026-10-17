// 复习调度：训练结束后安排次日与 7 天后的再提取。
// 中国与新加坡同为 UTC+8，提醒统一定在当地 07:30。

export const REVIEW_INTERVALS = [1, 7] as const;
export const NEXT_DAY_ITEMS = 3;
const UTC_OFFSET_H = 8;

/** 从 from 起第 days 天的当地 hh:mm（UTC+8），返回 UTC 时间 */
export function localTimeAfter(from: Date, days: number, hh = 7, mm = 30): Date {
  const local = new Date(from.getTime() + UTC_OFFSET_H * 3600_000);
  const d = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, hh, mm);
  return new Date(d - UTC_OFFSET_H * 3600_000);
}

export interface PlannedReview {
  keyPointIndex: number;
  intervalD: number;
  dueAt: Date;
}

/**
 * 次日：优先没回忆出来的关键点，再补已覆盖的，共 NEXT_DAY_ITEMS 个；
 * 7 天后：全部关键点混合再提取（与本周其他文章一起出现）。
 */
export function planReviews(totalKeyPoints: number, covered: number[], now: Date): PlannedReview[] {
  const all = Array.from({ length: totalKeyPoints }, (_, i) => i);
  const missed = all.filter((i) => !covered.includes(i));
  const nextDay = [...missed, ...covered].slice(0, NEXT_DAY_ITEMS);
  return [
    ...nextDay.map((i) => ({ keyPointIndex: i, intervalD: 1, dueAt: localTimeAfter(now, 1) })),
    ...all.map((i) => ({ keyPointIndex: i, intervalD: 7, dueAt: localTimeAfter(now, 7) })),
  ];
}

/** 复习没通过：2 天后再来一次 */
export function retryAfterFail(now: Date): Date {
  return localTimeAfter(now, 2);
}
