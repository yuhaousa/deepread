import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "关于我们 · 诺雅深读",
  description: "了解诺雅深读的阅读训练方法与核心设计理念。",
};

const PRINCIPLES = [
  { number: "01", title: "先读原文，再判断", text: "把注意力放回作者真正写下的内容，辨认观点、依据和限定条件。" },
  { number: "02", title: "合上书，主动回忆", text: "读完后尝试不看原文说出主旨和证据，再通过间隔复习加深记忆。" },
  { number: "03", title: "AI 给提示，不给答案", text: "AI 导师用问题和线索陪伴练习，帮助学习者自己核对、推理和表达。" },
];

const STEPS = ["目标与预测", "专注阅读", "合书回忆", "结构分析", "表达迁移", "反馈复习"];

export default function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-copy">
          <div className="eyebrow">关于诺雅深读</div>
          <h1>读懂原文，<br />也读懂 AI。</h1>
          <p>诺雅深读是一款面向学生与教师的深度阅读训练平台。我们希望帮助每位学习者读得专注、记得牢、想得清，并能对 AI 提供的信息作出判断。</p>
          <div className="about-actions">
            <Link className="btn green" href="/login">开始体验</Link>
            <Link className="btn ghost" href="/welcome">回到首页</Link>
          </div>
        </div>
        <div className="about-hero-note" aria-label="诺雅深读的核心理念">
          <span>核心理念</span>
          <strong>读原文<br />· 回忆<br />· 核查<br />· 表达</strong>
          <small>让理解来自自己，而不只来自答案。</small>
        </div>
      </section>

      <section className="sec about-section">
        <div className="eyebrow">我们的设计理念</div>
        <h2>技术辅助思考，不代替思考</h2>
        <p className="lede">阅读能力来自主动练习。平台把一篇文章拆成清晰、可重复的行动，并让 AI 在恰当的位置提供提示。</p>
        <div className="about-principles">
          {PRINCIPLES.map((item) => (
            <article className="card about-principle" key={item.number}>
              <span className="about-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sec about-section">
        <div className="eyebrow">一套完整的阅读练习</div>
        <h2>六步走完，从理解到表达</h2>
        <p className="lede">每次训练约 15–25 分钟：带着问题阅读，主动提取重点，最后把理解迁移到自己的表达中。</p>
        <ol className="about-steps">
          {STEPS.map((step, index) => (
            <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><b>{step}</b></li>
          ))}
        </ol>
      </section>

      <section className="sec about-section about-belief">
        <div>
          <div className="eyebrow">成长观</div>
          <h2>关注每一步的进步</h2>
          <p className="lede">诺雅深读围绕专注、回忆、理解、分析、核查和表达六项能力提供分级练习。反馈帮助学习者找到下一步，不用单一总分或排名定义阅读能力。</p>
        </div>
        <div className="about-ability-list" aria-label="六项阅读能力">
          {["专注", "回忆", "理解", "分析", "核查", "表达"].map((ability, index) => (
            <span key={ability}><i>{index + 1}</i>{ability}</span>
          ))}
        </div>
      </section>

    </div>
  );
}

