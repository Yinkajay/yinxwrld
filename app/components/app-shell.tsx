"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import DailyFooter from "@/app/components/daily-footer";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/creative", label: "Creative" },
  { href: "/#history", label: "History" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const isCreativePage = pathname.startsWith("/creative");
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  return (
    <div className={`app-frame ${isCreativePage ? "scene-winter" : "scene-sunset"}`}>
      <div className="scene-background" aria-hidden="true" />
      {!isLoginPage && <header className="site-header">
        <div className="site-header-inner">
          <Link className="brand" href="/" aria-label="yinxwrld home">
            <span className="brand-logo" aria-hidden="true" />
          </Link>

          <nav className="site-nav" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = item.href === "/#history"
                ? pathname === "/" && currentHash === "#history"
                : item.href === "/"
                  ? pathname === "/" && currentHash !== "#history"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  className={`site-nav-link${active ? " is-active" : ""}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (item.href === "/#history" && pathname === "/") {
                      window.dispatchEvent(new Event("yinxwrld:open-history"));
                    }
                  }}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button
              className="site-nav-link sign-out-link"
              type="button"
              onClick={() => {
                void fetch("/api/auth/logout", { method: "POST" })
                  .catch(() => undefined)
                  .finally(() => window.location.assign("/login"));
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>}
      <main className="main-content">{children}</main>
      {!isLoginPage && <DailyFooter />}
    </div>
  );
}
