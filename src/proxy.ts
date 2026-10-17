// 页面访问控制：未登录访问首页时进入落地页，其余页面跳转登录页；教师 / 学生各自的页面互不可见。
// API 路由在处理器内自行鉴权（返回 401/403 JSON），这里不拦截。
import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/server/session";

const STUDENT_ONLY = ["/train", "/reviews", "/report"];
const TEACHER_ONLY = ["/teacher"];

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
  if (pathname === "/login") return NextResponse.redirect(new URL(user.role === "STUDENT" ? "/" : "/teacher", req.url));
  if (user.role !== "STUDENT" && (pathname === "/" || STUDENT_ONLY.some((p) => pathname.startsWith(p)))) {
    return NextResponse.redirect(new URL("/teacher", req.url));
  }
  if (user.role === "STUDENT" && TEACHER_ONLY.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
