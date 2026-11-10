"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DailyFooter from "@/app/components/daily-footer";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/creative", label: "Creative" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCreativePage = pathname.startsWith("/creative");

  return (
    <div className={`app-frame ${isCreativePage ? "scene-winter" : "scene-sunset"}`}>
      <div className="scene-background" aria-hidden="true" />
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="yinxwrld home">
            <span className="brand-logo" aria-hidden="true" />
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  className={`site-nav-link${active ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
      <DailyFooter />
    </div>
  );
}
