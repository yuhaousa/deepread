"use client";

import { useState } from "react";

type Item = { id: string; title: string; cue: string; intervalD: number };

export function ReviewList({ items }: { items: Item[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, { passed: boolean; keyPoint: string } | string>>({});

  if (!items.length) return <div className="empty" style={{ marginTop: 20 }}>今天没有到期的复习。</div>;

  return (
    <div className="grid" style={{ marginTop: 20, maxWidth: 720 }}>
      {items.map((it) => {
        const r = results[it.id];
        return (
          <div className="card review-card" key={it.id}>
            <div className="meta" style={{ display: "flex", gap: 6 }}>
              <span className="tag">{it.title}</span>
              <span className="tag o">{it.intervalD === 1 ? "次日再提取" : it.intervalD === 7 ? "7 天再提取" : "补充复习"}</span>
            </div>
            <b style={{ fontSize: 16 }}>{it.cue}</b>
            {typeof r === "object" ? (
              <div className="fb">
                <h5>{r.passed ? "记得很牢" : "这次没想起来，两天后再试一次"}</h5>
                <p>原文要点：{r.keyPoint}</p>
              </div>
            ) : (
              <>
                <textarea style={{ minHeight: 70 }} value={answers[it.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [it.id]: e.target.value })} placeholder="用自己的话写下来" maxLength={500} />
                {typeof r === "string" && <p className="err-msg">{r}</p>}
                <button
                  className="btn green"
                  style={{ justifySelf: "start" }}
                  onClick={async () => {
                    const res = await fetch(`/api/reviews/${it.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answer: answers[it.id] ?? "" }) });
                    const data = await res.json();
                    setResults({ ...results, [it.id]: res.ok ? data : (data.error ?? "提交失败") });
                  }}
                >
                  提交
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
