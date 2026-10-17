// 会话令牌签发与校验（只依赖 jose，可在 proxy 中使用）。
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dr_session";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

export type RoleKey = "STUDENT" | "TEACHER" | "PARENT" | "ADMIN" | "EDITOR";

export interface SessionUser {
  id: string;
  role: RoleKey;
  name: string;
}

export function authSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET 至少需要 32 个字符");
    return new TextEncoder().encode("dev-only-secret-dev-only-secret-dev-only");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(authSecret());
}

export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub) return null;
    return { id: payload.sub, role: payload.role as RoleKey, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}
