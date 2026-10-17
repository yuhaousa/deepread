// 材料详情：所有登录用户都能阅读原文。
// 教师 / 管理员另外看到内容卡片、关键点、题目答案与参考摘要（备课用）；学生端不含任何答案。
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ABILITY_META, LEVEL_META, TUTOR_ROLE_LABEL, charCount, type AnalysisSpec, type Mcq } from "@/lib/domain";
import { db, schema } from "@/lib/db";
import { loadPassage } from "@/server/content";
import { pageUser } from "@/server/pages";
import { dailyStarts } from "@/server/training";
import { StartButton } from "../../start-button";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<AnalysisSpec["kind"], string> = { roles: "段落作用", audit: "AI 摘要核查", quiz: "选择题", sequence: "因果排序" };

function McqAnswer({ m }: { m: Mcq }) {
  return (
    <li>
      <b>{m.question}</b>
      <div>答案：{m.options[m.answer]}</div>
      <div className="note">{m.explanation}</div>
    </li>
  );
}

function AnswerKey({ a }: { a: AnalysisSpec }) {
  switch (a.kind) {
    case "roles":
      return (
        <ol className="answer-key">
          {a.items.map((it) => (
            <li key={it.paragraph}>第 {it.paragraph} 段：{a.roles[it.answer]}</li>
          ))}
          {a.mcq && <McqAnswer m={a.mcq} />}
        </ol>
      );
    case "audit":
      return (
        <ol className="answer-key">
          {a.clauses.map((c, i) => (
            <li key={i}>
              {c.text} <span className="tag o">{a.types[c.answer]}</span>
              <div className="note">{c.explanation}</div>
            </li>
          ))}
        </ol>
      );
    case "quiz":
      return (
        <ol className="answer-key">
          {a.questions.map((q, i) => <McqAnswer key={i} m={q} />)}
        </ol>
      );
    case "sequence":
      return (
        <ol className="answer-key">
          {a.steps.map((s, i) => <li key={i}>{s}</li>)}
          {a.mcq && <McqAnswer m={a.mcq} />}
        </ol>
      );
  }
}

export default async function PassagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const { id } = await params;
  const row = await db.query.passages.findFirst({ where: eq(schema.passages.id, id), columns: { status: true } });
  const isStaff = user.role !== "STUDENT";
  // 学生只能看已发布材料；教师、管理员可预览草稿
  if (!row || (!isStaff && row.status !== "PUBLISHED")) notFound();
  const p = await loadPassage(id);
  if (!p) notFound();

  const mine = isStaff
    ? []
    : await db.query.sessions.findMany({
        where: and(eq(schema.sessions.studentId, user.id), eq(schema.sessions.passageId, id)),
        columns: { id: true, completedAt: true },
        orderBy: desc(schema.sessions.startedAt),
      });
  const open = mine.find((s) => !s.completedAt);
  const lastDone = mine.find((s) => s.completedAt);
  const quota = isStaff ? null : await dailyStarts(user.id);

  return (
    <div className="passage-page">
      <Link href="/library" className="note">← 返回内容库</Link>

      <div className="meta" style={{ marginTop: 12 }}>
        <span className="tag">{p.genre}</span>
        <span className="tag">{p.grade}</span>
        <span className="lvl on">{p.level} {LEVEL_META[p.level].name}</span>
        <span className="tag g">主训练：{ABILITY_META[p.primaryAbility].name}</span>
        <span className="tag">{TUTOR_ROLE_LABEL[p.tutorRole]}</span>
        <span className="note">约 {charCount(p)} 字</span>
      </div>

      {!isStaff && (
        <div className="card start-card">
          <div>
            <b>{open ? "这篇的训练还没做完" : lastDone ? "你已经练过这一篇" : "用这篇材料做一次训练"}</b>
            <p className="note">
              {open
                ? "继续上次的进度，不占今天的训练名额。"
                : `六步训练：预测 → 阅读 → 合书回忆 → 结构分析 → 表达迁移 → 反馈。今天还能开始 ${quota!.left} / ${quota!.limit} 节。`}
            </p>
          </div>
          <div className="start-actions">
            {open ? (
              <Link className="btn green" href={`/train/${open.id}`}>继续训练</Link>
            ) : (
              <StartButton passageId={p.id} label={lastDone ? "再练一次" : "开始训练"} />
            )}
            {lastDone && <Link className="btn ghost" href={`/train/${lastDone.id}`}>查看上次反馈</Link>}
          </div>
        </div>
      )}

      <article className="reading passage-text">
        <h1>{p.title}</h1>
        <p className="lead" style={{ textIndent: 0 }}>{p.lead}</p>
        {p.paragraphs.map((t, i) => (
          <p key={i}>
            <span className="pn">{i + 1}</span>
            {t}
          </p>
        ))}
      </article>

      {!isStaff && (
        <p className="note" style={{ marginTop: 8 }}>
          提示：先预测再读、读完合上原文回忆，比反复看原文记得更牢。正式训练时原文会在第 3 步收起。
        </p>
      )}

      {isStaff && (
        <section className="sec teacher-kit">
          <div className="eyebrow">教师备课 · 学生端不可见</div>
          <div className="grid g2" style={{ alignItems: "start" }}>
            <div className="card">
              <h3>内容卡片</h3>
              <dl className="kv">
                <dt>来源与授权</dt><dd>{p.card.source}</dd>
                <dt>结构</dt><dd>{p.card.structure}</dd>
                <dt>主旨位置</dt><dd>{p.card.thesisLocation}</dd>
                <dt>关键概念</dt><dd>{p.card.concepts.join("、")}</dd>
                <dt>常见误读</dt><dd>{p.card.misreadings.join("；")}</dd>
                {p.card.prerequisites && <><dt>先备知识</dt><dd>{p.card.prerequisites}</dd></>}
                <dt>训练目标</dt><dd>{p.card.goals.join("、")}</dd>
              </dl>
            </div>
            <div className="card">
              <h3>回忆关键点</h3>
              <ol className="answer-key">
                {p.keyPoints.map((k, i) => (
                  <li key={i}>
                    {k.text} <span className="note">（第 {k.paragraph} 段）</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="grid g2" style={{ alignItems: "start", marginTop: 14 }}>
            <div className="card">
              <h3>预测题</h3>
              <ol className="answer-key"><McqAnswer m={p.predict} /></ol>
              <h3 style={{ marginTop: 14 }}>结构分析 · {KIND_LABEL[p.analysis.kind]}</h3>
              <p className="note">{p.analysis.intro}</p>
              <AnswerKey a={p.analysis} />
            </div>
            <div className="card">
              <h3>参考摘要</h3>
              <p style={{ fontFamily: "var(--f-read)", lineHeight: 1.9, color: "var(--ink)" }}>{p.refSummary}</p>
              {p.transfer && (
                <>
                  <h3 style={{ marginTop: 14 }}>迁移题</h3>
                  <p>{p.transfer}</p>
                </>
              )}
              <p className="note" style={{ marginTop: 10 }}>表达方式：{p.expressMode === "rewrite" ? "改写有错误的 AI 摘要" : "3–5 句摘要"}</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
