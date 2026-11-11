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
const now = "2026-11-11T12:00:00.000Z";
const today = "2026-11-11";
const tomorrow = "2026-11-12";
const task = (id, overrides = {}) => ({
  id, title: id, period: "week", periodKey: "2026-11-09", status: "todo", createdAt: now, updatedAt: now, ...overrides,
});
const ids = (tasks) => tasks.map((item) => item.id);

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
  const daily = task("daily", { period: "day", periodKey: today, status: "doing" });
  const moved = planner.moveDailyTaskToWeek([daily], daily.id, now);
  assert.equal(moved.length, 1);
  assert.equal(moved[0].id, daily.id);
  assert.equal(moved[0].title, daily.title);
  assert.equal(moved[0].status, daily.status);
  assert.equal(moved[0].createdAt, daily.createdAt);
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
