import { dueReviews } from "@/server/reviews";
import { pageUser } from "@/server/pages";
import { ReviewList } from "./review-list";

export const dynamic = "force-dynamic";

export default async function Reviews() {
  const user = await pageUser("STUDENT");
  const items = await dueReviews(user.id);
  return (
    <>
      <div className="eyebrow">间隔复习</div>
      <h2 style={{ fontSize: 24, marginTop: 6 }}>合上书，回想一下</h2>
      <p className="lede" style={{ marginTop: 6 }}>
        每题只给线索，不给原文。答不出来也没关系，系统会在两天后再问一次。
      </p>
      <ReviewList items={items.map((i) => ({ id: i.id, title: i.title, cue: i.cue, intervalD: i.intervalD }))} />
    </>
  );
}
