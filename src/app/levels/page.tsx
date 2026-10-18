import { eq } from "drizzle-orm";
import { ABILITIES, ABILITY_META, LEVEL_DESCRIPTORS, LEVEL_META, LEVELS, type LevelKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import { PASS_RATE, REMEDIAL_STREAK, STRUGGLE_RATE, UPGRADE_STREAK } from "@/server/learner/levels";
import { pageUser } from "@/server/pages";

export const dynamic = "force-dynamic";

export default async function Levels() {
  const user = await pageUser();
  const mine = user.role === "STUDENT" ? await db.query.mastery.findMany({ where: eq(schema.mastery.studentId, user.id) }) : [];
  const cur = (a: string) => mine.find((m) => m.ability === a)?.level as LevelKey | undefined;

  return (
    <>
      <div className="eyebrow">阅读能力等级量表</div>
      <h2 style={{ fontSize: 24, marginTop: 6 }}>六项能力 × 六个等级</h2>
      <p className="lede" style={{ marginTop: 6 }}>
        每项能力单独定级，不合成总分，也不做排名。L1–L6 从基础阅读逐步进阶到多源研究型阅读。{user.role === "STUDENT" && "绿色格子是你当前的等级。"}
      </p>

      <div className="sec">
        <h2 style={{ fontSize: 19 }}>六级的文本难度</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>等级</th><th>对应学段</th><th>篇幅</th><th>结构</th><th>推理要求</th></tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l}>
                  <td><span className="lvl">{l}</span> {LEVEL_META[l].name}</td>
                  <td>{LEVEL_META[l].stage}</td>
                  <td>{LEVEL_META[l].length}</td>
                  <td>{LEVEL_META[l].structure}</td>
                  <td>{LEVEL_META[l].inference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <h2 style={{ fontSize: 19 }}>六项能力的行为描述</h2>
        <div className="tablewrap scale">
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>能力</th>
                {LEVELS.map((l) => (
                  <th key={l}>{l} {LEVEL_META[l].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABILITIES.map((a) => (
                <tr key={a}>
                  <td>
                    <b>{ABILITY_META[a].name}</b>
                    <div className="note">PISA · {ABILITY_META[a].pisa}</div>
                  </td>
                  {LEVELS.map((l) => (
                    <td key={l} className={cur(a) === l ? "cur" : undefined}>{LEVEL_DESCRIPTORS[a][l]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sec">
        <h2 style={{ fontSize: 19 }}>定级与升级规则</h2>
        <div className="card">
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14.5 }}>
            <li>入学定级：3 篇定级测（L2、L3、L4 各一篇），每项能力取最高的达标等级。</li>
            <li>升级：某项能力在本级或更高等级的任务上连续 {UPGRADE_STREAK} 次达标率 ≥ {PASS_RATE * 100}%，且最近一次 7 天复习没有失败，即升一级。</li>
            <li>补练：在本级连续 {REMEDIAL_STREAK} 次达标率 &lt; {STRUGGLE_RATE * 100}%，推送本级同类补练；界面不显示“降级”。</li>
            <li>文本与能力解耦：同一篇 L3 材料可以出 L2 的回忆任务和 L3 的分析任务。</li>
          </ul>
        </div>
      </div>
    </>
  );
}
