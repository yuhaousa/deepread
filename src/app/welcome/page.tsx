// 公开落地页：未登录访客的首页。内容全部来自静态材料与领域常量，不依赖数据库。
import Link from "next/link";
import { PASSAGES } from "@/content/passages";
import { ABILITIES, ABILITY_META, LEVELS, LEVEL_META, STEPS, STEP_LABEL, TUTOR_ROLE_LABEL, type StepKey } from "@/lib/domain";

export const metadata = { title: "深读 DeepRead · AI 时代的深度阅读训练" };

const STEP_DETAIL: Record<StepKey, [string, string]> = {
  PREDICT: ["读标题导语，预测结构，写一个问题", "1–2 分钟"],
  READ: ["带着问题标记，记录用时与回看", "4–8 分钟"],
  RECALL: ["隐藏原文，主动提取主旨与证据", "3–4 分钟"],
  ANALYZE: ["段落作用、论证要素、AI 摘要核查", "3–4 分钟"],
  EXPRESS: ["3–5 句摘要，回答迁移题", "3–5 分钟"],
  FEEDBACK: ["一条改进建议，次日、一周后再提取", "1–2 分钟"],
};

const ROLES = [
  { k: "READING", d: "阅读中按需提问：这一段在全文中起什么作用？哪个词是限定条件？" },
  { k: "RECALL_COACH", d: "对照关键点评价回忆，只给线索词，不复述原文。" },
  { k: "DEBATE", d: "扮演持不同意见的同学，追问“依据在哪”“有没有反例”。" },
  { k: "VERIFY", d: "给出带错误的 AI 摘要，陪学生回到原文逐句核查。" },
] as const;

const AUDIENCES = [
  { h: "学生", p: "每天一篇 300–1500 字的分级短文，六步练完。看得到自己每项能力的等级和下一级要做到什么。" },
  { h: "教师", p: "一键布置材料，系统汇总全班共性错误、分组建议和需要关注的学生，下节课讲什么一目了然。" },
  { h: "家长", p: "不看分数排名，只看作品对比和一个陪练问题：今天读的文章，作者最想让你相信什么？" },
];

export default function Welcome() {
  const byLevel = LEVELS.map((l) => ({ level: l, items: PASSAGES.filter((p) => p.level === l) }));

  return (
    <div className="landing">
      <section className="hero">
        <div>
          <div className="eyebrow">AI 时代的深度阅读与判断力训练</div>
          <h1>
            读懂原文，
            <br />
            才能<em>读懂 AI</em>。
          </h1>
          <p className="lede">
            深读是面向初中到高中学生的阅读训练平台。每天一篇短文、15–25 分钟，用六步闭环练出四件事：抓得住重点、记得住、讲得清，还能核查 AI 给出的答案。AI 只做导师——给提示，不给答案。
          </p>
          <div className="cta">
            <Link className="btn green" href="/login">
              登录开始训练
            </Link>
            <a className="btn ghost" href="#loop">
              看看一节课怎么上
            </a>
          </div>
          <div className="stats">
            <div>
              <b>{PASSAGES.length}</b>
              <span>篇分级原创材料</span>
            </div>
            <div>
              <b>{LEVELS.length}</b>
              <span>级能力量表 L1–L5</span>
            </div>
            <div>
              <b>{ABILITIES.length}</b>
              <span>项可观察的阅读能力</span>
            </div>
            <div>
              <b>15–25</b>
              <span>分钟 / 每日训练</span>
            </div>
          </div>
        </div>
        <div className="sheet" aria-label="训练界面示意">
          <div className="note sheet-cap">第 3 步 · 合书回忆前的阅读页</div>
          郊区多是农田、树林和水面，植物通过蒸腾作用把水分散发到空气中，这个过程会带走热量；
          <mark>城市里则铺满了沥青、水泥和砖石，它们白天大量吸收太阳辐射，夜晚再慢慢把热量释放出来。</mark>
          <div className="q">
            <b>AI 导师</b>　你标出了“夜晚释放热量”。想一想，这能解释热岛为什么在夜晚更明显吗？先别回看，用自己的话说说。
          </div>
        </div>
      </section>

      <section className="sec" id="loop">
        <div className="eyebrow">每日训练闭环</div>
        <h2>一节课，六步完成</h2>
        <p className="lede">第 3 步“合书回忆”是闭环的中心。主动检索与间隔复习，是学习科学中证据最强的两项策略。</p>
        <div className="loop">
          {STEPS.map((s) => (
            <div key={s}>
              <b>{STEP_LABEL[s]}</b>
              <span>{STEP_DETAIL[s][0]}</span>
              <i>{STEP_DETAIL[s][1]}</i>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="eyebrow">能力模型</div>
        <h2>六项能力，每项都写成看得见的行为</h2>
        <p className="lede">平台不给“脑力总分”，也不出排行榜，只报告每项能力在具体任务上做到了什么。</p>
        <div className="ability">
          {ABILITIES.map((a) => (
            <div className="card" key={a}>
              <span className="k">{ABILITY_META[a].name}</span>
              <p>{ABILITY_META[a].desc}</p>
              <small>PISA · {ABILITY_META[a].pisa}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="eyebrow">分级内容库</div>
        <h2>从小学高年级到高中，五级材料逐步加难</h2>
        <p className="lede">每篇材料都有内容卡片、关键点和有原文依据的题目，按篇幅、结构和推理难度分级。</p>
        <div className="levels-grid">
          {byLevel.map(({ level, items }) => (
            <div className="card lvl-card" key={level}>
              <div className="lvl-head">
                <span className="lvl on">{level}</span>
                <b>{LEVEL_META[level].name}</b>
                <span className="note">{LEVEL_META[level].stage}</span>
              </div>
              <p className="note">
                {LEVEL_META[level].length} · {LEVEL_META[level].structure}
              </p>
              <ul>
                {items.map((p) => (
                  <li key={p.slug}>
                    <span>{p.title}</span>
                    <span className="tag g">{ABILITY_META[p.primaryAbility].name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="sec roles">
        <div className="eyebrow">AI 导师</div>
        <h2>四种角色，同一条护栏：给提示，不给答案</h2>
        <div className="grid g4">
          {ROLES.map((r) => (
            <div className="card" key={r.k}>
              <h3>{TUTOR_ROLE_LABEL[r.k]}</h3>
              <p>{r.d}</p>
            </div>
          ))}
        </div>
        <p className="note">每条导师回复都会经过规则检测：复述原文、说出关键点或直接给答案，都会被替换为按步骤准备的提示。浏览器端拿不到任何答案。</p>
      </section>

      <section className="sec">
        <div className="eyebrow">三端</div>
        <h2>学生练、教师看、家长陪</h2>
        <div className="grid g3">
          {AUDIENCES.map((a) => (
            <div className="card" key={a.h}>
              <h3>{a.h}</h3>
              <p>{a.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="card closing">
          <div>
            <h2>今天读一篇，试试看</h2>
            <p>
              演示账号：学生 <code>student</code> · 教师 <code>teacher</code> · 管理员 <code>admin</code>，密码均为 <code>Bamboo123</code>。
            </p>
          </div>
          <Link className="btn green" href="/login">
            登录
          </Link>
        </div>
      </section>

      <footer className="note landing-foot">深读 DeepRead · 课文均为平台编辑原创教学材料</footer>
    </div>
  );
}
