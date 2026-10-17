"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function Nav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/train") : path.startsWith(href));
  return (
    <nav className="tabs" aria-label="主导航">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      退出
    </button>
  );
}
