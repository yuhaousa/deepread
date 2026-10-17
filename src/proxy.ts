// 页面访问控制：未登录访问首页时进入落地页，其余页面跳转登录页；学生、教师、管理员各自的页面互不可见（管理员可进教师端）。
// API 路由在处理器内自行鉴权（返回 401/403 JSON），这里不拦截。
import { NextResponse, type NextRequest } from "next/server";
import { homeFor } from "@/lib/home";
import { readSession, SESSION_COOKIE } from "@/server/session";

const STUDENT_ONLY = ["/train", "/reviews", "/report"];
const TEACHER_ONLY = ["/teacher"];
const ADMIN_ONLY = ["/admin"];
const under = (pathname: string, prefixes: string[]) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const user = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  // 落地页对所有人公开
  if (pathname === "/welcome") return NextResponse.next();
  if (!user) {
    if (pathname === "/login") return NextResponse.next();
    // 未登录访问首页时先看落地页，其余页面直接去登录
    return NextResponse.redirect(new URL(pathname === "/" ? "/welcome" : "/login", req.url));
  }
  const home = new URL(homeFor(user.role), req.url);
  if (pathname === "/login") return NextResponse.redirect(home);
  if (user.role !== "STUDENT" && (pathname === "/" || under(pathname, STUDENT_ONLY))) return NextResponse.redirect(home);
  if (user.role === "STUDENT" && under(pathname, TEACHER_ONLY)) return NextResponse.redirect(home);
  if (user.role !== "ADMIN" && under(pathname, ADMIN_ONLY)) return NextResponse.redirect(home);
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
