"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/app/hooks/use-workspace";
import {
  addDaysToKey,
  createId,
  formatDayLabel,
  formatWeekRange,
  getLagosDayKey,
  getWeekStartKey,
  addCustomCategory,
  filterByCategory,
  normalizeCategoryName,
  type Task,
  type TaskPeriod,
  type WorkspaceData,
} from "@/app/lib/workspace";
import { TaskBoard, TaskCollection } from "@/app/components/task-collection";
import { CategoryFilter } from "@/app/components/category-controls";
import StorageNotice from "@/app/components/storage-notice";
import { changeTask, copyTaskToPeriod, moveDailyTaskToWeek, selectPlannerTasks, setWeeklyDismissal, type TaskChange } from "@/app/lib/planner";

type RolloverReview = {
  key: string;
  period: TaskPeriod;
  sourceKey: string;
  targetKey: string;
  tasks: Task[];
};

function findRolloverReviews(data: WorkspaceData, todayKey: string, weekKey: string) {
  const transitions: { period: TaskPeriod; sourceKey: string; targetKey: string }[] = [
    { period: "day", sourceKey: addDaysToKey(todayKey, -1), targetKey: todayKey },
    { period: "week", sourceKey: addDaysToKey(weekKey, -7), targetKey: weekKey },
  ];

  return transitions.flatMap((transition) => {
    const key = `${transition.period}:${transition.sourceKey}->${transition.targetKey}`;
    if (data.rolloverHandled[key]) return [];
    const tasks = data.tasks.filter(
      (task) => task.period === transition.period && task.periodKey === transition.sourceKey && task.status !== "done",
    );
    return tasks.length ? [{ ...transition, key, tasks }] : [];
  });
}

function CarryoverPrompt({
  review,
  onCarry,
  onKeep,
}: {
  review: RolloverReview;
  onCarry: (taskIds: string[]) => void;
  onKeep: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState(() => review.tasks.map((task) => task.id));
  const periodLabel = review.period === "day" ? "yesterday" : "last week";
  const targetLabel = review.period === "day" ? "today" : "this week";
  const headingId = `carryover-${review.key.replace(/[^a-z0-9]/gi, "-")}`;

  function toggleTask(taskId: string) {
    setSelectedIds((current) => current.includes(taskId)
      ? current.filter((id) => id !== taskId)
      : [...current, taskId]);
  }

  return (
    <section className="carryover-card" aria-labelledby={headingId}>
      <div className="carryover-icon" aria-hidden="true">↗</div>
      <div className="carryover-content">
        <p className="panel-kicker">A FRESH START</p>
        <h2 id={headingId}>Bring anything forward?</h2>
        <p className="carryover-description">These tasks from {periodLabel} are still open. Choose what you want to try again {targetLabel}.</p>
        <div className="carryover-list">
          {review.tasks.map((task) => (
            <label key={task.id} className="carryover-task">
              <input
                type="checkbox"
                checked={selectedIds.includes(task.id)}
                onChange={() => toggleTask(task.id)}
              />
              <span>{task.title}</span>
            </label>
          ))}
        </div>
        <div className="carryover-actions">
          <button className="button button-primary" type="button" disabled={!selectedIds.length} onClick={() => onCarry(selectedIds)}>
            Carry selected
          </button>
          <button className="button button-quiet" type="button" onClick={onKeep}>Keep in history</button>
        </div>
      </div>
    </section>
  );
}

function LoadingPanels({ showWeek }: { showWeek: boolean }) {
  return (
    <div className={`planner-grid${showWeek ? " is-two-periods" : " is-one-period"}`} aria-label="Loading your planner" aria-busy="true">
      {(showWeek ? [0, 1] : [0]).map((item) => (
        <section className="task-panel loading-panel" key={item}>
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-input" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </section>
      ))}
    </div>
  );
}

function HistoryTaskRow({ task, onDelete }: { task: Task; onDelete: (taskId: string) => void }) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const statusLabel = task.status === "todo" ? "To do" : task.status === "doing" ? "Doing" : "Done";

  return (
    <li className={task.status === "done" ? "is-done" : ""}>
      <span className={`history-status status-${task.status}`} aria-label={statusLabel} />
      <span className="history-task-title">{task.title}</span>
      <span className={`history-status-label status-label-${task.status}`}>{statusLabel}</span>
      <div className="history-actions">
        {isConfirmingDelete ? (
          <>
            <span className="delete-question">Delete?</span>
            <button className="icon-action delete-confirm" type="button" onClick={() => onDelete(task.id)}>Delete</button>
            <button className="icon-action" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
          </>
        ) : (
          <button
            className="icon-action history-delete-action"
            type="button"
            aria-label={`Delete ${task.title} from history`}
            onClick={() => setIsConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { data, isLoaded, isConnected, storageMessage, retryConnection, updateWorkspace } = useWorkspace();
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [combined, setCombined] = useState(false);
  const [showWeek, setShowWeek] = useState(false);
  const [dayView, setDayView] = useState<"list" | "board">("list");
  const [weekView, setWeekView] = useState<"list" | "board">("list");
  const [dayCategory, setDayCategory] = useState("");
  const [weekCategory, setWeekCategory] = useState("");
  const [combinedCategory, setCombinedCategory] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<TaskPeriod>("day");
  const [historySelection, setHistorySelection] = useState("");

  useEffect(() => {
    const syncHistoryFromHash = () => setHistoryOpen(window.location.hash === "#history");
    const openHistoryFromNavigation = () => setHistoryOpen(true);
    syncHistoryFromHash();
    window.addEventListener("hashchange", syncHistoryFromHash);
    window.addEventListener("yinxwrld:open-history", openHistoryFromNavigation);
    return () => {
      window.removeEventListener("hashchange", syncHistoryFromHash);
      window.removeEventListener("yinxwrld:open-history", openHistoryFromNavigation);
    };
  }, []);

  useEffect(() => {
    if (!historyOpen || !isLoaded || window.location.hash !== "#history") return;
    document.getElementById("history-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [historyOpen, isLoaded]);

  useEffect(() => {
    let timer: number;
    const updateClock = () => {
      window.clearTimeout(timer);
      const now = new Date();
      const day = getLagosDayKey(now);
      setTodayKey(day);
      const nextMidnight = Date.parse(`${addDaysToKey(day, 1)}T00:00:00+01:00`);
      timer = window.setTimeout(updateClock, nextMidnight - now.getTime() + 100);
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") updateClock(); };
    updateClock();
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const weekKey = todayKey ? getWeekStartKey(todayKey) : null;
  const categories = data.categories ?? [];
  const { dayTasks, weekTasks, currentTasks } = selectPlannerTasks(data.tasks, todayKey);
  const visibleCurrentTasks = filterByCategory(currentTasks, combinedCategory);
  const pastDayKeys = [...new Set(data.tasks.filter((task) => task.period === "day" && task.periodKey !== todayKey).map((task) => task.periodKey))].sort().reverse();
  const pastWeekKeys = [...new Set(data.tasks.filter((task) => task.period === "week" && task.periodKey !== weekKey).map((task) => task.periodKey))].sort().reverse();
  const historyKeys = historyPeriod === "day" ? pastDayKeys : pastWeekKeys;
  const selectedHistoryKey = historyKeys.includes(historySelection) ? historySelection : historyKeys[0] ?? "";
  const historyTasks = selectedHistoryKey
    ? data.tasks.filter((task) => task.period === historyPeriod && task.periodKey === selectedHistoryKey)
    : [];
  const rolloverReviews = todayKey && weekKey ? findRolloverReviews(data, todayKey, weekKey) : [];

  function addTask(title: string, period: TaskPeriod, periodKey: string, categoryInput: string) {
    const now = new Date().toISOString();
    const task: Task = {
      id: createId(),
      title,
      period,
      periodKey,
      status: "todo",
      createdAt: now,
      updatedAt: now,
    };
    updateWorkspace((current) => {
      const category = normalizeCategoryName(categoryInput, current.categories ?? []);
      return {
        ...current,
        categories: addCustomCategory(current.categories ?? [], category),
        tasks: [...current.tasks, category ? { ...task, category } : task],
      };
    });
  }

  function updateTask(taskId: string, change: TaskChange) {
    const now = new Date().toISOString();
    updateWorkspace((current) => {
      const hasCategory = Object.prototype.hasOwnProperty.call(change, "category");
      const category = hasCategory ? normalizeCategoryName(change.category ?? "", current.categories ?? []) : undefined;
      return {
        ...current,
        categories: hasCategory ? addCustomCategory(current.categories ?? [], category) : current.categories,
        tasks: changeTask(current.tasks, taskId, hasCategory ? { ...change, category } : change, now),
      };
    });
  }

  function moveToWeek(taskId: string) {
    const now = new Date().toISOString();
    updateWorkspace((current) => ({ ...current, tasks: moveDailyTaskToWeek(current.tasks, taskId, now) }));
  }

  function setDismissed(taskId: string, dismissed: boolean) {
    const now = new Date().toISOString();
    updateWorkspace((current) => ({ ...current, tasks: setWeeklyDismissal(current.tasks, taskId, dismissed, now) }));
  }

  const taskContext = {
    todayKey: todayKey ?? "",
    onMoveToWeek: moveToWeek,
    onShowInToday: (taskId: string) => setDismissed(taskId, false),
  };

  function deleteTask(taskId: string) {
    updateWorkspace((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }));
  }

  function markRolloverHandled(review: RolloverReview, outcome: "carried" | "kept", selectedIds: string[] = []) {
    const now = new Date().toISOString();
    const copiedIds = new Map(selectedIds.map((id) => [id, createId()]));
    updateWorkspace((current) => {
      if (current.rolloverHandled[review.key]) return current;
      const sourceTasks = current.tasks.filter((task) => selectedIds.includes(task.id));
      const carriedTasks = sourceTasks.filter((task) => task.status !== "done")
        .map((task) => copyTaskToPeriod(task, copiedIds.get(task.id)!, review.targetKey, now));

      return {
        ...current,
        tasks: carriedTasks.length ? [...current.tasks, ...carriedTasks] : current.tasks,
        rolloverHandled: { ...current.rolloverHandled, [review.key]: outcome },
      };
    });
  }

  return (
    <div className={`page-content dashboard-page${!showWeek && !combined ? " is-day-only" : ""}`}>
      <header className="page-heading dashboard-heading">
        <div className="heading-copy">
          <p className="eyebrow">{todayKey ? formatDayLabel(todayKey) : "YOUR PERSONAL SPACE"}</p>
          <h1>What’s on today?</h1>
        </div>
      </header>

      {storageMessage && <StorageNotice message={storageMessage} onRetry={isConnected ? undefined : retryConnection} />}

      {isConnected && rolloverReviews.map((review) => (
        <CarryoverPrompt
          key={review.key}
          review={review}
          onCarry={(selectedIds) => markRolloverHandled(review, "carried", selectedIds)}
          onKeep={() => markRolloverHandled(review, "kept")}
        />
      ))}

      <section className="planner-section" aria-labelledby="planner-heading">
        <header className="section-heading planner-section-heading">
          <div>
            <h2 id="planner-heading">{combined ? "Everything in motion" : showWeek ? "The days ahead" : "Your list"}</h2>
          </div>
          <div className="planner-heading-actions">
            {!combined && (
              <button
                className={`button button-quiet show-week-button${showWeek ? " is-on" : ""}`}
                type="button"
                aria-pressed={showWeek}
                onClick={() => setShowWeek((current) => !current)}
              >
                {showWeek ? "Today only" : "Show both"}
              </button>
            )}
            {(showWeek || combined) && (
              <button
                className={`button combine-button${combined ? " is-on" : ""}`}
                type="button"
                aria-pressed={combined}
                onClick={() => setCombined((current) => !current)}
              >
                <span aria-hidden="true">{combined ? "↙" : "⇄"}</span>
                {combined ? "Separate lists" : "Combine on a board"}
              </button>
            )}
          </div>
        </header>

        {!isLoaded || !todayKey || !weekKey ? (
          <LoadingPanels showWeek={showWeek} />
        ) : !isConnected ? (
          <div className="empty-state mongo-unavailable">
            <span className="empty-mark" aria-hidden="true">!</span>
            <p>Reconnect to MongoDB to open your lists.</p>
            <span>Your workspace is not stored on this device.</span>
          </div>
        ) : combined ? (
          <section className="combined-board-panel" aria-label="Combined current tasks">
            <div className="combined-board-heading">
              <div>
                <h3>Everything in motion</h3>
                <p>Today and this week, together.</p>
              </div>
              <div className="combined-board-tools">
                <CategoryFilter id="combined-category-filter" value={combinedCategory} categories={categories} onChange={setCombinedCategory} />
                <span className="task-total-pill">{visibleCurrentTasks.length} {visibleCurrentTasks.length === 1 ? "task" : "tasks"}</span>
              </div>
            </div>
            {visibleCurrentTasks.length ? (
              <TaskBoard
                tasks={visibleCurrentTasks}
                sourceLabel={(task) => task.period === "day" ? "Today" : "This week"}
                onUpdate={updateTask}
                onDelete={deleteTask}
                context={taskContext}
                categories={categories}
              />
            ) : currentTasks.length ? (
              <div className="combined-empty empty-state">
                <span className="empty-mark" aria-hidden="true">⌕</span>
                <p>No tasks in {combinedCategory}.</p>
                <button className="text-button" type="button" onClick={() => setCombinedCategory("")}>Show all categories</button>
              </div>
            ) : (
              <div className="combined-empty empty-state">
                <span className="empty-mark" aria-hidden="true">⇄</span>
                <p>Nothing in motion yet.</p>
                <span>Add tasks to either list and they will meet here.</span>
              </div>
            )}
          </section>
        ) : (
          <div className={`planner-grid${showWeek ? " is-two-periods" : " is-one-period"}`}>
            <TaskCollection
              period="day"
              periodKey={todayKey}
              title="Today"
              detail={formatDayLabel(todayKey, { weekday: undefined })}
              tasks={dayTasks}
              categories={categories}
              selectedCategory={dayCategory}
              onCategoryChange={setDayCategory}
              view={dayView}
              onViewChange={setDayView}
              onAddTask={addTask}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              context={{ ...taskContext, onDismissForToday: (taskId) => setDismissed(taskId, true) }}
            />
            {showWeek && (
              <TaskCollection
                period="week"
                periodKey={weekKey}
                title="This week"
                detail={formatWeekRange(weekKey)}
                tasks={weekTasks}
                categories={categories}
                selectedCategory={weekCategory}
                onCategoryChange={setWeekCategory}
                view={weekView}
                onViewChange={setWeekView}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                context={taskContext}
              />
            )}
          </div>
        )}
      </section>

      {historyOpen && isLoaded && isConnected && (
        <section className="history-panel" id="history-panel" aria-labelledby="history-heading">
          <header className="history-panel-header">
            <div>
              <p className="panel-kicker">YOUR PAST LISTS</p>
              <h2 id="history-heading">Look back</h2>
              <p>Previous lists stay here, just as you left them.</p>
            </div>
            <div className="history-controls">
              <button className="button button-quiet" type="button" onClick={() => {
                setHistoryOpen(false);
                window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
                window.dispatchEvent(new Event("hashchange"));
              }}>Close</button>
              <div className="view-toggle" role="group" aria-label="Choose history period">
                <button type="button" className={historyPeriod === "day" ? "is-selected" : ""} aria-pressed={historyPeriod === "day"} onClick={() => { setHistoryPeriod("day"); setHistorySelection(""); }}>Days</button>
                <button type="button" className={historyPeriod === "week" ? "is-selected" : ""} aria-pressed={historyPeriod === "week"} onClick={() => { setHistoryPeriod("week"); setHistorySelection(""); }}>Weeks</button>
              </div>
              {historyKeys.length > 0 && (
                <label className="sr-only" htmlFor="history-period-select">Choose a past {historyPeriod === "day" ? "day" : "week"}</label>
              )}
              {historyKeys.length > 0 && (
                <select id="history-period-select" className="history-select" value={selectedHistoryKey} onChange={(event) => setHistorySelection(event.target.value)}>
                  {historyKeys.map((key) => <option key={key} value={key}>{historyPeriod === "day" ? formatDayLabel(key) : formatWeekRange(key)}</option>)}
                </select>
              )}
            </div>
          </header>

          {historyTasks.length ? (
            <ul className="history-list">
              {historyTasks.map((task) => (
                <HistoryTaskRow key={task.id} task={task} onDelete={deleteTask} />
              ))}
            </ul>
          ) : (
            <div className="history-empty empty-state">
              <span className="empty-mark" aria-hidden="true">↶</span>
              <p>{historyKeys.length ? "No tasks in this list." : `No past ${historyPeriod === "day" ? "days" : "weeks"} yet.`}</p>
              <span>When a period has tasks, its list will be kept here.</span>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

