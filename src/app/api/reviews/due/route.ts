import { isResponse, ok, requireUser } from "@/server/http";
import { dueReviews } from "@/server/reviews";
import { handle } from "@/server/route";

export const GET = handle(async () => {
  const user = await requireUser("STUDENT");
  if (isResponse(user)) return user;
  return ok({ items: await dueReviews(user.id) });
});
