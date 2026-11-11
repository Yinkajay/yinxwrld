"use client";

import { useId, useState, type DragEvent, type FormEvent } from "react";
import type { RecurringTask, Task, TaskPeriod, TaskRepeat, TaskStatus } from "@/app/lib/workspace";
import { repeatLabel, type TaskEditChange } from "@/app/lib/recurrence";
import { RepeatInput } from "./repeat-controls";
import TaskMenu, { type TaskMenuAction } from "./task-menu";
import { CategoryBadge, CategoryFilter, CategoryInput } from "./category-controls";
import { filterByCategory } from "@/app/lib/workspace";

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

export type TaskContextActions = {
  todayKey: string;
  onMoveToWeek: (taskId: string) => void;
  onDismissForToday?: (taskId: string) => void;
  onShowInToday?: (taskId: string) => void;
  recurringTasks: RecurringTask[];
  onStopRepeating: (seriesId: string) => void;
};

type TaskActions = {
  onUpdate: (taskId: string, change: TaskEditChange) => void;
  onDelete: (taskId: string) => void;
  context?: TaskContextActions;
};

function TaskItem({
  task,
  sourceLabel,
  onUpdate,
  onDelete,
  context,
  categories,
}: TaskActions & { task: Task; sourceLabel?: string; categories: string[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [draftCategory, setDraftCategory] = useState(task.category ?? "");
  const series = context?.recurringTasks.find((item) => item.id === task.recurringTaskId && item.active);
  const [draftRepeat, setDraftRepeat] = useState<TaskRepeat>(series?.repeat ?? "none");
  const editId = useId();
  const deleteLabel = task.recurringTaskId ? "Delete this occurrence" : task.period === "week" ? "Delete weekly task" : "Delete task";
  const menuActions: TaskMenuAction[] = [
    { label: "Edit", onSelect: () => { setDraft(task.title); setDraftCategory(task.category ?? ""); setDraftRepeat(series?.repeat ?? "none"); setIsEditing(true); } },
  ];
  if (context && task.period === "day" && task.periodKey === context.todayKey) {
    menuActions.push({ label: task.recurringTaskId ? "Move this occurrence to this week" : "Move to this week", onSelect: () => context.onMoveToWeek(task.id) });
  }
  if (context && task.period === "week") {
    if (context.onDismissForToday) menuActions.push({ label: "Dismiss for today", onSelect: () => context.onDismissForToday?.(task.id) });
    if (context.onShowInToday && task.dismissedOn === context.todayKey) {
      menuActions.push({ label: "Show in Today", onSelect: () => context.onShowInToday?.(task.id) });
    }
  }
  if (series && context) menuActions.push({ label: "Stop repeating", onSelect: () => context.onStopRepeating(series.id) });
  menuActions.push({ label: deleteLabel, danger: true, onSelect: () => setIsConfirmingDelete(true) });

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onUpdate(task.id, { title, category: draftCategory.trim() || undefined, repeat: draftRepeat });
    setIsEditing(false);
  }

  return (
    <div className={`task-item status-${task.status}${task.status === "done" ? " is-done" : ""}${isEditing ? " is-editing" : ""}`}>
      <button
        className="task-check"
        type="button"
        aria-label={task.status === "done" ? `Mark ${task.title} as to do` : `Mark ${task.title} as done`}
        aria-pressed={task.status === "done"}
        onClick={() => onUpdate(task.id, { status: task.status === "done" ? "todo" : "done" })}
      >
        {task.status === "done" ? "✓" : ""}
      </button>

      <div className="task-item-body">
        {isEditing ? (
          <form className="inline-edit-form" onSubmit={saveEdit}>
            <label className="sr-only" htmlFor={editId}>Edit task</label>
            <input
              autoFocus
              id={editId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={180}
            />
            <CategoryInput
              id={`${editId}-category`}
              value={draftCategory}
              categories={categories}
              onChange={setDraftCategory}
              className="task-edit-category"
            />
            <label className="task-edit-status" htmlFor={`${editId}-status`}>
              <span id={`${editId}-status-label`}>Status</span>
              <select
                id={`${editId}-status`}
                aria-labelledby={`${editId}-status-label`}
                className="status-select"
                value={task.status}
                onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus })}
              >
                {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <div className="task-edit-repeat">
              <RepeatInput id={`${editId}-repeat`} value={draftRepeat} period={task.period} onChange={setDraftRepeat} />
              {draftRepeat !== "none" && <span className="repeat-hint">Edits apply to this task and future repeats.{draftRepeat === "weekly" && task.period === "day" ? " Repeats on this weekday." : ""}</span>}
              {series && draftRepeat === "none" && <span className="repeat-hint">Stops future repeats. This task stays.</span>}
            </div>
            <div className="task-edit-actions">
              <button className="text-button" type="submit" disabled={!draft.trim()}>Save</button>
              <button className="text-button muted-button" type="button" onClick={() => { setDraft(task.title); setDraftCategory(task.category ?? ""); setIsEditing(false); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <span className="task-title">{task.title}</span>
            <CategoryBadge category={task.category} />
            {series && <span className="task-repeat-label">{repeatLabel(series.repeat)}</span>}
            {sourceLabel && <span className="task-origin">{sourceLabel}</span>}
          </>
        )}
      </div>

      {!isEditing && (
        <>
          <label className="sr-only" htmlFor={`${editId}-status`}>Status for {task.title}</label>
          <select
            id={`${editId}-status`}
            className="status-select"
            value={task.status}
            onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus })}
          >
            {statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
          </select>

          <div className="task-actions">
            {isConfirmingDelete ? (
              <>
                <button autoFocus className="icon-action delete-confirm" type="button" aria-label={`${deleteLabel}: ${task.title}`} onClick={() => onDelete(task.id)}>{deleteLabel}?</button>
                <button className="icon-action" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
              </>
            ) : (
              <TaskMenu title={task.title} actions={menuActions} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function TaskBoard({
  tasks,
  sourceLabel,
  categories,
  onUpdate,
  onDelete,
  context,
}: TaskActions & {
  tasks: Task[];
  sourceLabel?: (task: Task) => string;
  categories: string[];
}) {
  function dropTask(event: DragEvent<HTMLDivElement>, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId && tasks.some((task) => task.id === taskId)) onUpdate(taskId, { status });
  }

  return (
    <div className="kanban-board">
      {statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status.value);
        return (
          <div
            key={status.value}
            className={`kanban-column column-${status.value}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropTask(event, status.value)}
            role="group"
            aria-label={`${status.label} tasks`}
          >
            <div className="kanban-column-heading">
              <h3>{status.label}</h3>
              <span>{columnTasks.length}</span>
            </div>
            {columnTasks.length ? (
              <ul className="kanban-list">
                {columnTasks.map((task) => (
                  <li key={task.id}>
                    <article
                      className="kanban-card"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", task.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <TaskItem
                        task={task}
                        sourceLabel={sourceLabel?.(task)}
                        categories={categories}
                        onUpdate={(taskId, change) => onUpdate(taskId, change)}
                        onDelete={onDelete}
                        context={context}
                      />
                    </article>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="column-empty">Drop a task here</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TaskCollection({
  period,
  periodKey,
  title,
  detail,
  tasks,
  view,
  onViewChange,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  context,
  categories,
  selectedCategory,
  onCategoryChange,
}: {
  period: TaskPeriod;
  periodKey: string;
  title: string;
  detail: string;
  tasks: Task[];
  view: "list" | "board";
  onViewChange: (view: "list" | "board") => void;
  onAddTask: (title: string, period: TaskPeriod, periodKey: string, category: string, repeat: TaskRepeat) => void;
  onUpdateTask: (taskId: string, change: TaskEditChange) => void;
  onDeleteTask: (taskId: string) => void;
  context?: TaskContextActions;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("");
  const [newTaskRepeat, setNewTaskRepeat] = useState<TaskRepeat>("none");
  const titleId = useId();
  const visibleTasks = filterByCategory(tasks, selectedCategory);
  const sourceLabel = (task: Task) => period === "day" && task.period === "week" ? "From this week’s list" : "";

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    onAddTask(title, period, periodKey, newTaskCategory, newTaskRepeat);
    setNewTask("");
    setNewTaskCategory("");
    setNewTaskRepeat("none");
  }

  return (
    <section className={`task-panel task-panel-${period}`} aria-labelledby={titleId}>
      <header className="task-panel-heading">
        <div>
          <p className="panel-kicker">{period === "day" ? "DAILY LIST" : "WEEKLY LIST"}</p>
          <h2 id={titleId}>{title}</h2>
          <p className="panel-detail">{detail}</p>
        </div>
        <div className="task-panel-tools">
          <CategoryFilter
            id={`${titleId}-category-filter`}
            value={selectedCategory}
            categories={categories}
            onChange={onCategoryChange}
          />
          <div className="view-toggle" role="group" aria-label={`View ${title}`}>
            <button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-selected" : ""} onClick={() => onViewChange("list")}>List</button>
            <button type="button" aria-pressed={view === "board"} className={view === "board" ? "is-selected" : ""} onClick={() => onViewChange("board")}>Board</button>
          </div>
        </div>
      </header>

      <form className="add-task-form" onSubmit={submitTask}>
        <label className="sr-only" htmlFor={`${titleId}-new`}>Add a task to {title}</label>
        <span className="add-plus" aria-hidden="true">+</span>
        <input
          id={`${titleId}-new`}
          value={newTask}
          onChange={(event) => setNewTask(event.target.value)}
          placeholder={period === "day" ? "Add something for today" : "Add something for this week"}
          maxLength={180}
        />
        <div className="add-task-options">
          <CategoryInput
            id={`${titleId}-new-category`}
            value={newTaskCategory}
            categories={categories}
            onChange={setNewTaskCategory}
            className="add-task-category"
          />
          <RepeatInput id={`${titleId}-new-repeat`} value={newTaskRepeat} period={period} onChange={setNewTaskRepeat} />
        </div>
        <button type="submit" disabled={!newTask.trim()}>Add</button>
      </form>

      {visibleTasks.length === 0 && tasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark" aria-hidden="true">{period === "day" ? "○" : "✳"}</span>
          <p>{period === "day" ? "A clear day starts here." : "Your week is open."}</p>
          <span>Add a task when you are ready.</span>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="empty-state filtered-empty-state">
          <span className="empty-mark" aria-hidden="true">⌕</span>
          <p>No {title.toLowerCase()} in {selectedCategory}.</p>
          <button className="text-button" type="button" onClick={() => onCategoryChange("")}>Show all categories</button>
        </div>
      ) : view === "list" ? (
        <ul className="task-list">
          {visibleTasks.map((task) => (
            <li key={task.id}>
              <TaskItem task={task} sourceLabel={sourceLabel(task)} context={context} categories={categories} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
            </li>
          ))}
        </ul>
      ) : (
        <TaskBoard tasks={visibleTasks} sourceLabel={sourceLabel} context={context} categories={categories} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
      )}
      <div className="panel-footnote">
        <span>{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"}</span>
        <span>{visibleTasks.filter((task) => task.status === "done").length} done</span>
      </div>
    </section>
  );
}
