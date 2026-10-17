// 学情表现导出为 CSV（Excel 可直接打开）
import { ABILITIES, ABILITY_META } from "@/lib/domain";
import { isResponse, requireUser } from "@/server/http";
import { handle } from "@/server/route";
import { pct, toCsv } from "@/server/admin/metrics";
import { learnerPerformance } from "@/server/admin/queries";

const date = (d: Date | null) => (d ? d.toLocaleDateString("sv-SE", { timeZone: "Asia/Singapore" }) : "");

export const GET = handle(async (req: Request) => {
  const user = await requireUser("ADMIN");
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const rows = await learnerPerformance({ classroomId: url.searchParams.get("classroomId") ?? undefined, q: url.searchParams.get("q") ?? undefined });
  const csv = toCsv([
    ["账号", "姓名", "年级", "班级", "已完成训练", "进行中", "最近训练", "平均回忆覆盖率%", "平均结构分析%", "平均摘要量表%", ...ABILITIES.map((a) => `${ABILITY_META[a].name}等级`), "待复习", "预警"],
    ...rows.map((r) => [
      r.username,
      r.name,
      r.grade,
      r.classroomName,
      r.completed,
      r.inProgress,
      date(r.lastActive),
      pct(r.avgRecall),
      pct(r.avgAnalysis),
      pct(r.avgExpress),
      ...ABILITIES.map((a) => r.levels[a]),
      r.dueReviews,
      r.flags.join("；"),
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="learners-${date(new Date())}.csv"`,
      "cache-control": "no-store",
    },
  });
});
