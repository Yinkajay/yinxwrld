const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("exports", "require", "module", code)(module.exports, (name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, module);
  return module.exports;
}

const workspace = load("app/lib/workspace.ts");
const planner = load("app/lib/planner.ts", { "./workspace": workspace });
const recurrence = load("app/lib/recurrence.ts", { "./workspace": workspace, "./planner": planner });
const client = load("app/lib/workspace-client.ts", { "./workspace": workspace });
const now = "2026-11-11T12:00:00.000Z";
const today = "2026-11-11";
const tomorrow = "2026-11-12";
const task = (id, overrides = {}) => ({
  id, title: id, period: "week", periodKey: "2026-11-09", status: "todo", createdAt: now, updatedAt: now, ...overrides,
});
const ids = (tasks) => tasks.map((item) => item.id);

function recurringFixture(repeat = "daily", period = "day") {
  const data = { ...workspace.emptyWorkspace(), tasks: [task("original", { period, periodKey: period === "day" ? today : "2026-11-09", category: "Work", status: "done", completedAt: now })] };
  return recurrence.setTaskRepeat(data, "original", repeat, "series", now);
}

test("daily repeats preserve the original and create exactly one fresh task at Lagos midnight", () => {
  const data = recurringFixture();
  assert.equal(data.tasks[0].id, "original");
  assert.equal(recurrence.materializeRecurringTasks(data, "2026-11-11T22:59:59Z"), data);
  const next = recurrence.materializeRecurringTasks(data, "2026-11-11T23:00:00Z");
  assert.equal(next.tasks.length, 2);
  assert.equal(next.tasks[1].periodKey, tomorrow);
  assert.equal(next.tasks[1].status, "todo");
  assert.equal(next.tasks[1].completedAt, undefined);
  assert.equal(next.tasks[1].category, "Work");
  assert.equal(next.tasks[0].status, "done");
  assert.equal(recurrence.materializeRecurringTasks(JSON.parse(JSON.stringify(next)), "2026-11-12T10:00:00Z").tasks.length, 2);
});

test("weekdays skip weekends, weekly daily tasks keep their weekday, and weekly lists reset on Monday", () => {
  const weekdays = recurringFixture("weekdays");
  assert.equal(recurrence.materializeRecurringTasks(weekdays, "2026-11-14T12:00:00Z"), weekdays);
  assert.equal(recurrence.materializeRecurringTasks(weekdays, "2026-11-15T12:00:00Z"), weekdays);
  assert.equal(recurrence.materializeRecurringTasks(weekdays, "2026-11-16T12:00:00Z").tasks.length, 2);
  const weeklyDay = recurringFixture("weekly");
  assert.equal(recurrence.materializeRecurringTasks(weeklyDay, "2026-11-12T12:00:00Z"), weeklyDay);
  assert.equal(recurrence.materializeRecurringTasks(weeklyDay, "2026-11-18T12:00:00Z").tasks.length, 2);
  const weeklyList = recurringFixture("weekly", "week");
  assert.equal(recurrence.materializeRecurringTasks(weeklyList, "2026-11-15T22:59:59Z"), weeklyList);
  const monday = recurrence.materializeRecurringTasks(weeklyList, "2026-11-15T23:00:00Z");
  assert.equal(monday.tasks[1].periodKey, "2026-11-16");
  assert.equal(monday.tasks[1].status, "todo");
});

test("missed dates are not backfilled and stopped repeats preserve history", () => {
  const data = recurringFixture();
  const later = recurrence.materializeRecurringTasks(data, "2027-01-01T12:00:00Z");
  assert.equal(later.tasks.length, 2);
  assert.equal(later.tasks[1].periodKey, "2027-01-01");
  const stopped = recurrence.stopRecurringTask(later, "series", "2027-01-01T12:00:00Z");
  assert.equal(stopped.tasks.length, 2);
  assert.equal(recurrence.materializeRecurringTasks(stopped, "2027-01-02T12:00:00Z"), stopped);
});

test("deleting or moving one occurrence cannot regenerate it, while future repeats continue", () => {
  const data = recurringFixture();
  const deleted = recurrence.deleteTaskOccurrence(data, "original", now);
  assert.equal(recurrence.materializeRecurringTasks(JSON.parse(JSON.stringify(deleted)), now).tasks.length, 0);
  assert.equal(recurrence.materializeRecurringTasks(deleted, "2026-11-12T12:00:00Z").tasks.length, 1);
  const moved = recurrence.moveTaskOccurrenceToWeek(data, "original", now);
  assert.equal(moved.tasks[0].period, "week");
  assert.equal(moved.tasks[0].recurringTaskId, undefined);
  assert.equal(recurrence.materializeRecurringTasks(moved, now).tasks.length, 1);
  assert.equal(recurrence.materializeRecurringTasks(moved, "2026-11-12T12:00:00Z").tasks.length, 2);
});

test("repeat edits update this occurrence and the future, without rewriting previous occurrences", () => {
  const data = recurrence.materializeRecurringTasks(recurringFixture(), "2026-11-12T12:00:00Z");
  const nextId = data.tasks[1].id;
  const edited = recurrence.editRepeatingTask(data, nextId, { title: "Updated", category: "Personal", repeat: "weekdays" }, "unused", "2026-11-12T12:00:00Z");
  assert.equal(edited.tasks[0].title, "original");
  assert.equal(edited.tasks[0].category, "Work");
  assert.equal(edited.tasks[1].title, "Updated");
  assert.equal(edited.recurringTasks.length, 1);
  const future = recurrence.materializeRecurringTasks(edited, "2026-11-13T12:00:00Z");
  assert.equal(future.tasks[2].title, "Updated");
  assert.equal(future.tasks[2].category, "Personal");
  assert.equal(recurrence.editRepeatingTask(future, nextId, { repeat: "none" }, "unused", now).recurringTasks[0].active, false);
});

test("recurrence validation accepts legacy data and rejects malformed schedules", () => {
  const data = recurringFixture();
  assert.equal(workspace.isWorkspaceData(JSON.parse(JSON.stringify(data))), true);
  const old = workspace.emptyWorkspace();
  delete old.recurringTasks;
  assert.equal(workspace.isWorkspaceData(old), true);
  for (const extra of [{ repeat: "monthly" }, { active: "yes" }, { skippedKeys: [12] }, { startKey: "not-a-date" }, { period: "week", repeat: "daily" }]) {
    assert.equal(workspace.isWorkspaceData({ ...data, recurringTasks: [{ ...data.recurringTasks[0], ...extra }] }), false);
  }
});

test("two clients creating the same occurrence retry revisions and save one shared task", async () => {
  const originalFetch = global.fetch;
  let saved = JSON.parse(JSON.stringify(recurringFixture()));
  let revision = "0";
  let conflicts = 0;
  global.fetch = async (_url, options = {}) => {
    if (options.method !== "PUT") return Response.json({ exists: true, data: saved, revision });
    const body = JSON.parse(options.body);
    if (body.expectedRevision !== revision) {
      conflicts += 1;
      return Response.json({}, { status: 409 });
    }
    saved = body.data;
    revision = String(Number(revision) + 1);
    return Response.json({ data: saved, revision });
  };
  try {
    const generate = (data) => recurrence.materializeRecurringTasks(data, "2026-11-12T12:00:00Z");
    await Promise.all([client.persistWorkspaceMutation(generate), client.persistWorkspaceMutation(generate)]);
    assert.ok(conflicts > 0);
    assert.equal(saved.tasks.length, 2);
    assert.equal(saved.recurringTasks.length, 1);
    assert.equal(new Set(saved.tasks.map((task) => task.id)).size, 2);
    assert.equal(workspace.isWorkspaceData(saved), true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Today puts native tasks first and links weekly sources without copies", () => {
  const weekly = task("weekly");
  const daily = task("daily", { period: "day", periodKey: today });
  const selected = planner.selectPlannerTasks([weekly, task("old", { periodKey: "2026-11-02" }), daily], today);
  assert.deepEqual(ids(selected.dayTasks), ["daily", "weekly"]);
  assert.equal(selected.dayTasks[1], selected.weekTasks[0]);
  assert.deepEqual(ids(selected.currentTasks), ["daily", "weekly"]);
  assert.equal(planner.selectPlannerTasks([weekly], null).dayTasks.length, 0);
});

test("dismissal survives serialization, leaves weekly/combined lists, and expires at Lagos midnight", () => {
  const beforeMidnight = "2026-11-11T22:59:59.000Z";
  const dismissed = JSON.parse(JSON.stringify(planner.setWeeklyDismissal([task("weekly")], "weekly", true, beforeMidnight)));
  assert.equal(dismissed[0].dismissedOn, today);
  assert.equal(planner.selectPlannerTasks(dismissed, today).dayTasks.length, 0);
  assert.equal(planner.selectPlannerTasks(dismissed, today).weekTasks.length, 1);
  assert.equal(planner.selectPlannerTasks(dismissed, today).currentTasks.length, 1);
  assert.equal(workspace.getLagosDayKey(new Date("2026-11-11T23:00:00.000Z")), tomorrow);
  assert.equal(planner.selectPlannerTasks(dismissed, tomorrow).dayTasks.length, 1);
});

test("restoring a dismissed task shows the same task today", () => {
  const dismissed = task("weekly", { dismissedOn: today });
  const restored = planner.setWeeklyDismissal([dismissed], dismissed.id, false, now);
  assert.equal(restored[0].dismissedOn, undefined);
  assert.deepEqual(ids(planner.selectPlannerTasks(restored, today).dayTasks), [dismissed.id]);
});

test("completion stays in Done today and does not return tomorrow", () => {
  const done = planner.changeTask([task("weekly")], "weekly", { status: "done" }, now);
  assert.equal(done[0].completedAt, now);
  assert.equal(planner.selectPlannerTasks(done, today).dayTasks[0].status, "done");
  assert.equal(planner.selectPlannerTasks(done, tomorrow).dayTasks.length, 0);
  assert.equal(planner.selectPlannerTasks(done, tomorrow).weekTasks[0].status, "done");
});

test("editing a completed task preserves its completion date; reopening clears it", () => {
  const done = task("weekly", { status: "done", completedAt: now });
  const edited = planner.changeTask([done], done.id, { title: "Edited" }, "2026-11-12T12:00:00.000Z");
  assert.equal(edited[0].completedAt, now);
  assert.equal(planner.selectPlannerTasks(edited, tomorrow).dayTasks.length, 0);
  const reopened = planner.changeTask(edited, done.id, { status: "doing" }, now);
  assert.equal(reopened[0].completedAt, undefined);
  assert.equal(planner.selectPlannerTasks(reopened, today).dayTasks[0].status, "doing");
});

test("reopening respects a dismissal already made today", () => {
  const done = task("weekly", { status: "done", completedAt: now, dismissedOn: today });
  const reopened = planner.changeTask([done], done.id, { status: "todo" }, now);
  assert.equal(planner.selectPlannerTasks(reopened, today).dayTasks.length, 0);
  assert.equal(planner.selectPlannerTasks(reopened, tomorrow).dayTasks.length, 1);
});

test("moving a daily task preserves its identity, text, status, and creation time", () => {
  const daily = task("daily", { period: "day", periodKey: today, status: "doing", category: "Personal" });
  const moved = planner.moveDailyTaskToWeek([daily], daily.id, now);
  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, daily.id);
  assert.equal(moved[0].title, daily.title);
  assert.equal(moved[0].status, daily.status);
  assert.equal(moved[0].createdAt, daily.createdAt);
  assert.equal(moved[0].category, "Personal");
  assert.equal(moved[0].period, "week");
  assert.equal(moved[0].periodKey, "2026-11-09");
  const selected = planner.selectPlannerTasks(moved, today);
  assert.deepEqual(ids(selected.dayTasks), [daily.id]);
  assert.deepEqual(ids(selected.currentTasks), [daily.id]);
});

test("moving an old completed daily task keeps it Done today", () => {
  const moved = planner.moveDailyTaskToWeek([task("done", { period: "day", periodKey: today, status: "done" })], "done", now);
  assert.equal(moved[0].completedAt, now);
  assert.equal(planner.selectPlannerTasks(moved, today).dayTasks[0].status, "done");
  assert.equal(planner.selectPlannerTasks(moved, tomorrow).dayTasks.length, 0);
});

test("actions leave history and unrelated tasks untouched", () => {
  const oldDaily = task("old-day", { period: "day", periodKey: "2026-11-10" });
  const oldWeekly = task("old-week", { periodKey: "2026-11-02" });
  assert.equal(planner.moveDailyTaskToWeek([oldDaily], oldDaily.id, now)[0], oldDaily);
  assert.equal(planner.setWeeklyDismissal([oldWeekly], oldWeekly.id, true, now)[0], oldWeekly);
  assert.equal(planner.changeTask([oldDaily], "missing", { status: "done" }, now)[0], oldDaily);
});

test("Monday excludes the old week; an explicit carry-forward clears metadata", () => {
  const source = task("weekly", { dismissedOn: "2026-11-15", completedAt: now, status: "doing" });
  assert.equal(planner.selectPlannerTasks([source], "2026-11-15").dayTasks.length, 0);
  assert.equal(planner.selectPlannerTasks([source], "2026-11-16").weekTasks.length, 0);
  const copied = planner.copyTaskToPeriod(source, "new-id", "2026-11-16", "2026-11-16T12:00:00.000Z");
  assert.equal(copied.dismissedOn, undefined);
  assert.equal(copied.completedAt, undefined);
  assert.equal(copied.carriedFrom, source.id);
  assert.equal(copied.category, source.category);
  assert.deepEqual(ids(planner.selectPlannerTasks([source, copied], "2026-11-16").dayTasks), [copied.id]);
});

test("old saved tasks validate; malformed new metadata is rejected", () => {
  const data = { ...workspace.emptyWorkspace(), tasks: [task("old")] };
  assert.equal(workspace.isWorkspaceData(data), true);
  assert.equal(planner.selectPlannerTasks([task("old-done", { status: "done" })], today).dayTasks.length, 0);
  for (const extra of [{ dismissedOn: 5 }, { dismissedOn: "bad" }, { completedAt: "invalid" }]) {
    assert.equal(workspace.isWorkspaceData({ ...data, tasks: [task("invalid", extra)] }), false);
  }
  assert.equal(workspace.isWorkspaceData({ ...data, tasks: [task("valid", { dismissedOn: today, completedAt: now })] }), true);
});

test("built-in and custom category names are shared, trimmed, and deduplicated", () => {
  assert.deepEqual(workspace.getCategoryOptions(["Art", "work", "Home"]), ["Personal", "Work", "Creative", "Home", "Art"]);
  assert.equal(workspace.normalizeCategoryName(" personal ", []), "Personal");
  assert.equal(workspace.normalizeCategoryName("  side   project ", ["Side Project"]), "Side Project");
  assert.deepEqual(workspace.addCustomCategory(["Art"], "Art"), ["Art"]);
  assert.deepEqual(workspace.addCustomCategory(["Art"], "Design"), ["Art", "Design"]);
  assert.deepEqual(workspace.mergeCategoryLists(["Art", "Design"], ["art", "Writing"]), ["Art", "Design", "Writing"]);
});

test("category filters match the selected category and always retain uncategorized items", () => {
  const items = [
    { id: "personal", category: "Personal" },
    { id: "work", category: "Work" },
    { id: "uncategorized" },
  ];
  assert.deepEqual(ids(workspace.filterByCategory(items, "Personal")), ["personal", "uncategorized"]);
  assert.deepEqual(ids(workspace.filterByCategory(items, "")), ["personal", "work", "uncategorized"]);
});

test("category fields and saved custom categories validate while old workspace data remains valid", () => {
  const oldData = { ...workspace.emptyWorkspace(), tasks: [task("old")] };
  delete oldData.categories;
  assert.equal(workspace.isWorkspaceData(oldData), true);
  const project = { id: "project", title: "Film", notes: "", status: "planned", createdAt: now, updatedAt: now, category: "Creative" };
  const categorized = {
    ...oldData,
    categories: ["Art"],
    tasks: [task("new", { category: "Art" })],
    projects: [project],
  };
  assert.equal(workspace.isWorkspaceData(categorized), true);
  assert.equal(workspace.isWorkspaceData(JSON.parse(JSON.stringify(categorized))), true);
  for (const extra of [
    { tasks: [task("blank", { category: " " })], categories: [] },
    { projects: [{ ...project, category: 12 }], categories: [] },
    { categories: ["Art", "art"] },
  ]) {
    assert.equal(workspace.isWorkspaceData({ ...categorized, ...extra }), false);
  }
});
