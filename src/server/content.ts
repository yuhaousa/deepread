// 内容引擎：从数据库还原材料规格；生成发给浏览器的“去答案”版本。

import { asc, eq } from "drizzle-orm";
import type { AbilityKey, AnalysisSpec, LevelKey, Mcq, PassageSpec, TutorRoleKey } from "@/lib/domain";
import { db, schema } from "@/lib/db";

async function fetchPassage(id: string) {
  return db.query.passages.findFirst({
    where: eq(schema.passages.id, id),
    with: {
      card: true,
      keyPoints: { orderBy: asc(schema.keyPoints.order) },
      exercises: { orderBy: asc(schema.exercises.order) },
    },
  });
}

export type PassageRecord = NonNullable<Awaited<ReturnType<typeof fetchPassage>>>;
export type LoadedPassage = PassageSpec & { id: string; version: number };

export function specFromRecord(r: PassageRecord): LoadedPassage {
  const ex = (type: string) => r.exercises.find((e) => e.type === type);
  const predict = ex("PREDICT")!.spec as Mcq;
  const analysisEx = r.exercises.find((e) => e.step === "ANALYZE")!;
  const summary = ex("SUMMARY")?.spec as { mode?: "summary" | "rewrite" } | undefined;
  const transfer = ex("TRANSFER")?.spec as { prompt?: string } | undefined;
  return {
    id: r.id,
    version: r.version,
    slug: r.slug,
    title: r.title,
    genre: r.genre,
    grade: r.grade,
    level: r.level as LevelKey,
    primaryAbility: r.primaryAbility as AbilityKey,
    analysisAbility: analysisEx.ability as AbilityKey,
    tutorRole: r.tutorRole as TutorRoleKey,
    lead: r.lead,
    paragraphs: r.paragraphs,
    card: {
      source: r.card?.source ?? "",
      structure: r.card?.structure ?? "",
      concepts: r.card?.concepts ?? [],
      thesisLocation: r.card?.thesisLocation ?? "",
      misreadings: r.card?.misreadings ?? [],
      prerequisites: r.card?.prerequisites ?? undefined,
      goals: r.card?.goals ?? [],
    },
    keyPoints: r.keyPoints.map((k) => ({ text: k.text, keywords: k.keywords, paragraph: k.paragraph })),
    predict,
    analysis: analysisEx.spec as AnalysisSpec,
    transfer: transfer?.prompt ?? null,
    expressMode: summary?.mode ?? "summary",
    refSummary: r.card?.refSummary ?? "",
  };
}

export async function loadPassage(id: string): Promise<LoadedPassage | null> {
  const r = await fetchPassage(id);
  return r ? specFromRecord(r) : null;
}

/** 发给浏览器的材料：不含任何答案、关键点内容、参考摘要 */
export type ClientAnalysis =
  | { kind: "roles"; intro: string; roles: string[]; paragraphs: number[]; mcq?: { question: string; options: string[] } }
  | { kind: "audit"; intro: string; label: string; types: string[]; clauses: string[] }
  | { kind: "quiz"; intro: string; questions: { question: string; options: string[] }[]; selfCheck: boolean }
  | { kind: "sequence"; intro: string; steps: { id: number; text: string }[]; mcq?: { question: string; options: string[] } };

export interface ClientPassage {
  id: string;
  title: string;
  genre: string;
  grade: string;
  level: LevelKey;
  tutorRole: TutorRoleKey;
  lead: string;
  paragraphs: string[];
  charCount: number;
  keyPointCount: number;
  predict: { question: string; options: string[] };
  analysis: ClientAnalysis;
  transfer: string | null;
  expressMode: "summary" | "rewrite";
}

/** 确定性打乱（同一次训练每次打开顺序一致） */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function toClient(p: PassageSpec & { id: string }, charCount: number, seed: string): ClientPassage {
  const mcq = (m?: Mcq) => (m ? { question: m.question, options: m.options } : undefined);
  let analysis: ClientAnalysis;
  const a = p.analysis;
  switch (a.kind) {
    case "roles":
      analysis = { kind: "roles", intro: a.intro, roles: a.roles, paragraphs: a.items.map((i) => i.paragraph), mcq: mcq(a.mcq) };
      break;
    case "audit":
      analysis = { kind: "audit", intro: a.intro, label: a.label, types: a.types, clauses: a.clauses.map((c) => c.text) };
      break;
    case "quiz":
      analysis = { kind: "quiz", intro: a.intro, questions: a.questions.map((q) => ({ question: q.question, options: q.options })), selfCheck: !!a.selfCheck };
      break;
    case "sequence":
      analysis = { kind: "sequence", intro: a.intro, steps: shuffled(a.steps.map((text, id) => ({ id, text })), seed), mcq: mcq(a.mcq) };
      break;
  }
  return {
    id: p.id,
    title: p.title,
    genre: p.genre,
    grade: p.grade,
    level: p.level,
    tutorRole: p.tutorRole,
    lead: p.lead,
    paragraphs: p.paragraphs,
    charCount,
    keyPointCount: p.keyPoints.length,
    predict: { question: p.predict.question, options: p.predict.options },
    analysis,
    transfer: p.transfer,
    expressMode: p.expressMode,
  };
}
