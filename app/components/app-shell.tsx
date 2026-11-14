"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import DailyFooter from "@/app/components/daily-footer";
import { useWorkspace } from "@/app/hooks/use-workspace";
import { SOUND_NAMES, useSounds, type SoundName } from "@/app/hooks/use-sounds";
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
  const { playSound } = useSounds();
  const lastSoundAt = useRef(new WeakMap<HTMLElement, number>());
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

  function playControlSound(control: HTMLElement, rememberClick = true) {
    if (control.getAttribute("aria-disabled") === "true" || control.matches(":disabled")) return;
    const selected = control.dataset.sound;
    if (selected === "none") return;
    const sound = selected && SOUND_NAMES.includes(selected as SoundName) ? selected as SoundName : "tap";
    playSound(sound);
    if (rememberClick) lastSoundAt.current.set(control, performance.now());
  }

  function handleClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest<HTMLElement>("button, a, input:not([type='hidden']), select, textarea, summary, [role='button'], [role='menuitem'], [role='tab'], [role='checkbox'], [role='radio']");
    if (control instanceof HTMLTextAreaElement || (control instanceof HTMLInputElement &&
      ["text", "search", "email", "url", "tel", "password", "number"].includes(control.type))) return;
    // Status selects get their action-specific cue from the resulting value
    // change, so opening the menu does not layer a generic tap on top of it.
    if (control instanceof HTMLSelectElement && control.hasAttribute("data-sound-state")) return;
    if (control) playControlSound(control);
  }

  function handleChangeCapture(event: React.ChangeEvent<HTMLDivElement>) {
    const control = event.target;
    if (!(control instanceof HTMLSelectElement)) return;
    const previous = control.dataset.soundState;
    if (!previous) {
      const lastClick = lastSoundAt.current.get(control) ?? -Infinity;
      if (performance.now() - lastClick > 80) playControlSound(control, false);
      return;
    }
    const next = control.value;
    const sound: SoundName = !previous ? "tap"
      : next === "done" || next === "complete" ? "complete"
        : previous === "done" || previous === "complete" ? "reopen" : "tap";
    playSound(sound);
    control.dataset.soundState = next;
  }

  function handleKeyDownCapture(event: React.KeyboardEvent<HTMLDivElement>) {
    const control = event.target;
    if (control instanceof HTMLInputElement && control.type === "range" &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
      playControlSound(control, false);
    }
  }

  function handleSubmitCapture(event: React.FormEvent<HTMLDivElement>) {
    const nativeEvent = event.nativeEvent as SubmitEvent;
    const submitter = nativeEvent.submitter instanceof HTMLElement ? nativeEvent.submitter : null;
    const form = event.target;
    if (submitter) {
      const lastClick = lastSoundAt.current.get(submitter) ?? -Infinity;
      if (performance.now() - lastClick > 80) playControlSound(submitter, false);
    }
    else if (form instanceof HTMLFormElement) {
      const selected = form.dataset.submitSound;
      const sound = selected && SOUND_NAMES.includes(selected as SoundName) ? selected as SoundName : "add";
      playSound(sound);
    }
  }

  return (
    <div className={`app-frame scene-${scene}${settings.showDailyFooter ? "" : " without-daily-footer"}`}
      onClickCapture={handleClickCapture} onChangeCapture={handleChangeCapture} onKeyDownCapture={handleKeyDownCapture} onSubmitCapture={handleSubmitCapture}>
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
