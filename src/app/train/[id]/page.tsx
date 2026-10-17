import { notFound } from "next/navigation";
import type { StepKey } from "@/lib/domain";
import { toClient } from "@/server/content";
import { pageUser } from "@/server/pages";
import { getOwnedSession, TrainingError } from "@/server/training";
import { Trainer } from "./trainer";

export const dynamic = "force-dynamic";

export default async function TrainPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("STUDENT");
  const { id } = await params;
  let data;
  try {
    data = await getOwnedSession(user, id);
  } catch (e) {
    if (e instanceof TrainingError) notFound();
    throw e;
  }
  const { session, passage } = data;
  const chars = passage.paragraphs.join("").replace(/\s/g, "").length + passage.lead.length;
  return (
    <Trainer
      key={session.id}
      sessionId={session.id}
      passage={toClient(passage, chars, session.id)}
      initialStep={session.step as StepKey | "DONE"}
      initialQuestion={session.question}
      initialHighlights={session.highlights}
    />
  );
}
