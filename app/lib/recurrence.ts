import { changeTask, moveDailyTaskToWeek, type TaskChange } from "./planner";
import { getLagosDayKey, getWeekStartKey, type RecurringTask, type Task, type TaskRepeat, type WorkspaceData } from "./workspace";

export type TaskEditChange = TaskChange & { repeat?: TaskRepeat };

export function repeatLabel(repeat: TaskRepeat) {
  return { none: "Does not repeat", daily: "Every day", weekdays: "Weekdays", weekly: "Every week" }[repeat];
}

function weekday(key: string) {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** Only materialize the current period, never a backlog of unvisited dates. */
export function materializeRecurringTasks(data: WorkspaceData, now: string): WorkspaceData {
  const today = getLagosDayKey(new Date(now));
  const added: Task[] = [];
  for (const series of data.recurringTasks ?? []) {
    if (!series.active || series.startKey > today) continue;
    const key = series.period === "week" ? getWeekStartKey(today) : today;
    if (series.skippedKeys.includes(key)) continue;
    if (series.period === "day" && (
      (series.repeat === "weekdays" && [0, 6].includes(weekday(today))) ||
      (series.repeat === "weekly" && weekday(today) !== weekday(series.startKey))
    )) continue;
    if (data.tasks.some((task) => task.recurringTaskId === series.id && task.period === series.period && task.periodKey === key)) continue;
    added.push({
      id: `repeat:${series.id}:${key}`,
      recurringTaskId: series.id,
      title: series.title,
      category: series.category,
      period: series.period,
      periodKey: key,
      status: "todo",
      createdAt: now,
      updatedAt: now,
    });
  }
  return added.length ? { ...data, tasks: [...data.tasks, ...added] } : data;
}

export function stopRecurringTask(data: WorkspaceData, seriesId: string, now: string): WorkspaceData {
  return { ...data, recurringTasks: (data.recurringTasks ?? []).map((series) => series.id === seriesId
    ? { ...series, active: false, updatedAt: now } : series) };
}

export function setTaskRepeat(data: WorkspaceData, taskId: string, repeat: TaskRepeat, newSeriesId: string, now: string): WorkspaceData {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task) return data;
  const existing = data.recurringTasks?.find((series) => series.id === task.recurringTaskId);
  if (repeat === "none") return existing ? stopRecurringTask(data, existing.id, now) : data;
  const frequency = task.period === "week" ? "weekly" : repeat;
  const series: RecurringTask = {
    id: existing?.id ?? newSeriesId,
    title: task.title,
    category: task.category,
    period: task.period,
    repeat: frequency,
    startKey: existing?.active && existing.repeat === frequency && existing.period === task.period
      ? existing.startKey : getLagosDayKey(new Date(now)),
    active: true,
    skippedKeys: existing?.skippedKeys ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  return {
    ...data,
    recurringTasks: existing
      ? data.recurringTasks!.map((item) => item.id === series.id ? series : item)
      : [...(data.recurringTasks ?? []), series],
    tasks: data.tasks.map((item) => item.id === taskId ? { ...item, recurringTaskId: series.id, updatedAt: now } : item),
  };
}

/** Edits update this occurrence and future repeats, preserving historical entries. */
export function editRepeatingTask(data: WorkspaceData, taskId: string, change: TaskEditChange, newSeriesId: string, now: string): WorkspaceData {
  const { repeat, ...fields } = change;
  let next = { ...data, tasks: changeTask(data.tasks, taskId, fields, now) };
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) return data;
  if (task.recurringTaskId && ("title" in fields || "category" in fields)) {
    next = { ...next, recurringTasks: (next.recurringTasks ?? []).map((series) => series.id === task.recurringTaskId && series.active
      ? { ...series, title: task.title, category: task.category, updatedAt: now } : series) };
  }
  return repeat === undefined ? next : setTaskRepeat(next, taskId, repeat, newSeriesId, now);
}

function skipOccurrence(data: WorkspaceData, task: Task, now: string): WorkspaceData {
  if (!task.recurringTaskId) return data;
  return {
    ...data,
    recurringTasks: (data.recurringTasks ?? []).map((series) => series.id === task.recurringTaskId
      ? { ...series, skippedKeys: [...new Set([...series.skippedKeys, task.periodKey])], updatedAt: now } : series),
  };
}

export function deleteTaskOccurrence(data: WorkspaceData, taskId: string, now: string): WorkspaceData {
  const task = data.tasks.find((item) => item.id === taskId);
  const next = task ? skipOccurrence(data, task, now) : data;
  return { ...next, tasks: next.tasks.filter((item) => item.id !== taskId) };
}

/** Moving one occurrence leaves its daily schedule running for future dates. */
export function moveTaskOccurrenceToWeek(data: WorkspaceData, taskId: string, now: string): WorkspaceData {
  const task = data.tasks.find((item) => item.id === taskId);
  const today = getLagosDayKey(new Date(now));
  if (!task || task.period !== "day" || task.periodKey !== today) return data;
  const next = skipOccurrence(data, task, now);
  return { ...next, tasks: moveDailyTaskToWeek(next.tasks, taskId, now).map((item) => item.id === taskId
    ? { ...item, recurringTaskId: undefined } : item) };
}
