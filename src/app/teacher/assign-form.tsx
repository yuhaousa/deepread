"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AssignForm({ classroomId, passages }: { classroomId: string; passages: { id: string; label: string }[] }) {
  const router = useRouter();
  const [passageId, setPassageId] = useState(passages[0]?.id ?? "");
  const [due, setDue] = useState(() => {
    const d = new Date(Date.now() + 7 * 864e5);
    d.setHours(21, 0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [msg, setMsg] = useState("");

  return (
    <form
      style={{ display: "grid", gap: 10, marginTop: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg("");
        const res = await fetch("/api/assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ classroomId, passageId, dueAt: new Date(due).toISOString() }),
        });
        const data = await res.json();
        if (!res.ok) return setMsg(data.error ?? "布置失败");
        setMsg("已布置，学生首页会显示这项任务。");
        router.push(`/teacher?c=${classroomId}&a=${data.id}`);
        router.refresh();
      }}
    >
      <label className="field" style={{ margin: 0 }}>
        <span>材料</span>
        <select className="in" value={passageId} onChange={(e) => setPassageId(e.target.value)}>
          {passages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span>截止时间</span>
        <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
      </label>
      <button className="btn green" style={{ justifySelf: "start" }}>
        布置
      </button>
      {msg && <p className="note">{msg}</p>}
    </form>
  );
}
