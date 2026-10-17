import type { Metadata, Viewport } from "next";
import { currentUser } from "@/server/auth";
import { AppChrome } from "./app-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "诺雅深读",
  description: "AI 时代的深度阅读与判断力训练",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

const LINKS = {
  STUDENT: [
    { href: "/", label: "今日训练" },
    { href: "/library", label: "内容库" },
    { href: "/reviews", label: "复习" },
    { href: "/report", label: "我的报告" },
    { href: "/levels", label: "能力量表" },
  ],
  TEACHER: [
    { href: "/teacher", label: "班级" },
    { href: "/library", label: "内容库" },
    { href: "/levels", label: "能力量表" },
  ],
  ADMIN: [
    { href: "/admin", label: "总览" },
    { href: "/admin/users", label: "用户管理" },
    { href: "/admin/learners", label: "学情表现" },
    { href: "/admin/classes", label: "班级" },
    { href: "/teacher", label: "教师端" },
    { href: "/library", label: "内容库" },
  ],
} as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const links = user ? (user.role === "STUDENT" ? LINKS.STUDENT : user.role === "ADMIN" ? LINKS.ADMIN : LINKS.TEACHER) : [];
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body><AppChrome user={user} links={[...links]}>{children}</AppChrome></body>
    </html>
  );
}

