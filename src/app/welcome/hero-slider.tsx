"use client";
// 落地页首屏轮播：四张幻灯片，背景缓慢平移，自动切换。
// 可暂停（按钮 / 悬停 / 聚焦 / 标签页隐藏）；支持方向键与滑动；减少动态效果时不自动播放、不平移。

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const INTERVAL_MS = 7000;

interface Slide {
  key: string;
  glyph: string; // 背景大字
  scene: "ink" | "bamboo" | "dusk" | "night";
  eyebrow: string;
  title: ReactNode;
  body: string;
  visual: ReactNode;
}

const SLIDES: Slide[] = [
  {
    key: "read",
    glyph: "读",
    scene: "ink",
    eyebrow: "AI 时代的深度阅读与判断力训练",
    title: (
      <>
        读懂原文，
        <br />
        才能<em>读懂 AI</em>。
      </>
    ),
    body: "每天一篇 300–1500 字的分级短文，15–25 分钟走完六步闭环。AI 只做导师：给提示，不给答案。",
    visual: (
      <div className="hs-card sheet-like">
        <div className="hs-cap">第 2 步 · 专注阅读</div>
        <p>
          郊区多是农田、树林和水面，植物通过蒸腾作用带走热量；
          <mark>城市里则铺满了沥青、水泥和砖石，它们白天大量吸收太阳辐射，夜晚再慢慢释放出来。</mark>
        </p>
        <div className="hs-tip">
          <b>AI 导师</b>　你标出了“夜晚释放热量”。这能解释热岛为什么在夜晚更明显吗？先别回看。
        </div>
      </div>
    ),
  },
  {
    key: "recall",
    glyph: "忆",
    scene: "bamboo",
    eyebrow: "第 3 步 · 合书回忆",
    title: (
      <>
        合上书，
        <br />
        你还<em>记得多少</em>？
      </>
    ),
    body: "原文收起后主动提取主旨与证据，次日、一周后再提取一次。主动检索与间隔复习，是学习科学中证据最强的两项策略。",
    visual: (
      <div className="hs-card">
        <div className="hs-cap">原文已收起 · 共 6 段</div>
        <div className="hs-lines" aria-hidden>
          <i style={{ width: "92%" }} />
          <i style={{ width: "78%" }} />
          <i style={{ width: "85%" }} />
          <i style={{ width: "40%" }} />
        </div>
        <div className="hs-meter">
          <span>回忆覆盖 4 / 6 个关键点</span>
          <div className="hs-dots" aria-hidden>
            {[1, 1, 1, 1, 0, 0].map((on, i) => (
              <i key={i} className={on ? "on" : ""} />
            ))}
          </div>
        </div>
        <div className="hs-tip">
          <b>回忆教练</b>　三条原因都写到了。想想第 5 段讲的是哪一类事情？
        </div>
      </div>
    ),
  },
  {
    key: "verify",
    glyph: "辨",
    scene: "dusk",
    eyebrow: "第 4 步 · 核查 AI 摘要",
    title: (
      <>
        一段 AI 摘要，
        <br />
        藏着<em>几处错</em>？
      </>
    ),
    body: "对照原文逐句核查：夸大结论、数字错误、与原文矛盾、凭空编造。先读完原文，再决定信不信 AI。",
    visual: (
      <div className="hs-card">
        <div className="hs-cap">由 AI 生成的摘要 · 请逐句核查</div>
        <ul className="hs-audit">
          <li>
            <span>初二（3）班做了一个为期两周的实验。</span>
            <em className="ok">准确</em>
          </li>
          <li>
            <span>实验证明，午睡可以显著提高记忆力。</span>
            <em className="bad">夸大结论</em>
          </li>
          <li>
            <span>午睡组的成绩比自习组高出近 30%。</span>
            <em className="bad">数字错误</em>
          </li>
          <li>
            <span>学校因此要求全体学生午睡。</span>
            <em className="bad">编造</em>
          </li>
        </ul>
      </div>
    ),
  },
  {
    key: "levels",
    glyph: "阶",
    scene: "night",
    eyebrow: "五级能力量表",
    title: (
      <>
        从 L1 到 L5，
        <br />
        <em>一级一级</em>读上去。
      </>
    ),
    body: "专注、回忆、理解、分析、核查、表达，六项能力分别定级。连续四次达标、复习也过关，才会升到下一级。",
    visual: (
      <div className="hs-card">
        <div className="hs-cap">分级路径</div>
        <ol className="hs-ladder">
          {[
            ["L1", "起步", "小学高年级"],
            ["L2", "基础", "初一"],
            ["L3", "发展", "初二"],
            ["L4", "熟练", "初三"],
            ["L5", "精通", "高中"],
          ].map(([l, n, s], i) => (
            <li key={l} style={{ marginLeft: `${i * 9}%` }}>
              <b>{l}</b>
              <span>{n}</span>
              <small>{s}</small>
            </li>
          ))}
        </ol>
      </div>
    ),
  },
];

export function HeroSlider() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false); // 用户点了暂停
  const [held, setHeld] = useState(false); // 悬停 / 聚焦 / 标签页隐藏时临时停住
  const [reduced, setReduced] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = SLIDES.length;

  const go = useCallback((i: number) => setActive(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    const vis = () => setHeld(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      mq.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const playing = !paused && !held && !reduced;
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => go(active + 1), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [playing, active, go]);

  return (
    <section
      className={`hero-slider${reduced ? " still" : ""}`}
      aria-roledescription="carousel"
      aria-label="深读介绍"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(active + 1);
        else if (e.key === "ArrowLeft") go(active - 1);
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(active + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      <div className="hs-track" style={{ transform: `translateX(-${active * 100}%)` }} aria-live={playing ? "off" : "polite"}>
        {SLIDES.map((s, i) => (
          <div
            key={s.key}
            className={`hs-slide scene-${s.scene}${i === active ? " on" : ""}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${count}`}
            aria-hidden={i !== active}
            inert={i !== active}
          >
            <div className="hs-bg" aria-hidden>
              <span className="hs-glyph">{s.glyph}</span>
              <span className="hs-glow" />
            </div>
            <div className="hs-inner wrap">
              <div className="hs-copy">
                <div className="hs-eyebrow">{s.eyebrow}</div>
                <h1>{s.title}</h1>
                <p>{s.body}</p>
                <div className="hs-cta">
                  <Link className="btn hs-primary" href="/login">
                    登录开始训练
                  </Link>
                  <a className="btn hs-ghost" href="#loop">
                    看看一节课怎么上
                  </a>
                </div>
              </div>
              <div className="hs-visual">{s.visual}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hs-controls wrap">
        <button className="hs-arrow" onClick={() => go(active - 1)} aria-label="上一张">
          ‹
        </button>
        <div className="hs-dots-nav" role="tablist" aria-label="选择幻灯片">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={i === active}
              aria-label={`第 ${i + 1} 张：${s.eyebrow}`}
              onClick={() => go(i)}
              className={i === active ? "on" : ""}
            >
              {/* key 变化时重启进度动画 */}
              <i key={`${active}-${playing}`} style={{ animationDuration: `${INTERVAL_MS}ms`, animationPlayState: playing ? "running" : "paused" }} />
            </button>
          ))}
        </div>
        <button className="hs-arrow" onClick={() => go(active + 1)} aria-label="下一张">
          ›
        </button>
        {!reduced && (
          <button className="hs-pause" onClick={() => setPaused(!paused)} aria-label={paused ? "继续自动播放" : "暂停自动播放"}>
            {paused ? "▶" : "❚❚"}
          </button>
        )}
      </div>
    </section>
  );
}
