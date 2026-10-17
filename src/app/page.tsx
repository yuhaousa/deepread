import Link from "next/link";
import { ABILITIES, ABILITY_META, LEVEL_DESCRIPTORS, STEP_LABEL, type LevelKey, type StepKey } from "@/lib/domain";
import { dueReviews } from "@/server/reviews";
import { pageUser, studentHome } from "@/server/pages";
import { StartButton } from "./start-button";

export const dynamic = "force-dynamic";

const fmt = (d: Date) => d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short", timeZone: "Asia/Singapore" });

export default async function Home() {
  const user = await pageUser("STUDENT");
  const [home, reviews] = await Promise.all([studentHome(user.id), dueReviews(user.id)]);
  const doneByAssignment = new Set(home.mine.filter((s) => s.completedAt && s.assignmentId).map((s) => s.assignmentId));
  const todo = home.assignments.filter((a) => !doneByAssignment.has(a.id));

  return (
    <>
      <div className="eyebrow">今日训练</div>
      <h2 style={{ fontSize: 24, marginTop: 6 }}>{home.name}，今天读一篇，15–25 分钟</h2>
      <p className="lede" style={{ marginTop: 6 }}>
        预测 → 专注阅读 → 合书回忆 → 结构分析 → 表达迁移 → 反馈复习。AI 导师只给提示，不给答案。
      </p>

      {home.inProgress.length > 0 && (
        <div className="sec" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>继续上次的训练</h2>
          <div className="lib">
            {home.inProgress.map((s) => (
              <div className="card" key={s.id}>
                <b>{s.passage.title}</b>
                <p className="note">停在第 {["PREDICT", "READ", "RECALL", "ANALYZE", "EXPRESS", "FEEDBACK"].indexOf(s.step) + 1} 步 · {STEP_LABEL[s.step as StepKey] ?? "反馈"}</p>
                <Link className="btn ghost go" href={`/train/${s.id}`} style={{ textDecoration: "none" }}>
                  继续
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sec" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>老师布置的任务</h2>
        {todo.length === 0 ? (
          <div className="empty">本周任务都完成了。可以去内容库自选一篇，或者先做今天的复习。</div>
        ) : (
          <div className="lib">
            {todo.map((a) => (
              <div className="card" key={a.id}>
                <div className="meta">
                  <span className="tag">{a.passage.genre}</span>
                  <span className="lvl">{a.passage.level}</span>
                  <span className="tag o">截止 {fmt(a.dueAt)}</span>
                </div>
                <b>{a.passage.title}</b>
                <p className="note">约 {a.passage.charCount} 字</p>
                <StartButton passageId={a.passage.id} assignmentId={a.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid g2" style={{ marginTop: 36, alignItems: "start" }}>
        <div className="card">
          <h3>今日复习 · {reviews.length} 题</h3>
          {reviews.length ? (
            <>
              <p>每题 30 秒，合上书回想。间隔再提取是记得久的关键。</p>
              <Link href="/reviews" className="btn green" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}>
                开始复习
              </Link>
            </>
          ) : (
            <p>今天没有到期的复习。完成一次训练后，系统会安排次日与 7 天后的再提取。</p>
          )}
        </div>
        <div className="card">
          <h3>我的能力等级</h3>
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {ABILITIES.map((a) => {
              const lv = (home.levels.find((m) => m.ability === a)?.level ?? "L2") as LevelKey;
              return (
                <div key={a} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 14 }}>
                  <span style={{ width: 36 }}>{ABILITY_META[a].name}</span>
                  <span className="lvl on">{lv}</span>
                  <span className="note">{LEVEL_DESCRIPTORS[a][lv]}</span>
                </div>
              );
            })}
          </div>
          <Link href="/report" className="note" style={{ display: "inline-block", marginTop: 10 }}>
            查看完整报告 →
          </Link>
        </div>
      </div>
    </>
  );
}
