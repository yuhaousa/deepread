"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { homeFor } from "@/lib/home";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "登录失败");
    router.push(homeFor(data.role));
    router.refresh();
  }

  return (
    <div className="login">
      <div>
        <div className="eyebrow">AI 时代的深度阅读与判断力训练</div>
        <h1 style={{ fontFamily: "var(--f-read)", fontSize: 32, marginTop: 8 }}>读懂原文，才能读懂 AI。</h1>
      </div>
      <form className="card" onSubmit={submit}>
        <label className="field" style={{ margin: 0 }}>
          <span>学号 / 教师邮箱</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>密码</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="err-msg">{error}</p>}
        <button className="btn green" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="note">演示账号：学生 student · 教师 teacher · 管理员 admin · 密码均为 Bamboo123</p>
    </div>
  );
}
