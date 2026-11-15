"use client";

import { repeatLabel } from "@/app/lib/recurrence";
import type { TaskPeriod, TaskRepeat } from "@/app/lib/workspace";

export function RepeatInput({ id, value, period, onChange, allowNone = true, autoFocus = false }: {
  id: string;
  value: TaskRepeat;
  period: TaskPeriod;
  onChange: (repeat: TaskRepeat) => void;
  allowNone?: boolean;
  autoFocus?: boolean;
}) {
  const choices: TaskRepeat[] = [...(allowNone ? ["none" as const] : []), ...(period === "week" ? ["weekly" as const] : ["daily" as const, "weekdays" as const, "weekly" as const])];
  return (
    <label className="repeat-input" htmlFor={id}>
      <span id={`${id}-label`}>Repeat</span>
      <select id={id} autoFocus={autoFocus} aria-labelledby={`${id}-label`} value={value} onChange={(event) => onChange(event.target.value as TaskRepeat)}>
        {!allowNone && value === "none" && <option value="none" disabled>Choose a schedule</option>}
        {choices.map((repeat) => <option key={repeat} value={repeat}>{repeatLabel(repeat)}</option>)}
      </select>
    </label>
  );
}
