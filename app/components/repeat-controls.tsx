"use client";

import { repeatLabel } from "@/app/lib/recurrence";
import type { RecurringTask, TaskPeriod, TaskRepeat } from "@/app/lib/workspace";

export function RepeatInput({ id, value, period, onChange }: {
  id: string;
  value: TaskRepeat;
  period: TaskPeriod;
  onChange: (repeat: TaskRepeat) => void;
}) {
  const choices: TaskRepeat[] = period === "week" ? ["none", "weekly"] : ["none", "daily", "weekdays", "weekly"];
  return (
    <label className="repeat-input" htmlFor={id}>
      <span id={`${id}-label`}>Repeat</span>
      <select id={id} aria-labelledby={`${id}-label`} value={value} onChange={(event) => onChange(event.target.value as TaskRepeat)}>
        {choices.map((repeat) => <option key={repeat} value={repeat}>{repeatLabel(repeat)}</option>)}
      </select>
    </label>
  );
}

export function RecurringTasksPanel({ tasks, onStop }: { tasks: RecurringTask[]; onStop: (id: string) => void }) {
  const active = tasks.filter((task) => task.active);
  return (
    <details className="recurring-panel">
      <summary>Repeating tasks <span>{active.length}</span></summary>
      <p>Each repeat starts fresh. Stopping a repeat keeps your current and past tasks.</p>
      {active.length ? (
        <ul>
          {active.map((task) => (
            <li key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <span>{repeatLabel(task.repeat)} · {task.period === "week" ? "This week" : "Today"}
                  {task.period === "day" && task.repeat === "weekly" ? ` · ${new Intl.DateTimeFormat("en", { weekday: "long", timeZone: "Africa/Lagos" }).format(new Date(`${task.startKey}T12:00:00Z`))}` : ""}
                </span>
              </div>
              <button className="text-button" type="button" onClick={() => onStop(task.id)} aria-label={`Stop repeating ${task.title}`}>Stop repeating</button>
            </li>
          ))}
        </ul>
      ) : <p>Choose Repeat when adding or editing a task to get started.</p>}
    </details>
  );
}
