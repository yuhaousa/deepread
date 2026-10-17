"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { homeFor } from "@/lib/home";
import type { SessionUser } from "@/server/session";
import { Nav, LogoutButton } from "./nav";

export function AppChrome({
  children,
  user,
  links,
}: {
  children: ReactNode;
  user: SessionUser | null;
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/welcome" || pathname === "/login" || pathname === "/about";
  const useSidebar = !isPublicPage && (user?.role === "ADMIN" || user?.role === "TEACHER");
  const publicLinks = [
    { href: "/welcome#loop", label: "训练流程" },
    { href: "/welcome#growth-title", label: "成长图谱" },
    { href: "/welcome#library", label: "内容库" },
    { href: "/welcome#tutors", label: "AI 导师" },
    { href: "/about", label: "关于我们" },
  ];

  if (useSidebar && user) {
    return (
      <div className="app-shell">
        <aside className="app-sidebar">
          <Link href={homeFor(user.role)} className="brand sidebar-brand" style={{ textDecoration: "none" }}>
            <b>诺雅深读</b>
            <span>NOYA DEEPREAD</span>
          </Link>
          <div className="sidebar-caption">{user.role === "ADMIN" ? "管理后台" : "教师工作区"}</div>
          <Nav links={links} variant="sidebar" />
          <div className="sidebar-footer">
            <span>{user.name}</span>
            <LogoutButton />
          </div>
        </aside>
        <div className="app-content"><main className="wrap">{children}</main></div>
      </div>
    );
  }

  return (
    <>
      <header className="top">
        <div className="wrap">
          <Link href={user ? homeFor(user.role) : "/welcome"} className="brand" style={{ textDecoration: "none" }}>
            <b>诺雅深读</b>
            <span>NOYA DEEPREAD</span>
          </Link>
          {user ? <Nav links={links} /> : (
            <nav className="tabs" aria-label="首页导航">
              {publicLinks.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
            </nav>
          )}
          {!user && <Link href="/login" className="btn green login-link">登录</Link>}
          {user && <div className="who">{user.name}<LogoutButton /></div>}
        </div>
      </header>
      <main className="wrap">{children}</main>
      {(pathname === "/welcome" || pathname === "/about") && (
        <footer className="site-footer wrap">
          <Link href="/welcome" className="site-footer-brand">诺雅深读 <span>NOYA DEEPREAD</span></Link>
          <p>让每一次阅读，都成为独立思考的练习。</p>
          <nav aria-label="页脚导航">
            <Link href="/about">关于我们</Link>
            <Link href="/login">登录</Link>
          </nav>
        </footer>
      )}
    </>
  );
}

