// 领域常量与类型：六项能力、六级量表、训练步骤、题型规格。
// 与 src/db/schema.ts 中的枚举保持一致。

export const ABILITIES = ["FOCUS", "RECALL", "COMPREHEND", "ANALYZE", "VERIFY", "EXPRESS"] as const;
export type AbilityKey = (typeof ABILITIES)[number];

export const LEVELS = ["L1", "L2", "L3", "L4", "L5", "L6"] as const;
export type LevelKey = (typeof LEVELS)[number];

export const STEPS = ["PREDICT", "READ", "RECALL", "ANALYZE", "EXPRESS", "FEEDBACK"] as const;
export type StepKey = (typeof STEPS)[number];

export const STEP_LABEL: Record<StepKey, string> = {
  PREDICT: "目标与预测",
  READ: "专注阅读",
  RECALL: "合书回忆",
  ANALYZE: "结构分析",
  EXPRESS: "表达迁移",
  FEEDBACK: "反馈复习",
};

export const ABILITY_META: Record<AbilityKey, { name: string; desc: string; pisa: string }> = {
  FOCUS: { name: "专注", desc: "能不被打断地读完一篇 600 字材料，读后知道自己有没有走神", pisa: "阅读流畅性" },
  RECALL: { name: "回忆", desc: "合上原文后，能说出主旨和至少两个支持理由；一周后仍记得", pisa: "定位信息" },
  COMPREHEND: { name: "理解", desc: "能说清段落之间的关系和文中的因果链", pisa: "理解 · 整合推理" },
  ANALYZE: { name: "分析", desc: "能区分主张、理由、证据和限定条件，识别常见推理错误", pisa: "评价与反思" },
  VERIFY: { name: "核查", desc: "能对照原文发现 AI 摘要中的夸大、数字错误和编造", pisa: "多源 · 可信度" },
  EXPRESS: { name: "表达", desc: "能用 3–5 句话写出准确摘要，并把方法用到新例子上", pisa: "理解 · 反思" },
};

export const LEVEL_META: Record<LevelKey, { name: string; stage: string; length: string; structure: string; inference: string }> = {
  L1: { name: "起步", stage: "小学五六年级 / 初一入门", length: "300–400 字", structure: "总分或并列，单一结构", inference: "信息多为显性" },
  L2: { name: "基础", stage: "初一", length: "400–600 字", structure: "两层结构，有过渡段", inference: "1 处需要连接两段" },
  L3: { name: "发展", stage: "初二", length: "500–800 字", structure: "因果链、对比，含数据", inference: "跨段推理，有限定条件" },
  L4: { name: "熟练", stage: "初三", length: "700–900 字", structure: "议论文含让步与反驳，或双文本", inference: "识别隐含假设、比较立场" },
  L5: { name: "精通", stage: "高中", length: "900–1500 字 / 多源", structure: "学术短论、多篇材料", inference: "评价论证强度与来源可信度" },
  L6: { name: "研究", stage: "高中拓展 / 大学入门", length: "1000–2500 字 / 多源", structure: "跨学科长文、研究摘要与数据", inference: "评价方法局限、证据边界与适用条件" },
};

/** 六项能力 × 六级行为描述（与方案文档第 7 节一致） */
export const LEVEL_DESCRIPTORS: Record<AbilityKey, Record<LevelKey, string>> = {
  FOCUS: {
    L1: "一次读完 400 字，不中途离开",
    L2: "读完 600 字，能说出自己在哪里走神",
    L3: "读完 800 字，回看不超过 2 次",
    L4: "带着问题读 900 字议论文，只标注相关句",
    L5: "规划多源材料的阅读顺序，分段完成",
    L6: "规划多源阅读顺序，设定问题并按计划完成长文",
  },
  RECALL: {
    L1: "合书说出主旨",
    L2: "主旨 + 1 个理由，关键点覆盖 ≥ 40%",
    L3: "主旨 + 2 个理由，覆盖 ≥ 60%，次日再提取 ≥ 50%",
    L4: "覆盖 ≥ 70%，7 天后再提取 ≥ 50%",
    L5: "多篇混合回忆，覆盖 ≥ 70%",
    L6: "跨多篇材料重建共同结论与分歧，延时回忆覆盖 ≥ 80%",
  },
  COMPREHEND: {
    L1: "说出每段大意",
    L2: "找出总分、并列等段落关系",
    L3: "画出 3 环以上的因果链",
    L4: "说明限定词如何改变结论",
    L5: "整合多源信息形成自己的解释",
    L6: "整合不同方法与背景下的证据，解释结果为何分歧",
  },
  ANALYZE: {
    L1: "区分事实与看法",
    L2: "找出主张和理由",
    L3: "区分理由与证据，识别以偏概全",
    L4: "识别相关当因果、偷换概念，评价让步",
    L5: "评价论证强度，指出隐含假设",
    L6: "评价研究设计、替代解释、推论边界与隐含假设",
  },
  VERIFY: {
    L1: "找出与原文矛盾的句子",
    L2: "找出数字错误",
    L3: "识别夸大结论与编造内容",
    L4: "核查 AI 摘要中的 5 类错误并给出原文依据",
    L5: "多源交叉核查，评价来源可信度",
    L6: "追溯原始来源，核查样本、方法与数据并标明不确定性",
  },
  EXPRESS: {
    L1: "1–2 句说清主旨",
    L2: "3 句摘要，不照抄原句",
    L3: "3–5 句摘要，量表 ≥ 4 / 6",
    L4: "量表 ≥ 5 / 6，迁移题能说明理由",
    L5: "写 200 字简报，含对反方的回应",
    L6: "写有来源依据与局限说明的多源综合简报",
  },
};

export type TutorRoleKey = "READING" | "RECALL_COACH" | "DEBATE" | "VERIFY";
export const TUTOR_ROLE_LABEL: Record<TutorRoleKey, string> = {
  READING: "阅读导师",
  RECALL_COACH: "回忆教练",
  DEBATE: "论证对练",
  VERIFY: "核查陪练",
};

export interface Mcq {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export type AnalysisSpec =
  | { kind: "roles"; intro: string; roles: string[]; items: { paragraph: number; answer: number }[]; mcq?: Mcq }
  | { kind: "audit"; intro: string; label: string; types: string[]; clauses: { text: string; answer: number; explanation: string }[] }
  | { kind: "quiz"; intro: string; questions: (Mcq & { paragraph: number })[]; selfCheck?: boolean }
  | { kind: "sequence"; intro: string; steps: string[]; mcq?: Mcq };

export interface KeyPointSpec {
  text: string;
  keywords: string[];
  paragraph: number; // 1-based
}

export interface PassageSpec {
  slug: string;
  title: string;
  genre: string;
  grade: string;
  level: LevelKey;
  primaryAbility: AbilityKey;
  /** 结构分析一步所训练的能力 */
  analysisAbility: AbilityKey;
  tutorRole: TutorRoleKey;
  lead: string;
  paragraphs: string[];
  card: {
    source: string;
    structure: string;
    concepts: string[];
    thesisLocation: string;
    misreadings: string[];
    prerequisites?: string;
    goals: string[];
  };
  keyPoints: KeyPointSpec[];
  predict: Mcq;
  analysis: AnalysisSpec;
  /** 迁移题；为空时表达一步只写摘要 */
  transfer: string | null;
  /** summary = 写摘要；rewrite = 改写有错误的 AI 摘要 */
  expressMode: "summary" | "rewrite";
  refSummary: string;
}

export const charCount = (p: Pick<PassageSpec, "lead" | "paragraphs">) =>
  p.paragraphs.join("").replace(/\s/g, "").length + p.lead.length;
