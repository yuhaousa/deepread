import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sessionCookie, signSession, verifyPassword, type RoleKey } from "@/server/auth";
import { fail, isResponse, parseBody } from "@/server/http";
import { handle } from "@/server/route";

const Body = z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(200) });

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;
  const user = await db.query.users.findFirst({ where: eq(schema.users.username, body.username) });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) return fail(401, "账号或密码不正确");
  const token = await signSession({ id: user.id, role: user.role as RoleKey, name: user.displayName });
  const res = NextResponse.json({ role: user.role, name: user.displayName });
  res.cookies.set(sessionCookie(token));
  return res;
});
