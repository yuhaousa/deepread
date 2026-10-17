import Link from "next/link";
import { ABILITY_META, LEVEL_META, TUTOR_ROLE_LABEL, type AbilityKey, type LevelKey, type TutorRoleKey } from "@/lib/domain";
import { pageUser, publishedPassages } from "@/server/pages";
import { dailyStarts } from "@/server/training";
import { StartButton } from "../start-button";

export const dynamic = "force-dynamic";

export default async function Library({ searchParams }: { searchParams: Promise<{ genre?: string; level?: string }> }) {
  const user = await pageUser();
  const { genre, level } = await searchParams;
  const quota = user.role === "STUDENT" ? await dailyStarts(user.id) : null;
  const all = await publishedPassages();
  const genres = [...new Set(all.map((p) => p.genre))];
  const levels = [...new Set(all.map((p) => p.level))].sort();
  const list = all.filter((p) => (!genre || p.genre === genre) && (!level || p.level === level));
  const href = (g?: string, l?: string) => {
    const q = new URLSearchParams();
    if (g) q.set("genre", g);
    if (l) q.set("level", l);
    const s = q.toString();
    return s ? `/library?${s}` : "/library";
  };

  return (
    <>
      <div className="eyebrow">内容库</div>
      <h2 style={{ fontSize: 24, marginTop: 6 }}>经审核的分级阅读材料</h2>
      <p className="lede" style={{ marginTop: 6 }}>
        每篇材料都有内容卡片，题目能在原文中找到依据。等级对应
        <Link href="/levels"> 能力量表 </Link>
        中的文本难度。
      </p>
      {quota && (
        <p className={quota.left ? "note" : "levelup"} style={{ marginTop: 10 }}>
          {quota.left
            ? `今天还能开始 ${quota.left} / ${quota.limit} 节训练；进行中的训练随时可以继续，原文随时可以阅读。`
            : `今天的 ${quota.limit} 节训练已经开始完了，明天再来开始新的一节。原文仍然可以阅读，进行中的训练也可以继续。`}
        </p>
      )}
      <div className="filter" style={{ marginTop: 16 }}>
        <Link href={href(undefined, level)} aria-pressed={!genre} className="pill">全部文体</Link>
        {genres.map((g) => (
          <Link key={g} href={href(g, level)} aria-pressed={genre === g} className="pill">{g}</Link>
        ))}
      </div>
      <div className="filter" style={{ marginTop: 8 }}>
        <Link href={href(genre, undefined)} aria-pressed={!level} className="pill">全部等级</Link>
        {levels.map((l) => (
          <Link key={l} href={href(genre, l)} aria-pressed={level === l} className="pill">
            {l} {LEVEL_META[l as LevelKey].name}
          </Link>
        ))}
      </div>
      <div className="lib" style={{ marginTop: 16 }}>
        {list.map((p) => (
          <div className="card" key={p.id}>
            <div className="meta">
              <span className="tag">{p.genre}</span>
              <span className="tag">{p.grade}</span>
              <span className="lvl">{p.level}</span>
              <span className="tag g">{TUTOR_ROLE_LABEL[p.tutorRole as TutorRoleKey]}</span>
            </div>
            <Link href={`/library/${p.id}`} className="lib-title">{p.title}</Link>
            <p className="note">
              主训练能力：{ABILITY_META[p.primaryAbility as AbilityKey].name} · 约 {p.charCount} 字
            </p>
            <div className="lib-actions">
              <Link className="btn ghost sm" href={`/library/${p.id}`}>{user.role === "STUDENT" ? "阅读原文" : "查看原文与题目"}</Link>
              {user.role === "STUDENT" && <StartButton passageId={p.id} ghost label="开始训练" />}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="empty">没有符合条件的材料。</div>}
      </div>
    </>
  );
}
