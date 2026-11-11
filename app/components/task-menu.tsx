"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type TaskMenuAction = { label: string; onSelect: () => void; danger?: boolean };

export default function TaskMenu({ title, actions }: { title: string; actions: TaskMenuAction[] }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const panel = menu.current.getBoundingClientRect();
    menu.current.style.left = `${Math.max(16, Math.min(anchor.right - panel.width, window.innerWidth - panel.width - 16))}px`;
    menu.current.style.top = `${anchor.bottom + panel.height + 8 <= window.innerHeight
      ? anchor.bottom + 8 : Math.max(16, anchor.top - panel.height - 8)}px`;
    menu.current.querySelector<HTMLButtonElement>("button")?.focus();

    const outside = (event: Event) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, { passive: true });
    window.addEventListener("touchmove", close, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close);
      window.removeEventListener("touchmove", close);
    };
  }, [open]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      trigger.current?.focus();
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }

  return (
    <>
      <button ref={trigger} className="icon-action task-menu-trigger" type="button"
        aria-label={`More actions for ${title}`} aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? menuId : undefined} onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
        }}>More</button>
      {open && createPortal(
        <div ref={menu} id={menuId} className="task-more-menu" role="menu" aria-label={`Actions for ${title}`}
          onKeyDown={handleKey}>
          {actions.map((action) => (
            <button key={action.label} type="button" role="menuitem" tabIndex={-1}
              className={action.danger ? "danger-text" : undefined} onClick={() => {
                trigger.current?.focus();
                setOpen(false);
                action.onSelect();
              }}>{action.label}</button>
          ))}
        </div>, document.body,
      )}
    </>
  );
}
