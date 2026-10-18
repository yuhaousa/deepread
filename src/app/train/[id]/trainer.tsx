"use client";

// 训练闭环（学生端）：六步，每步的作答都提交到服务器评分；
// 浏览器拿到的材料不含答案，答案与解析只在提交后由服务器返回。

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { STEP_LABEL, STEPS, type StepKey } from "@/lib/domain";
import { LEARNING_MODES, MODE_SPECS, type LearningMode } from "@/lib/modes";
import type { ClientPassage } from "@/server/content";
import type { AnalysisResult } from "@/server/assessment/rules";

type RecallResult = {
  total: number;
  coverage: number;
  calibration: string;
  selfPercent: number;
  points: ({ covered: true; text: string } | { covered: false; hint: string })[];
  ai: { feedback: string; misconception: string } | null;
};
type SummaryResult = {
  rubric: { main: number; relation: number; selection: number; total: number; praise: string; issue: string; transfer: string; nextStep: string } | null;
  refSummary: string;
};
type Complete = {
  metrics: { readingSeconds: number | null; charsPerMinute: number | null; recallHits: number; keyPointCount: number; efficiency: number | null; analysisCorrect: number | null; analysisTotal: number | null; analysisLabel: string; rubricTotal: number | null };
  tip: { ability: string; tip: string };
  question: string | null;
  reviews: { nextDay: { dueAt: string | null; items: number }; week: { dueAt: string | null; items: number } };
  levelChanges: { ability: string; to: string }[];
};

const ABILITY_NAME: Record<string, string> = { FOCUS: "专注", RECALL: "回忆", COMPREHEND: "理解", ANALYZE: "分析", VERIFY: "核查", EXPRESS: "表达" };

async function api<T>(url: string, method: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data: data as T } : { ok: false, error: (data as { error?: string }).error ?? "请求失败" };
}

const splitSentences = (p: string) => p.split(/(?<=[。！？])/).filter(Boolean);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }) : "—");

export function Trainer({
  sessionId,
  passage,
  initialStep,
  initialQuestion,
  initialHighlights,
  initialMode,
}: {
  sessionId: string;
  passage: ClientPassage;
  initialStep: StepKey | "DONE";
  initialQuestion: string | null;
  initialHighlights: string[];
  initialMode: LearningMode;
}) {
  const startIndex = initialStep === "DONE" ? 5 : STEPS.indexOf(initialStep);
  const [step, setStep] = useState(Math.max(0, startIndex));
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [pred, setPred] = useState<number | null>(null);
  const [predFb, setPredFb] = useState<{ correct: boolean; explanation: string } | null>(null);
  const [hl, setHl] = useState<Set<string>>(new Set(initialHighlights));
  const [readSecs, setReadSecs] = useState(0);
  const t0 = useRef<number | null>(null);
  const [conf, setConf] = useState(3);
  const [recall, setRecall] = useState("");
  const [recallRes, setRecallRes] = useState<RecallResult | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, number | null>>({});
  const [order, setOrder] = useState<number[]>(passage.analysis.kind === "sequence" ? passage.analysis.steps.map((s) => s.id) : []);
  const [analysisRes, setAnalysisRes] = useState<AnalysisResult | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [summary, setSummary] = useState("");
  const [transfer, setTransfer] = useState("");
  const [sumRes, setSumRes] = useState<SummaryResult | null>(null);
  const [mode, setMode] = useState<LearningMode>(initialMode);
  const [extra, setExtra] = useState("");
  const spec = MODE_SPECS[mode];
  const [done, setDone] = useState<Complete | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);

  const stepKey = STEPS[step];

  async function go(n: number) {
    setError("");
    setStep(n);
    await api(`/api/sessions/${sessionId}`, "PATCH", { step: STEPS[n] });
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── 阅读计时 ──
  useEffect(() => {
    if (stepKey !== "READ") return;
    if (t0.current === null) t0.current = Date.now() - readSecs * 1000;
    const timer = setInterval(() => setReadSecs(Math.round((Date.now() - (t0.current ?? Date.now())) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [stepKey, readSecs]);

  // 进入“反馈复习”且尚未结算时，自动结算
  useEffect(() => {
    if (stepKey !== "FEEDBACK" || done) return;
    (async () => {
      const r = await api<Complete>(`/api/sessions/${sessionId}/complete`, "POST");
      if (r.ok) setDone(r.data);
      else setError(r.error);
    })();
  }, [stepKey, done, sessionId]);

  async function changeMode(next: LearningMode) {
    setMode(next);
    await api(`/api/sessions/${sessionId}`, "PATCH", { mode: next });
  }

  const head = (title: string, why: string) => (
    <>
      <h3>{title}</h3>
      <p className="why">{why}</p>
      {spec.tips[stepKey] && (
        <p className="mode-tip">
          <b>{spec.label}</b>　{spec.tips[stepKey]}
        </p>
      )}
    </>
  );

  function StepPredict() {
    return (
      <>
        {head("第 1 步 · 目标与预测", "读之前先预测结构、提出问题，阅读时注意力会更有方向。")}
        <div className="reading">
          <h4>{passage.title}</h4>
          <p className="lead" style={{ textIndent: 0 }}>{passage.lead}</p>
        </div>
        <div className="field">
          <span>{passage.predict.question}</span>
          <div className="opt">
            {passage.predict.options.map((t, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name="pred"
                  checked={pred === i}
                  onChange={async () => {
                    setPred(i);
                    const r = await api<{ predict: { correct: boolean; explanation: string } }>(`/api/sessions/${sessionId}`, "PATCH", { predictChoice: i });
                    if (r.ok) setPredFb(r.data.predict);
                  }}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>
        {predFb && (
          <div className="fb">
            <h5>{predFb.correct ? "预测合理" : "可以再想想"}</h5>
            <p>{predFb.explanation}</p>
          </div>
        )}
        <div className="field">
          <span>写下一个你读完后想弄清楚的问题</span>
          <small>读完后系统会请你回头看看，这个问题有没有得到回答。</small>
          <textarea style={{ minHeight: 70 }} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={300} />
        </div>
        <div className="bar">
          <span className="note">约 1–2 分钟</span>
          <button
            className="btn sp"
            onClick={async () => {
              if (pred === null) return setError("先选一个预测，再开始阅读。");
              await api(`/api/sessions/${sessionId}`, "PATCH", { question });
              go(1);
            }}
          >
            开始阅读
          </button>
        </div>
      </>
    );
  }

  function StepRead() {
    const toggle = (key: string) =>
      setHl((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    return (
      <>
        {head("第 2 步 · 专注阅读", "点击句子做标记，只标与你的问题有关的内容。读完后原文会被收起。")}
        <div className="reading">
          <h4>{passage.title}</h4>
          <p className="lead" style={{ textIndent: 0 }}>{passage.lead}</p>
          {passage.paragraphs.map((p, i) => (
            <p key={i}>
              <span className="pn">{i + 1}</span>
              {splitSentences(p).map((s, j) => {
                const key = `${i}-${j}`;
                const on = hl.has(key);
                return (
                  <span
                    key={key}
                    className={`s${on ? " hl" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-pressed={on}
                    onClick={() => toggle(key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(key);
                      }
                    }}
                  >
                    {s}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
        {question && (
          <div className="fb">
            <h5>你的阅读问题</h5>
            <p>{question}</p>
          </div>
        )}
        <div className="bar">
          <span className="timer">用时 {clock(readSecs)}</span>
          <span className="note">已标记 {hl.size} 句</span>
          <button
            className="btn sp"
            onClick={async () => {
              const secs = Math.max(20, readSecs);
              await api(`/api/sessions/${sessionId}`, "PATCH", { readingSeconds: secs, highlights: [...hl] });
              go(2);
            }}
          >
            读完了，收起原文
          </button>
        </div>
      </>
    );
  }

  function StepRecall() {
    return (
      <>
        {head("第 3 步 · 合书回忆", "先自己提取，再看反馈。这一步感觉吃力是正常的，越费力，记得越久。")}
        <div className="hidebox">
          原文已收起 · 共 {passage.paragraphs.length} 段 · 你标记了 {hl.size} 句
        </div>
        <div className="field">
          <span>先估一估：你觉得自己读懂了多少？</span>
          <div className="range">
            <span className="note">很少</span>
            <input type="range" min={1} max={5} value={conf} onChange={(e) => setConf(Number(e.target.value))} aria-label="自评读懂程度" />
            <span className="note">全部</span>
            <b>{conf}</b>
          </div>
        </div>
        <div className="field">
          <span>合书写下你记得的内容</span>
          <textarea value={recall} onChange={(e) => setRecall(e.target.value)} placeholder="不看原文，写下：这篇文章主要讲什么？作者给出了哪些原因、理由或证据？能写多少写多少。" maxLength={2000} />
        </div>
        {busy && <div className="fb ai"><p className="thinking">回忆教练正在对照关键点阅读你的回忆</p></div>}
        {recallRes && (
          <>
            <div className="fb">
              <h5>回忆覆盖 {recallRes.points.filter((p) => p.covered).length} / {recallRes.total} 个关键点</h5>
              <ul className="kp">
                {recallRes.points.map((p, i) => (
                  <li key={i} className={p.covered ? "hit" : ""}>
                    {p.covered ? p.text : `（未覆盖）${p.hint}`}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 13.5 }}>
                自评读懂 {recallRes.selfPercent}% · 实际覆盖 {Math.round(recallRes.coverage * 100)}%。{recallRes.calibration}
              </p>
            </div>
            {recallRes.ai && (
              <div className="fb ai">
                <h5>AI 回忆教练</h5>
                <p>{recallRes.ai.feedback}</p>
                {recallRes.ai.misconception && <p style={{ color: "var(--bad)", fontSize: 13.5 }}>需要再核对：{recallRes.ai.misconception}</p>}
              </div>
            )}
          </>
        )}
        <div className="bar">
          <button
            className="btn ghost"
            onClick={async () => {
              await api(`/api/sessions/${sessionId}`, "PATCH", { lookback: true });
              go(1);
            }}
          >
            返回原文（会计入回看）
          </button>
          <button
            className="btn green"
            disabled={busy}
            onClick={async () => {
              if (recall.trim().length < 15) return setError("再多写几句吧，至少写出主旨和一个原因或理由。");
              setBusy(true);
              setError("");
              const r = await api<RecallResult>(`/api/sessions/${sessionId}/recall`, "POST", { text: recall, confidence: conf });
              setBusy(false);
              if (r.ok) setRecallRes(r.data);
              else setError(r.error);
            }}
          >
            提交回忆
          </button>
          <button className="btn sp" disabled={!recallRes} onClick={() => go(3)}>
            下一步：结构分析
          </button>
        </div>
      </>
    );
  }

  function StepAnalyze() {
    const a = passage.analysis;
    const res = analysisRes;
    const itemClass = (k: number) => (res ? (res.items[k]?.correct ? "ok" : "no") : "");
    const sel = (key: string, options: string[], label: string) => (
      <select className="in" style={{ width: "100%", padding: 8 }} aria-label={label} value={analysis[key] ?? ""} onChange={(e) => setAnalysis({ ...analysis, [key]: e.target.value === "" ? null : Number(e.target.value) })}>
        <option value="">请选择…</option>
        {options.map((t, i) => (
          <option key={i} value={i}>
            {t}
          </option>
        ))}
      </select>
    );
    const mcqBlock = (mcq: { question: string; options: string[] }, key: string, k: number) => (
      <div className="field" key={key}>
        <span>{mcq.question}</span>
        <div className="opt">
          {mcq.options.map((t, i) => (
            <label key={i}>
              <input type="radio" name={key} checked={analysis[key] === i} onChange={() => setAnalysis({ ...analysis, [key]: i })} />
              <span>{t}</span>
            </label>
          ))}
        </div>
        {res && res.items[k] && (
          <div className="fb">
            <h5>{res.items[k].correct ? "正确" : "需要再想想"}</h5>
            {res.items[k].explanation && <p>{res.items[k].explanation}</p>}
          </div>
        )}
      </div>
    );

    async function submit() {
      let body: unknown;
      if (a.kind === "roles") body = { kind: "roles", roles: a.paragraphs.map((_, k) => analysis[`r${k}`] ?? null), mcq: a.mcq ? (analysis.mcq ?? null) : undefined };
      else if (a.kind === "audit") body = { kind: "audit", verdicts: a.clauses.map((_, k) => analysis[`v${k}`] ?? null) };
      else if (a.kind === "quiz") body = { kind: "quiz", answers: a.questions.map((_, k) => analysis[`q${k}`] ?? null), selfCheck: a.selfCheck ? (analysis.self ?? null) : undefined };
      else body = { kind: "sequence", order, mcq: a.mcq ? (analysis.mcq ?? null) : undefined };
      setBusy(true);
      const r = await api<AnalysisResult>(`/api/sessions/${sessionId}/analysis`, "POST", body);
      setBusy(false);
      if (r.ok) setAnalysisRes(r.data);
      else setError(r.error);
    }

    const move = (i: number, d: number) => {
      const j = i + d;
      if (j < 0 || j >= order.length) return;
      const next = [...order];
      [next[i], next[j]] = [next[j], next[i]];
      setOrder(next);
    };

    return (
      <>
        {head(a.kind === "audit" ? "第 4 步 · 核查 AI 摘要" : "第 4 步 · 结构分析", a.intro)}

        {a.kind === "roles" && (
          <>
            <div className="rows">
              {a.paragraphs.map((pn, k) => (
                <div key={k} className={`row ${itemClass(k)}`}>
                  <div className="ex">
                    <b>第 {pn} 段</b>
                    {passage.paragraphs[pn - 1].slice(0, 46)}……
                  </div>
                  {sel(`r${k}`, a.roles, `第 ${pn} 段的作用`)}
                  {res && !res.items[k].correct && <div className="exp">{res.items[k].explanation}</div>}
                </div>
              ))}
            </div>
            {a.mcq && mcqBlock(a.mcq, "mcq", a.paragraphs.length)}
          </>
        )}

        {a.kind === "audit" && (
          <>
            <div className="ai-sum">
              <span className="tagline">{a.label} · 请逐句核查</span>
              {a.clauses.join("")}
            </div>
            {showSource && (
              <div className="reading" style={{ marginTop: 14, fontSize: 15 }}>
                {passage.paragraphs.map((p, i) => (
                  <p key={i}>
                    <span className="pn">{i + 1}</span>
                    {p}
                  </p>
                ))}
              </div>
            )}
            <div className="rows" style={{ marginTop: 14 }}>
              {a.clauses.map((c, k) => (
                <div key={k} className={`row ${itemClass(k)}`}>
                  <div className="ex">
                    <b>第 {k + 1} 句</b>
                    {c}
                  </div>
                  {sel(`v${k}`, a.types, `核查第 ${k + 1} 句`)}
                  {res && <div className="exp">{(res.items[k].correct ? "✓ " : `参考：${a.types[res.items[k].expected]}。`) + (res.items[k].explanation ?? "")}</div>}
                </div>
              ))}
            </div>
          </>
        )}

        {a.kind === "quiz" && (
          <>
            {a.questions.map((q, k) => mcqBlock(q, `q${k}`, k))}
            {a.selfCheck && (
              <div className="field">
                <span>走神自查：读的时候，哪一段你最不专心？</span>
                <select className="in" value={analysis.self ?? ""} onChange={(e) => setAnalysis({ ...analysis, self: e.target.value === "" ? null : Number(e.target.value) })}>
                  <option value="">我一直很专注</option>
                  {passage.paragraphs.map((_, i) => (
                    <option key={i} value={i + 1}>
                      第 {i + 1} 段
                    </option>
                  ))}
                </select>
                {res?.selfCheck && <small>{res.selfCheck.consistent ? "你对自己注意力的判断和答题结果一致。" : "答错的题来自别的段落，那里你可能走神了却没有察觉。"}</small>}
              </div>
            )}
          </>
        )}

        {a.kind === "sequence" && (
          <>
            <div className="seq">
              {order.map((id, i) => {
                const text = a.steps.find((s) => s.id === id)!.text;
                // 核对后按“是否在正确位置”标色（id 即正确顺序中的序号）
                const mark = res ? (id === i ? "ok" : "no") : "";
                return (
                  <div key={id} className={`it ${mark}`}>
                    <b>{i + 1}</b>
                    {text}
                    <span className="mv">
                      <button aria-label="上移" onClick={() => move(i, -1)}>↑</button>
                      <button aria-label="下移" onClick={() => move(i, 1)}>↓</button>
                    </span>
                  </div>
                );
              })}
            </div>
            {a.mcq && mcqBlock(a.mcq, "mcq", a.steps.length - 1)}
          </>
        )}

        {res && (
          <div className="fb">
            <h5>
              {a.kind === "audit" ? "核查正确" : "答对"} {res.correct} / {res.total}
            </h5>
            {a.kind === "audit" && <p>AI 摘要最常见的三类问题：把结论说过头、算错或记错数字、补上原文没有的内容。核查时先回到原文找依据，再下判断。</p>}
          </div>
        )}
        <div className="bar">
          {a.kind === "audit" && (
            <button className="btn ghost" onClick={() => setShowSource(!showSource)}>
              {showSource ? "收起原文" : "对照原文"}
            </button>
          )}
          <button className="btn green" disabled={busy} onClick={submit}>
            核对
          </button>
          <button className="btn sp" disabled={!res} onClick={() => go(4)}>
            {passage.expressMode === "rewrite" ? "下一步：改写摘要" : "下一步：表达迁移"}
          </button>
        </div>
      </>
    );
  }

  function StepExpress() {
    const rewrite = passage.expressMode === "rewrite";
    const r = sumRes?.rubric;
    return (
      <>
        {head("第 5 步 · 表达与迁移", "用自己的话写，不照抄原句。摘要要有主旨、关键关系，并做取舍。")}
        <div className="field">
          <span>{rewrite ? "改写 AI 摘要：写一段准确的摘要（3–4 句），写出方法、结果和结论的边界" : "写一段 3–5 句的摘要"}</span>
          <small>评分量表：主旨准确 0–2 · 关系清楚 0–2 · 取舍得当 0–2</small>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={1500} />
        </div>
        {passage.transfer && (
          <div className="field">
            <span>迁移题</span>
            <p style={{ fontSize: 14.5 }}>{passage.transfer}</p>
            <textarea style={{ minHeight: 90 }} value={transfer} onChange={(e) => setTransfer(e.target.value)} placeholder="用文中的道理来回答…" maxLength={1500} />
          </div>
        )}
        {spec.extraTask && (
          <div className="field mode-task">
            <span>{spec.extraTask.label}</span>
            <small>{spec.extraTask.hint}</small>
            <textarea style={{ minHeight: 90 }} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={spec.extraTask.placeholder} maxLength={1500} />
          </div>
        )}
        {busy && <div className="fb ai"><p className="thinking">AI 导师正在按量表阅读你的摘要</p></div>}
        {sumRes && (
          <>
            {r ? (
              <div className="fb ai">
                <h5>
                  AI 导师 · 量表 {r.total} / 6（主旨 {r.main} · 关系 {r.relation} · 取舍 {r.selection}）
                </h5>
                {r.praise && <p>做得好：{r.praise}</p>}
                {r.issue && <p>可以改进：{r.issue}</p>}
                {r.transfer && <p>迁移题：{r.transfer}</p>}
                {r.nextStep && <p style={{ color: "var(--bamboo)" }}>下一步：{r.nextStep}</p>}
              </div>
            ) : (
              <div className="fb">
                <p className="note">当前未接入 AI 评分，请对照参考摘要和量表自查；老师抽检时会给出分数。</p>
              </div>
            )}
            <div className="fb">
              <h5>参考摘要（先写完自己的再看）</h5>
              <p style={{ fontFamily: "var(--f-read)", lineHeight: 1.9 }}>{sumRes.refSummary}</p>
              <p className="note">对照量表自查：主旨是否一句话说清？原因或理由之间的关系是否写出？有没有照抄原句或堆细节？</p>
            </div>
          </>
        )}
        <div className="bar">
          <button
            className="btn green"
            disabled={busy}
            onClick={async () => {
              if (summary.trim().length < 20) return setError("摘要还太短，至少写两三句。");
              setBusy(true);
              setError("");
              const res = await api<SummaryResult>(`/api/sessions/${sessionId}/summary`, "POST", { summary, transfer: passage.transfer ? transfer : null, extra: spec.extraTask ? extra : null });
              setBusy(false);
              if (res.ok) setSumRes(res.data);
              else setError(res.error);
            }}
          >
            提交摘要
          </button>
          <button className="btn sp" disabled={!sumRes} onClick={() => go(5)}>
            完成，看今日反馈
          </button>
        </div>
      </>
    );
  }

  function StepFeedback() {
    if (!done) return <p className="thinking">正在结算今日反馈</p>;
    const m = done.metrics;
    return (
      <>
        {head("第 6 步 · 今日反馈与复习", "只给一条最重要的建议，并把复习放进日程。")}
        {done.levelChanges.length > 0 && (
          <div className="levelup" style={{ marginBottom: 14 }}>
            升级了：{done.levelChanges.map((c) => `${ABILITY_NAME[c.ability]} → ${c.to}`).join("、")}。下一节会推送更高一级的材料。
          </div>
        )}
        <div className="score">
          <div><b>{m.readingSeconds ? clock(m.readingSeconds) : "—"}</b><span>阅读用时</span></div>
          <div><b>{m.charsPerMinute ?? "—"}</b><span>字 / 分钟</span></div>
          <div><b>{m.recallHits}/{m.keyPointCount}</b><span>合书回忆关键点</span></div>
          <div><b>{m.efficiency ?? "—"}</b><span>有效效率（关键点 / 分钟）</span></div>
          <div><b>{m.analysisCorrect ?? "—"}/{m.analysisTotal ?? "—"}</b><span>{m.analysisLabel}</span></div>
          <div><b>{m.rubricTotal != null ? `${m.rubricTotal}/6` : "—"}</b><span>摘要量表</span></div>
        </div>
        <div className="fb ai" style={{ marginTop: 18 }}>
          <h5>今天最重要的一条建议 · {ABILITY_NAME[done.tip.ability]}</h5>
          <p>{done.tip.tip}</p>
        </div>
        {done.question && (
          <div className="fb">
            <h5>回看你的阅读问题</h5>
            <p>{done.question}</p>
            <p className="note">文章回答了它吗？如果没有，这正是值得继续查资料的地方。</p>
          </div>
        )}
        <div className="field">
          <span>间隔复习已安排</span>
          <div className="review">
            <span className="tag o">{fmtDate(done.reviews.nextDay.dueAt)} · 再提取 {done.reviews.nextDay.items} 个关键点</span>
            <span className="tag">{fmtDate(done.reviews.week.dueAt)} · 与本周其他文章混合回忆</span>
          </div>
        </div>
        <p className="note" style={{ marginTop: 8 }}>
          说明：字 / 分钟只作参考。平台更看重“有效效率”，也就是单位时间内正确提取的关键点数。读得快但记不住，不算进步。
        </p>
        <div className="bar">
          <Link className="btn ghost" href="/report" style={{ textDecoration: "none" }}>看我的报告</Link>
          <Link className="btn sp" href="/" style={{ textDecoration: "none" }}>回到首页</Link>
        </div>
      </>
    );
  }

  const renderers = [StepPredict, StepRead, StepRecall, StepAnalyze, StepExpress, StepFeedback];
  const Current = renderers[step];

  return (
    <>
      <div className="eyebrow">
        {passage.genre} · {passage.grade} · {passage.level}
      </div>
      <h2 style={{ fontSize: 24, marginTop: 6, fontFamily: "var(--f-read)" }}>{passage.title}</h2>
      <div className="mode-bar">
        <span className="tag g">学习方式</span>
        <label className="mode-select">
          <span className="sr-only">切换学习方式</span>
          <select className="in compact" value={mode} onChange={(e) => changeMode(e.target.value as LearningMode)}>
            {LEARNING_MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_SPECS[m].label} · {MODE_SPECS[m].tagline}
              </option>
            ))}
          </select>
        </label>
        <span className="note">重点：{spec.focus.map((s) => STEP_LABEL[s]).join("、")}</span>
      </div>
      <div className="desk">
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s} className={`${i === step ? "on" : i < step ? "done" : ""}${spec.focus.includes(s) ? " focus" : ""}`}>
              <i>{i < step ? "✓" : i + 1}</i>
              <span>{STEP_LABEL[s]}</span>
              {spec.focus.includes(s) && <em className="focus-mark" aria-label="本方式重点">重点</em>}
            </li>
          ))}
        </ol>
        <div className="stage" ref={stageRef}>
          {/* 以函数调用渲染，避免每次重渲染时重建组件、丢失输入焦点 */}
          {Current()}
          {error && <p className="err-msg" style={{ marginTop: 10 }}>{error}</p>}
        </div>
      </div>
      {stepKey !== "FEEDBACK" && <Tutor key={mode} sessionId={sessionId} mode={mode} step={stepKey} />}
    </>
  );
}

function Tutor({ sessionId, mode, step }: { sessionId: string; mode: LearningMode; step: StepKey }) {
  const spec = MODE_SPECS[mode];
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<{ role: "u" | "a"; text: string }[]>([{ role: "a", text: spec.greeting }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: 1e6 });
  }, [msgs]);

  async function ask(q: string) {
    q = q.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "u", text: q }]);
    setInput("");
    setBusy(true);
    const r = await api<{ text: string }>("/api/tutor", "POST", { sessionId, message: q });
    setBusy(false);
    setMsgs((m) => [...m, { role: "a", text: r.ok ? r.data.text : r.error }]);
  }

  return (
    <>
      <button className="btn green tutor-btn" onClick={() => setOpen(!open)}>
        问{spec.label}
      </button>
      {open && (
        <div className="drawer" role="dialog" aria-label="AI 阅读导师">
          <header>
            <b>{spec.label}</b>
            <small>第 {STEPS.indexOf(step) + 1} 步 {STEP_LABEL[step]} · 给提示，不给答案 · 内容由 AI 生成</small>
          </header>
          <div>
            <div className="chat" ref={chatRef}>
              {msgs.map((m, i) => (
                <div key={i} className={`msg ${m.role}`}>{m.text}</div>
              ))}
              {busy && <div className="msg a thinking">想一想</div>}
            </div>
            <div className="chips">
              {spec.chips[step].map((c) => (
                <button key={c} type="button" onClick={() => ask(c)}>{c}</button>
              ))}
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="卡在哪里了？说说看" maxLength={300} />
            <button className="btn" disabled={busy}>发送</button>
          </form>
        </div>
      )}
    </>
  );
}
