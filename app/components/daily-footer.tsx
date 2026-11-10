"use client";

import { useEffect, useState } from "react";
import { getDailyFooterItem, getLagosDayKey } from "@/app/lib/workspace";

export default function DailyFooter() {
  const [dayKey, setDayKey] = useState<string | null>(null);

  useEffect(() => {
    const updateDate = () => setDayKey(getLagosDayKey(new Date()));
    updateDate();
    const interval = window.setInterval(updateDate, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (!dayKey) return null;

  const item = getDailyFooterItem(dayKey);

  return (
    <footer className="daily-footer">
      <div className="footer-thought">
        <span className="footer-label">{item.kind === "thought" ? "A thought for today" : "A question for today"}</span>
        <span className="footer-text" title={item.text}>
          “{item.text}”{item.byline ? ` — ${item.byline}` : ""}
        </span>
      </div>
      <p className="footer-privacy">Your lists stay in this browser. They are not synced to another device.</p>
    </footer>
  );
}
