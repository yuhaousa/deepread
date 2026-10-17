// 鉴权：密码哈希、当前用户、会话 Cookie。学生用学号登录，不收集手机号。
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { readSession, SESSION_COOKIE, SESSION_MAX_AGE_S } from "@/server/session";

export { readSession, signSession, SESSION_COOKIE, type RoleKey, type SessionUser } from "@/server/session";

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function currentUser() {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

export const sessionCookie = (token: string) => ({
  name: SESSION_COOKIE,
  value: token,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
});

/** AI 调用日志只存哈希后的用户 ID */
export const userHash = (id: string) => createHash("sha256").update(id).digest("hex").slice(0, 16);
