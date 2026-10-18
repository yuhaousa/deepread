// 四种学习方式（对应四种 AI 导师角色）。学生开始训练时选择，决定导师人设、重点步骤、
// 每步提示与推荐问题，以及表达环节的附加任务和复习强度。浏览器与服务器共用。

import type { StepKey, TutorRoleKey } from "@/lib/domain";

export const LEARNING_MODES = ["READING", "RECALL_COACH", "DEBATE", "VERIFY"] as const satisfies readonly TutorRoleKey[];
export type LearningMode = (typeof LEARNING_MODES)[number];

export interface ModeSpec {
  label: string;
  tagline: string;
  description: string;
  /** 本方式重点训练的步骤（步骤条上标出） */
  focus: StepKey[];
  greeting: string;
  /** 每步顶部的方式提示 */
  tips: Partial<Record<StepKey, string>>;
  /** 导师抽屉里的推荐问题 */
  chips: Record<StepKey, string[]>;
  /** 表达环节的附加任务（论证对练、核查陪练） */
  extraTask?: { label: string; hint: string; placeholder: string };
}

export const MODE_SPECS: Record<LearningMode, ModeSpec> = {
  READING: {
    label: "阅读导师",
    tagline: "读中提示 · 读懂结构",
    description: "阅读时随时求助：这一段起什么作用？哪个词是限定条件？适合想把文章结构读清楚的时候。",
    focus: ["READ", "ANALYZE"],
    greeting: "我是你的阅读导师。读的时候卡在哪一段，就问我这一段在干什么，我会给你线索，不直接给答案。",
    tips: {
      PREDICT: "先看标题和导语，猜一猜全文分几部分。",
      READ: "每段先找第一句和关联词（首先、其次、但是、所以），标出你认为的中心句。",
      ANALYZE: "判断段落作用时，回想你在阅读时标出的中心句和关联词。",
    },
    chips: {
      PREDICT: ["这类文章一般怎么展开？"],
      READ: ["这一段在全文中起什么作用？", "这个词是什么意思？", "这段的中心句是哪句？"],
      RECALL: ["我想不起来了，给点线索"],
      ANALYZE: ["怎么判断段落的作用？", "哪些词能提示段落关系？"],
      EXPRESS: ["摘要怎么做取舍？"],
      FEEDBACK: [],
    },
  },
  RECALL_COACH: {
    label: "回忆教练",
    tagline: "合书回忆 · 记得更久",
    description: "重点练“合上书还记得”。复习安排更密：次日再提取 5 个关键点，第 3 天专门复习遗漏的内容。",
    focus: ["RECALL", "FEEDBACK"],
    greeting: "我是你的回忆教练。合书回忆时我只给线索词，不复述原文。先数一数文章讲了几件事，再一件件回想。",
    tips: {
      READ: "边读边在心里给每段起一个小标题，合书时按小标题回想。",
      RECALL: "先写出文章讲了几件事，再逐件补上原因、证据和数字。想不起来时问我要线索。",
      FEEDBACK: "这次复习安排更密：次日 5 个关键点、第 3 天复习遗漏点、第 7 天混合回忆。",
    },
    chips: {
      PREDICT: ["读的时候怎样才能记得更牢？"],
      READ: ["怎么给这一段起小标题？"],
      RECALL: ["我想不起来了，给点线索", "文章一共讲了几件事？", "回忆要写到什么程度？"],
      ANALYZE: ["这一题和我回忆的哪部分有关？"],
      EXPRESS: ["怎么用自己的话写摘要？"],
      FEEDBACK: [],
    },
  },
  DEBATE: {
    label: "论证对练",
    tagline: "追问依据 · 讲清理由",
    description: "导师扮演持不同意见的同学，追问“依据在哪”“有没有反例”。表达环节要写一条反方意见并回应。",
    focus: ["ANALYZE", "EXPRESS"],
    greeting: "我来扮演一个不太同意的同学。你说出判断，我就追问依据和反例——想清楚再回答我。",
    tips: {
      READ: "标出作者的主张、理由和证据，留意作者有没有回应反方。",
      ANALYZE: "每判断一段，问自己：它是在给理由、举证据，还是在让步或反驳？",
      EXPRESS: "写完摘要后，设想一位不同意的同学会怎么反驳，再用文中的依据回应他。",
    },
    chips: {
      PREDICT: ["作者可能会遇到什么反对意见？"],
      READ: ["这一段是理由还是证据？"],
      RECALL: ["给点线索，我漏了哪一类内容？"],
      ANALYZE: ["这个推理哪里站不住？", "你会怎么反驳这个例子？"],
      EXPRESS: ["反方最可能抓住哪一点？", "我的回应有依据吗？"],
      FEEDBACK: [],
    },
    extraTask: {
      label: "论证对练：写一条反方意见，并用文中的依据回应",
      hint: "先写“有人可能会说……”，再写“但是文中……所以……”。",
      placeholder: "有人可能会说……\n但是文中第 _ 段……所以……",
    },
  },
  VERIFY: {
    label: "核查陪练",
    tagline: "核查 AI · 找出错处",
    description: "练“先读原文再信 AI”。导师引导你逐句对照原文；表达环节要为自己的摘要标出原文依据。",
    focus: ["ANALYZE", "EXPRESS"],
    greeting: "我是核查陪练。遇到任何说法，先问“原文哪一句这么说的”。我会提醒你比较数字、程度词和适用范围。",
    tips: {
      READ: "留意数字、程度词（显著、一定、全部）和适用范围，它们最容易被转述错。",
      ANALYZE: "每判断一句，先在原文找到对应的句子，再比较数字和程度词是否一致。",
      EXPRESS: "写完摘要后，为其中至少两句标出原文依据（第几段），确认没有说过头。",
    },
    chips: {
      PREDICT: ["这类材料哪里最容易被转述错？"],
      READ: ["这句话的适用范围是什么？", "这个数字说明了什么？"],
      RECALL: ["给点线索，我漏了哪个数字或条件？"],
      ANALYZE: ["这句和原文哪里不一样？", "怎么判断是夸大还是编造？"],
      EXPRESS: ["我的摘要有没有说过头？", "怎么标原文依据？"],
      FEEDBACK: [],
    },
    extraTask: {
      label: "核查陪练：为你的摘要标出原文依据",
      hint: "至少写两句：“摘要第 1 句 → 原文第 _ 段”，并检查数字和程度词有没有说过头。",
      placeholder: "摘要第 1 句 → 原文第 _ 段：……\n摘要第 2 句 → 原文第 _ 段：……",
    },
  },
};

export const isLearningMode = (v: unknown): v is LearningMode => typeof v === "string" && (LEARNING_MODES as readonly string[]).includes(v);
