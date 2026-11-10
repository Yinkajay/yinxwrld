"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Home", marker: "◷" },
  { href: "/creative", label: "Creative", marker: "✳" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="Daybook home">
          <span className="brand-mark" aria-hidden="true">d.</span>
          <span>daybook</span>
        </Link>

        <p className="nav-caption">YOUR SPACE</p>
        <nav className="primary-nav">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                className={`nav-link${active ? " is-active" : ""}`}
                href={item.href}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-marker" aria-hidden="true">{item.marker}</span>
                <span>{item.label}</span>
                {active && <span className="nav-current" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <span className="privacy-dot" aria-hidden="true" />
          <span>Saved in this browser</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="mobile-header">
          <Link className="brand" href="/" aria-label="Daybook home">
            <span className="brand-mark" aria-hidden="true">d.</span>
            <span>daybook</span>
          </Link>
          <nav className="mobile-nav" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  className={`mobile-nav-link${active ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
