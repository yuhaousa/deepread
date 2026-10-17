import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { currentUser, type RoleKey, type SessionUser } from "@/server/auth";

export const ok = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
export const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

/** 路由处理器内的鉴权：返回用户，或返回应直接回给客户端的错误响应 */
export async function requireUser(...roles: RoleKey[]): Promise<SessionUser | NextResponse> {
  const user = await currentUser();
  if (!user) return fail(401, "请先登录");
  if (roles.length && !roles.includes(user.role)) return fail(403, "没有权限");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail(400, "请求体不是合法 JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return fail(400, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return parsed.data;
}

export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse;
