"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Teacher = { id: string; name: string; username: string };

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "操作失败");
  return data;
}

export function CreateClassForm({ teachers }: { teachers: Teacher[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setMsg(null);
        try {
          await send("/api/admin/classrooms", "POST", { name, grade, teacherId });
          setMsg({ ok: true, text: `已创建 ${name}` });
          setName("");
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        }
      }}
    >
      <label className="field"><span>班级名称</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="如 初二（4）班" required /></label>
      <label className="field"><span>年级</span><input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="如 初二" required /></label>
      <label className="field">
        <span>任课教师</span>
        <select className="in" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}（{t.username}）</option>)}
        </select>
      </label>
      <div className="form-actions">
        <button className="btn green">创建班级</button>
        {msg && <span className={msg.ok ? "note" : "err-msg"} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

export function ClassTeacherSelect({ classroomId, teacherId, teachers }: { classroomId: string; teacherId: string; teachers: Teacher[] }) {
  const router = useRouter();
  const [value, setValue] = useState(teacherId);
  const [err, setErr] = useState("");
  return (
    <>
      <select
        className="in compact"
        aria-label="任课教师"
        value={value}
        onChange={async (e) => {
          const next = e.target.value;
          setValue(next);
          setErr("");
          try {
            await send(`/api/admin/classrooms/${classroomId}`, "PATCH", { teacherId: next });
            router.refresh();
          } catch (ex) {
            setValue(teacherId);
            setErr((ex as Error).message);
          }
        }}
      >
        {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {err && <span className="err-msg">{err}</span>}
    </>
  );
}
