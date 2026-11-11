"use client";

import { useId, useState, type DragEvent, type FormEvent } from "react";
import type { Task, TaskPeriod, TaskStatus } from "@/app/lib/workspace";
import type { TaskChange } from "@/app/lib/planner";
import TaskMenu, { type TaskMenuAction } from "./task-menu";

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
};

type TaskActions = {
  onUpdate: (taskId: string, change: TaskChange) => void;
  onDelete: (taskId: string) => void;
  context?: TaskContextActions;
};

function TaskItem({
  task,
  sourceLabel,
  onUpdate,
  onDelete,
  context,
}: TaskActions & { task: Task; sourceLabel?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const editId = useId();
  const deleteLabel = task.period === "week" ? "Delete weekly task" : "Delete task";
  const menuActions: TaskMenuAction[] = [
    { label: "Edit", onSelect: () => { setDraft(task.title); setIsEditing(true); } },
  ];
  if (context && task.period === "day" && task.periodKey === context.todayKey) {
    menuActions.push({ label: "Move to this week", onSelect: () => context.onMoveToWeek(task.id) });
  }
  if (context && task.period === "week") {
    if (context.onDismissForToday) menuActions.push({ label: "Dismiss for today", onSelect: () => context.onDismissForToday?.(task.id) });
    if (context.onShowInToday && task.dismissedOn === context.todayKey) {
      menuActions.push({ label: "Show in Today", onSelect: () => context.onShowInToday?.(task.id) });
    }
  }
  menuActions.push({ label: deleteLabel, danger: true, onSelect: () => setIsConfirmingDelete(true) });

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onUpdate(task.id, { title });
    setIsEditing(false);
  }

  return (
    <div className={`task-item status-${task.status}${task.status === "done" ? " is-done" : ""}`}>
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
            <button className="text-button" type="submit" disabled={!draft.trim()}>Save</button>
            <button className="text-button muted-button" type="button" onClick={() => { setDraft(task.title); setIsEditing(false); }}>Cancel</button>
          </form>
        ) : (
          <>
            <span className="task-title">{task.title}</span>
            {sourceLabel && <span className="task-origin">{sourceLabel}</span>}
          </>
        )}
      </div>

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
    </div>
  );
}

export function TaskBoard({
  tasks,
  sourceLabel,
  onUpdate,
  onDelete,
  context,
}: TaskActions & {
  tasks: Task[];
  sourceLabel?: (task: Task) => string;
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
}: {
  period: TaskPeriod;
  periodKey: string;
  title: string;
  detail: string;
  tasks: Task[];
  view: "list" | "board";
  onViewChange: (view: "list" | "board") => void;
  onAddTask: (title: string, period: TaskPeriod, periodKey: string) => void;
  onUpdateTask: (taskId: string, change: TaskChange) => void;
  onDeleteTask: (taskId: string) => void;
  context?: TaskContextActions;
}) {
  const [newTask, setNewTask] = useState("");
  const titleId = useId();
  const sourceLabel = (task: Task) => period === "day" && task.period === "week" ? "From this week’s list" : "";

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    onAddTask(title, period, periodKey);
    setNewTask("");
  }

  return (
    <section className={`task-panel task-panel-${period}`} aria-labelledby={titleId}>
      <header className="task-panel-heading">
        <div>
          <p className="panel-kicker">{period === "day" ? "DAILY LIST" : "WEEKLY LIST"}</p>
          <h2 id={titleId}>{title}</h2>
          <p className="panel-detail">{detail}</p>
        </div>
        <div className="view-toggle" role="group" aria-label={`View ${title}`}>
          <button type="button" aria-pressed={view === "list"} className={view === "list" ? "is-selected" : ""} onClick={() => onViewChange("list")}>List</button>
          <button type="button" aria-pressed={view === "board"} className={view === "board" ? "is-selected" : ""} onClick={() => onViewChange("board")}>Board</button>
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
        <button type="submit" disabled={!newTask.trim()}>Add</button>
      </form>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <span className="empty-mark" aria-hidden="true">{period === "day" ? "○" : "✳"}</span>
          <p>{period === "day" ? "A clear day starts here." : "Your week is open."}</p>
          <span>Add a task when you are ready.</span>
        </div>
      ) : view === "list" ? (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskItem task={task} sourceLabel={sourceLabel(task)} context={context} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
            </li>
          ))}
        </ul>
      ) : (
        <TaskBoard tasks={tasks} sourceLabel={sourceLabel} context={context} onUpdate={onUpdateTask} onDelete={onDeleteTask} />
      )}
      <div className="panel-footnote">
        <span>{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
        <span>{tasks.filter((task) => task.status === "done").length} done</span>
      </div>
    </section>
  );
}
