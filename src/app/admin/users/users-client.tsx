"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, ROLE_LABEL } from "@/server/admin/schemas";

type Role = (typeof ROLES)[number];
type Option = { id: string; name: string };

export interface UserView {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  grade: string | null;
  classroomId: string | null;
  classroomName: string | null;
  guardianConsentAt: string | null;
  createdAt: string;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("zh-CN", { timeZone: "Asia/Singapore" });

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "操作失败");
  return data;
}

/** 学生专属字段：班级、年级、监护人同意 */
function StudentFields(p: {
  classrooms: Option[];
  classroomId: string;
  setClassroomId: (v: string) => void;
  grade: string;
  setGrade: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
}) {
  return (
    <>
      <label className="field">
        <span>班级</span>
        <select className="in" value={p.classroomId} onChange={(e) => p.setClassroomId(e.target.value)}>
          <option value="">未分班</option>
          {p.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>年级</span>
        <input type="text" value={p.grade} onChange={(e) => p.setGrade(e.target.value)} placeholder="如 初二" />
      </label>
      <label className="check">
        <input type="checkbox" checked={p.consent} onChange={(e) => p.setConsent(e.target.checked)} />
        监护人已同意使用 AI 导师对话
      </label>
    </>
  );
}

export function CreateUserForm({ classrooms }: { classrooms: Option[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("STUDENT");
  const [password, setPassword] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [grade, setGrade] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        try {
          await send("/api/admin/users", "POST", {
            username,
            displayName,
            role,
            password,
            ...(role === "STUDENT" ? { classroomId: classroomId || null, grade: grade || null, guardianConsent: consent } : {}),
          });
          setMsg({ ok: true, text: `已创建 ${displayName}（${username}）` });
          setUsername("");
          setDisplayName("");
          setPassword("");
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>账号</span>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="学号或邮箱" required autoComplete="off" />
      </label>
      <label className="field">
        <span>姓名</span>
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label className="field">
        <span>角色</span>
        <select className="in" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </label>
      <label className="field">
        <span>初始密码</span>
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
      </label>
      {role === "STUDENT" && (
        <StudentFields classrooms={classrooms} classroomId={classroomId} setClassroomId={setClassroomId} grade={grade} setGrade={setGrade} consent={consent} setConsent={setConsent} />
      )}
      <div className="form-actions">
        <button className="btn green" disabled={busy}>{busy ? "创建中…" : "创建用户"}</button>
        {msg && <span className={msg.ok ? "note" : "err-msg"} role="status">{msg.text}</span>}
      </div>
    </form>
  );
}

export function UserRow({ user, classrooms, isSelf }: { user: UserView; classrooms: Option[]; isSelf: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<Role>(user.role);
  const [classroomId, setClassroomId] = useState(user.classroomId ?? "");
  const [grade, setGrade] = useState(user.grade ?? "");
  const [consent, setConsent] = useState(!!user.guardianConsentAt);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
      setOpen(false);
      setPassword("");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <tr>
        <td><code>{user.username}</code>{isSelf && <span className="tag" style={{ marginLeft: 6 }}>我</span>}</td>
        <td>
          {user.role === "STUDENT" ? <Link href={`/admin/learners/${user.id}`}>{user.displayName}</Link> : user.displayName}
        </td>
        <td><span className={`tag${user.role === "ADMIN" ? " o" : user.role === "TEACHER" ? " g" : ""}`}>{ROLE_LABEL[user.role]}</span></td>
        <td>{user.role === "STUDENT" ? `${user.classroomName ?? "未分班"}${user.grade ? ` · ${user.grade}` : ""}` : "—"}</td>
        <td>{user.role === "STUDENT" ? (user.guardianConsentAt ? `✓ ${day(user.guardianConsentAt)}` : "未同意") : "—"}</td>
        <td className="note">{day(user.createdAt)}</td>
        <td><button className="btn ghost sm" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "收起" : "编辑"}</button></td>
      </tr>
      {open && (
        <tr className="edit-row">
          <td colSpan={7}>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  send(`/api/admin/users/${user.id}`, "PATCH", {
                    displayName,
                    role,
                    ...(password ? { password } : {}),
                    ...(role === "STUDENT" ? { classroomId: classroomId || null, grade: grade || null, guardianConsent: consent } : {}),
                  }),
                );
              }}
            >
              <label className="field">
                <span>姓名</span>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
              </label>
              <label className="field">
                <span>角色</span>
                <select className="in" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </label>
              <label className="field">
                <span>重置密码</span>
                <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} placeholder="留空则不修改" autoComplete="new-password" />
              </label>
              {role === "STUDENT" && (
                <StudentFields classrooms={classrooms} classroomId={classroomId} setClassroomId={setClassroomId} grade={grade} setGrade={setGrade} consent={consent} setConsent={setConsent} />
              )}
              <div className="form-actions">
                <button className="btn green" disabled={busy}>保存</button>
                {!isSelf && (
                  <button
                    type="button"
                    className="btn danger"
                    disabled={busy}
                    onClick={() => {
                      const warn = user.role === "STUDENT" ? "该学生的训练记录、复习和能力数据会一并删除，且无法恢复。" : "此操作无法恢复。";
                      if (confirm(`确定删除 ${user.displayName}（${user.username}）？${warn}`)) run(() => send(`/api/admin/users/${user.id}`, "DELETE"));
                    }}
                  >
                    删除用户
                  </button>
                )}
                {err && <span className="err-msg" role="alert">{err}</span>}
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}
