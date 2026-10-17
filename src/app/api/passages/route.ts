import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isResponse, ok, requireUser } from "@/server/http";
import { handle } from "@/server/route";

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const url = new URL(req.url);
  const genre = url.searchParams.get("genre") ?? undefined;
  const grade = url.searchParams.get("grade") ?? undefined;
  const p = schema.passages;
  const passages = await db
    .select({ id: p.id, slug: p.slug, title: p.title, genre: p.genre, grade: p.grade, level: p.level, primaryAbility: p.primaryAbility, tutorRole: p.tutorRole, charCount: p.charCount })
    .from(p)
    .where(and(eq(p.status, "PUBLISHED"), genre ? eq(p.genre, genre) : undefined, grade ? eq(p.grade, grade) : undefined))
    .orderBy(asc(p.level), asc(p.title));
  return ok({ passages });
});
