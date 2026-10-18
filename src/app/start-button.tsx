"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LearningMode } from "@/lib/modes";

/** 开始（或继续）一次训练 */
export function StartButton({
  passageId,
  assignmentId,
  mode,
  label = "开始训练",
  ghost = false,
}: {
  passageId: string;
  assignmentId?: string;
  /** 学习方式；不传时用材料默认导师 */
  mode?: LearningMode;
  label?: string;
  ghost?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span style={{ display: "inline-grid", gap: 6, justifyItems: "start" }}>
      <button
        className={`btn ${ghost ? "ghost" : "green"}`}
        style={{ fontSize: 13.5, padding: "6px 14px" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passageId, assignmentId, mode }) });
          const data = await res.json();
          if (!res.ok) {
            setBusy(false);
            return setError(data.error ?? "无法开始训练");
          }
          router.push(`/train/${data.id}`);
        }}
      >
        {busy ? "准备中…" : label}
      </button>
      {error && <span className="err-msg" style={{ fontSize: 12.5 }}>{error}</span>}
    </span>
  );
}
