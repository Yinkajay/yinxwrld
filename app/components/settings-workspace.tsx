"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { useWorkspace } from "@/app/hooks/use-workspace";
import { CategoryInput } from "./category-controls";
import StorageNotice from "./storage-notice";
import { RepeatInput } from "./repeat-controls";
import { editRecurringSchedule, repeatLabel, setRecurringScheduleActive } from "@/app/lib/recurrence";
import {
  addWorkspaceCategory, changeWorkspaceSettings, countCategoryReferences, getWorkspaceCategories, getWorkspaceSettings,
  removeWorkspaceCategory, renameWorkspaceCategory, type SettingsPatch,
} from "@/app/lib/workspace-settings";
import { MAX_CATEGORY_LENGTH, type RecurringTask, type TaskRepeat, type WorkspaceScene, type WorkspaceSettings } from "@/app/lib/workspace";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const scenes: { value: WorkspaceScene; label: string }[] = [
  { value: "sunset", label: "Sunset meadow" }, { value: "winter", label: "Winter campfire" },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "This change could not be saved.";
}

function SelectSetting({ id, label, value, onChange, children }: {
  id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  return (
    <label className="settings-select" htmlFor={id}>
      <span id={`${id}-label`}>{label}</span>
      <select id={id} aria-labelledby={`${id}-label`} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function CategoryRow({ name }: { name: string }) {
  const { data, updateWorkspace } = useWorkspace();
  const categories = getWorkspaceCategories(data);
  const [mode, setMode] = useState<"view" | "rename" | "remove">("view");
  const [draft, setDraft] = useState(name);
  const [replacement, setReplacement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = countCategoryReferences(data, name);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const now = new Date().toISOString();
    const mutate = mode === "rename"
      ? (current: typeof data) => renameWorkspaceCategory(current, name, draft, now)
      : (current: typeof data) => removeWorkspaceCategory(current, name, replacement || undefined, now);
    try {
      mutate(data);
      setBusy(true);
      if (await updateWorkspace(mutate, { optimistic: false })) setMode("view");
      else setError("Could not save this change. Your draft is still here.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return (
    <li className="settings-item" data-category={name}>
      <div className="settings-item-heading">
        <div className="settings-item-copy"><strong>{name}</strong><span>{count} linked {count === 1 ? "item" : "items"}</span></div>
        {mode === "view" && <div className="settings-item-actions">
          <button className="text-button" type="button" aria-label={`Rename ${name}`} onClick={() => { setDraft(name); setError(null); setMode("rename"); }}>Rename</button>
          <button className="text-button danger-text" type="button" aria-label={`Remove ${name}`} onClick={() => { setReplacement(""); setError(null); setMode("remove"); }}>Remove</button>
        </div>}
      </div>
      {mode !== "view" && <form className="settings-editor" onSubmit={save}>
        {mode === "rename" ? <label className="settings-field"><span>Category name</span><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_CATEGORY_LENGTH} required /></label> : <>
          <p>Remove {name}? Your tasks and projects will stay. Choose where to move the {count} linked {count === 1 ? "item" : "items"}.</p>
          <SelectSetting id={`replace-category-${encodeURIComponent(name)}`} label="Move items to" value={replacement} onChange={setReplacement}>
            <option value="">Uncategorized</option>
            {categories.filter((item) => item !== name).map((item) => <option key={item} value={item}>{item}</option>)}
          </SelectSetting>
        </>}
        {error && <p className="settings-error" role="alert">{error}</p>}
        <div className="settings-editor-actions">
          <button className={`button button-small ${mode === "remove" ? "button-quiet danger-text" : "button-primary"}`} disabled={busy} type="submit">{busy ? "Saving…" : mode === "rename" ? "Save category" : "Remove category"}</button>
          <button className="button button-quiet button-small" disabled={busy} type="button" onClick={() => setMode("view")}>Cancel</button>
        </div>
      </form>}
    </li>
  );
}

function CategoryManager() {
  const { data, updateWorkspace } = useWorkspace();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      addWorkspaceCategory(data, draft);
      setBusy(true);
      if (await updateWorkspace((current) => addWorkspaceCategory(current, draft), { optimistic: false })) setDraft("");
      else setError("Could not add this category. Try again.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const categories = getWorkspaceCategories(data);
  return <>
    <form className="settings-add-form" onSubmit={add}>
      <label className="settings-field"><span>New category</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Name your category" maxLength={MAX_CATEGORY_LENGTH} required /></label>
      <button className="button button-primary button-small" type="submit" disabled={busy || !draft.trim()}>{busy ? "Saving…" : "Add category"}</button>
    </form>
    {error && <p className="settings-error" role="alert">{error}</p>}
    {categories.length ? <ul className="settings-items">{categories.map((name) => <CategoryRow key={name} name={name} />)}</ul> : <p className="settings-description">No categories yet. Add one here or while assigning a task or project.</p>}
  </>;
}

function ScheduleEditor({ schedule, onClose }: { schedule: RecurringTask; onClose: () => void }) {
  const { data, updateWorkspace } = useWorkspace();
  const [title, setTitle] = useState(schedule.title);
  const [category, setCategory] = useState(schedule.category ?? "");
  const [repeat, setRepeat] = useState<TaskRepeat>(schedule.repeat);
  const [weekday, setWeekday] = useState(new Date(`${schedule.startKey}T12:00:00Z`).getUTCDay());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const now = new Date().toISOString();
    const change = { title, category, repeat: repeat as Exclude<TaskRepeat, "none">, weekday };
    try {
      editRecurringSchedule(data, schedule.id, change, now);
      setBusy(true);
      if (await updateWorkspace((current) => editRecurringSchedule(current, schedule.id, change, now))) onClose();
      else setError("Could not save this schedule. Your draft is still here.");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="settings-editor" onSubmit={save}>
    <label className="settings-field"><span>Task name</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required /></label>
    <CategoryInput id={`schedule-${schedule.id}-category`} categories={getWorkspaceCategories(data)} value={category} onChange={setCategory} />
    <RepeatInput id={`schedule-${schedule.id}-repeat`} value={repeat} period={schedule.period} onChange={setRepeat} allowNone={false} />
    {schedule.period === "day" && repeat === "weekly" && <SelectSetting id={`schedule-${schedule.id}-weekday`} label="Repeat on" value={String(weekday)} onChange={(value) => setWeekday(Number(value))}>
      {weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}
    </SelectSetting>}
    <p>Changes apply to future repeats. Existing tasks keep their details.</p>
    {error && <p className="settings-error" role="alert">{error}</p>}
    <div className="settings-editor-actions">
      <button className="button button-primary button-small" type="submit" disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save schedule"}</button>
      <button className="button button-quiet button-small" type="button" disabled={busy} onClick={onClose}>Cancel</button>
    </div>
  </form>;
}

function ScheduleRow({ schedule }: { schedule: RecurringTask }) {
  const { updateWorkspace, isSaving } = useWorkspace();
  const [editing, setEditing] = useState(false);
  function toggle() {
    const now = new Date().toISOString();
    void updateWorkspace((current) => setRecurringScheduleActive(current, schedule.id, !schedule.active, now));
  }
  return <li className="settings-item" data-schedule-id={schedule.id}>
    <div className="settings-item-heading">
      <div className="settings-item-copy">
        <strong>{schedule.title} <span className={`schedule-state${schedule.active ? " is-active" : ""}`}>{schedule.active ? "Active" : "Paused"}</span></strong>
        <span>{repeatLabel(schedule.repeat)} · {schedule.period === "day" ? "Today" : "This week"}{schedule.period === "day" && schedule.repeat === "weekly" ? ` · ${weekdays[new Date(`${schedule.startKey}T12:00:00Z`).getUTCDay()]}` : ""}{schedule.category ? ` · ${schedule.category}` : ""}</span>
      </div>
      <div className="settings-item-actions">
        {!editing && <button className="text-button" type="button" aria-label={`Edit schedule for ${schedule.title}`} onClick={() => setEditing(true)}>Edit</button>}
        <button className="text-button" type="button" disabled={isSaving} aria-label={`${schedule.active ? "Pause" : "Resume"} ${schedule.title}`} onClick={toggle}>{schedule.active ? "Pause" : "Resume"}</button>
      </div>
    </div>
    {editing && <ScheduleEditor schedule={schedule} onClose={() => setEditing(false)} />}
  </li>;
}

export default function SettingsWorkspace() {
  const { data, isLoaded, isConnected, isSaving, hasSaved, saveError, storageMessage, retryConnection, updateWorkspace } = useWorkspace();
  const settings = getWorkspaceSettings(data);
  function change(patch: SettingsPatch) { void updateWorkspace((current) => changeWorkspaceSettings(current, patch)); }
  return <div className="page-content settings-page">
    <header className="page-heading settings-heading"><div><h1>Settings</h1><p className="page-subtitle">Set things up your way.</p></div></header>
    <div className="settings-save-status" role="status" aria-live="polite">{isSaving ? "Saving…" : saveError ? "Changes were not saved" : hasSaved ? "Saved" : "Changes save automatically"}</div>
    {storageMessage && <StorageNotice message={storageMessage} onRetry={retryConnection} />}
    {saveError && <p className="settings-error settings-save-error" role="alert">{saveError} The last saved values have been restored.</p>}
    {!isLoaded ? <div className="settings-loading" aria-busy="true" aria-label="Loading settings">{[0, 1, 2, 3].map((id) => <section className="settings-section" key={id}><div className="skeleton skeleton-heading" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></section>)}</div> : <fieldset key="workspace-controls" className="settings-controls" disabled={!isConnected} aria-label="Workspace settings">
      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2><p className="settings-description">Choose a scene for each part of your world.</p>
        <div className="background-settings">
          {(["home", "creative", "settings"] as const).map((page) => <fieldset className="background-picker" key={page}>
            <legend>{page === "home" ? "Home" : page === "creative" ? "Creative" : "Settings"} background</legend>
            <div className="background-choices">{scenes.map((scene) => <label className={`background-choice${settings.backgrounds[page] === scene.value ? " is-selected" : ""}`} key={scene.value}>
              <span className={`scene-preview preview-${scene.value}`} aria-hidden="true" />
              <span className="background-choice-label"><input type="radio" name={`background-${page}`} checked={settings.backgrounds[page] === scene.value} onChange={() => change({ backgrounds: { [page]: scene.value } })} />{scene.label}</span>
            </label>)}</div>
          </fieldset>)}
        </div>
        <label className="settings-toggle"><input type="checkbox" checked={settings.showDailyFooter} onChange={(event) => change({ showDailyFooter: event.target.checked })} /><span>Show the daily quote or prompt</span></label>
      </section>
      <section className="settings-section" aria-labelledby="planner-settings-heading">
        <h2 id="planner-settings-heading">Planner</h2><p className="settings-description">Your last view follows you between devices. You can change it here or on Home.</p>
        <div className="planner-preferences">
          <SelectSetting id="planner-layout" label="Home layout" value={settings.plannerLayout} onChange={(plannerLayout) => change({ plannerLayout: plannerLayout as WorkspaceSettings["plannerLayout"] })}><option value="today">Today only</option><option value="both">Today and this week</option><option value="combined">Combined board</option></SelectSetting>
          <SelectSetting id="daily-view" label="Today view" value={settings.dayView} onChange={(dayView) => change({ dayView: dayView as WorkspaceSettings["dayView"] })}><option value="list">List</option><option value="board">Board</option></SelectSetting>
          <SelectSetting id="weekly-view" label="This week view" value={settings.weekView} onChange={(weekView) => change({ weekView: weekView as WorkspaceSettings["weekView"] })}><option value="list">List</option><option value="board">Board</option></SelectSetting>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="categories-settings-heading">
        <h2 id="categories-settings-heading">Categories</h2><p className="settings-description">Shared by your tasks and projects. Renames also update past lists and repeating schedules.</p>
        <CategoryManager />
      </section>
      <section className="settings-section" aria-labelledby="recurring-settings-heading">
        <h2 id="recurring-settings-heading">Repeating tasks</h2><p className="settings-description">Edit future repeats or take a break. Pausing keeps your current tasks and history.</p>
        {data.recurringTasks?.length ? <ul className="settings-items">{data.recurringTasks.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} />)}</ul> : <p className="settings-description">No repeating schedules yet. <Link href="/">Open your planner</Link> to create one.</p>}
      </section>
    </fieldset>}
  </div>;
}
