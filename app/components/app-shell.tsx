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

  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="Daybook home">
            <span className="brand-mark" aria-hidden="true">d.</span>
            <span>daybook</span>
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
