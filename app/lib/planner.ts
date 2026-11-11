import { getLagosDayKey, getWeekStartKey, type Task } from "./workspace";

export type TaskChange = Partial<Pick<Task, "title" | "status" | "category">>;

export function selectPlannerTasks(tasks: Task[], today: string | null) {
  if (!today) return { dayTasks: [], weekTasks: [], currentTasks: [] };
  const week = getWeekStartKey(today);
  const nativeDaily = tasks.filter((task) => task.period === "day" && task.periodKey === today);
  const weekTasks = tasks.filter((task) => task.period === "week" && task.periodKey === week);
  const visibleWeekly = weekTasks.filter((task) => task.dismissedOn !== today &&
    (task.status !== "done" || (task.completedAt && getLagosDayKey(new Date(task.completedAt)) === today)));

  return {
    dayTasks: [...nativeDaily, ...visibleWeekly],
    weekTasks,
    // Use sources, not daily projections, so each task appears once.
    currentTasks: [...nativeDaily, ...weekTasks],
  };
}

export function changeTask(tasks: Task[], taskId: string, change: TaskChange, now: string) {
  return tasks.map((task) => {
    if (task.id !== taskId) return task;
    const statusChanged = change.status !== undefined && change.status !== task.status;
    return {
      ...task,
      ...change,
      completedAt: statusChanged ? (change.status === "done" ? now : undefined) : task.completedAt,
      updatedAt: now,
    };
  });
}

export function setWeeklyDismissal(tasks: Task[], taskId: string, dismissed: boolean, now: string) {
  const today = getLagosDayKey(new Date(now));
  return tasks.map((task) => task.id === taskId && task.period === "week" && task.periodKey === getWeekStartKey(today)
    ? { ...task, dismissedOn: dismissed ? today : undefined, updatedAt: now } : task);
}

export function moveDailyTaskToWeek(tasks: Task[], taskId: string, now: string) {
  const today = getLagosDayKey(new Date(now));
  return tasks.map((task) => task.id === taskId && task.period === "day" && task.periodKey === today ? {
    ...task,
    period: "week" as const,
    periodKey: getWeekStartKey(today),
    dismissedOn: undefined,
    completedAt: task.status === "done"
      ? (task.completedAt && getLagosDayKey(new Date(task.completedAt)) === today ? task.completedAt : now) : undefined,
    updatedAt: now,
  } : task);
}

export function copyTaskToPeriod(task: Task, id: string, targetKey: string, now: string): Task {
  return {
    ...task,
    id,
    periodKey: targetKey,
    carriedFrom: task.id,
    dismissedOn: undefined,
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}
