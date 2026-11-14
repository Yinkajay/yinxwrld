"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import DailyFooter from "@/app/components/daily-footer";
import { useWorkspace } from "@/app/hooks/use-workspace";
import { getWorkspaceSettings } from "@/app/lib/workspace-settings";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/creative", label: "Creative" },
  { href: "/#history", label: "History" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const isCreativePage = pathname.startsWith("/creative");
  const { data } = useWorkspace();
  const settings = getWorkspaceSettings(data);
  const scene = settings.backgrounds[pathname.startsWith("/settings") ? "settings" : isCreativePage ? "creative" : "home"];

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
    <div className={`app-frame scene-${scene}${settings.showDailyFooter ? "" : " without-daily-footer"}`}>
      <div className="scene-background" aria-hidden="true" />
      <header className="site-header">
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
            <Link href="/settings" className={`site-nav-link settings-nav-link${pathname === "/settings" ? " is-active" : ""}`}
              aria-label="Settings" title="Settings" aria-current={pathname === "/settings" ? "page" : undefined}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9.4 3 .6-1h4l.6 1 .4 2 1.7 1 1.9-.6 1.1.1 2 3.5-.5 1-1.5 1.4v2l1.5 1.4.5 1-2 3.5-1.1.1-1.9-.6-1.7 1-.4 2-.6 1h-4l-.6-1-.4-2-1.7-1-1.9.6-1.1-.1-2-3.5.5-1L4.3 13v-2L2.8 9.6l-.5-1 2-3.5 1.1-.1 1.9.6 1.7-1z" transform="translate(0 1) scale(1 .91)" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
          </nav>
        </div>
      </header>
      <main className="main-content">{children}</main>
      {settings.showDailyFooter && <DailyFooter />}
    </div>
  );
}
