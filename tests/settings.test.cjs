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

const w = load("app/lib/workspace.ts");
const s = load("app/lib/workspace-settings.ts", { "./workspace": w });
const p = load("app/lib/planner.ts", { "./workspace": w });
const r = load("app/lib/recurrence.ts", { "./workspace": w, "./planner": p, "./workspace-settings": s });
const client = load("app/lib/workspace-client.ts", { "./workspace": w });
const now = "2026-11-14T12:00:00Z";
function fixture() {
  return {
    ...w.emptyWorkspace(), categories: ["Art"],
    tasks: [
      { id: "past", title: "Past work", period: "day", periodKey: "2026-11-11", status: "done", completedAt: "2026-11-11T12:00:00Z", createdAt: now, updatedAt: now, category: "Work", recurringTaskId: "series" },
      { id: "current", title: "Current work", period: "day", periodKey: "2026-11-14", status: "doing", createdAt: now, updatedAt: now, category: "Work" },
    ],
    projects: [{ id: "project", title: "Make a film", notes: "", status: "active", createdAt: now, updatedAt: now, category: "Work" }],
    recurringTasks: [{ id: "series", title: "Future work", period: "day", repeat: "weekly", startKey: "2026-11-11", active: true, skippedKeys: [], createdAt: now, updatedAt: now, category: "Work" }],
  };
}

test("legacy workspaces keep their defaults, while an empty catalog stays empty", () => {
  const data = fixture();
  assert.equal(w.isWorkspaceData(data), true);
  assert.deepEqual(s.getWorkspaceCategories(data), ["Personal", "Work", "Creative", "Home", "Art"]);
  assert.equal(s.getWorkspaceSettings(data).backgrounds.creative, "winter");
  assert.equal(s.getWorkspaceSettings(data).plannerLayout, "today");
  const empty = { ...data, categoryCatalog: [] };
  assert.deepEqual(s.getWorkspaceCategories(empty), []);
  assert.equal(w.isWorkspaceData(empty), true);
});

test("renaming a built-in updates every reference without changing completion history", () => {
  const data = fixture();
  const next = s.renameWorkspaceCategory(data, "Work", "  Career  ", now);
  assert.equal(s.countCategoryReferences(next, "Career"), 4);
  assert.equal(s.countCategoryReferences(next, "Work"), 0);
  assert.ok(!s.getWorkspaceCategories(next).includes("Work"));
  assert.equal(next.tasks[0].completedAt, data.tasks[0].completedAt);
  assert.equal(next.tasks[0].periodKey, "2026-11-11");
  assert.equal(next.tasks[1].status, "doing");
  assert.equal(next.recurringTasks[0].title, "Future work");
  assert.equal(w.isWorkspaceData(JSON.parse(JSON.stringify(next))), true);
  assert.throws(() => s.renameWorkspaceCategory(next, "Home", "career", now), /already exists/);
  assert.throws(() => s.addWorkspaceCategory(next, " CAREER "), /already exists/);
});

test("category removal reassigns or uncategorizes references and never removes entries", () => {
  const data = fixture();
  const moved = s.removeWorkspaceCategory(data, "Work", "Home", now);
  assert.equal(s.countCategoryReferences(moved, "Home"), 4);
  const cleared = s.removeWorkspaceCategory(data, "Work", undefined, now);
  assert.equal(cleared.tasks.length, 2);
  assert.equal(cleared.projects.length, 1);
  assert.equal(cleared.recurringTasks.length, 1);
  assert.equal(cleared.tasks[0].category, undefined);
  assert.ok(!s.getWorkspaceCategories(cleared).includes("Work"));
  const assigned = s.assignWorkspaceCategory(cleared, "  side   project  ");
  assert.equal(assigned.category, "side project");
  assert.ok(!s.getWorkspaceCategories(assigned.data).includes("Work"));
  assert.equal(s.assignWorkspaceCategory(assigned.data, "SIDE PROJECT").category, "side project");
});

test("preference patches preserve other fields and validate new enum values", () => {
  const first = s.changeWorkspaceSettings(fixture(), { backgrounds: { home: "winter" }, plannerLayout: "combined" });
  const next = s.changeWorkspaceSettings(first, { backgrounds: { creative: "sunset" }, showDailyFooter: false });
  assert.equal(next.settings.backgrounds.home, "winter");
  assert.equal(next.settings.backgrounds.creative, "sunset");
  assert.equal(next.settings.backgrounds.settings, "sunset");
  assert.equal(next.settings.plannerLayout, "combined");
  assert.equal(w.isWorkspaceData(next), true);
  assert.equal(w.isWorkspaceData({ ...next, settings: { ...next.settings, plannerLayout: "calendar" } }), false);
  assert.equal(w.isWorkspaceData({ ...next, categoryCatalog: ["Work", "work"] }), false);
});

test("legacy import preserves remote preferences and cannot restore removed built-ins", () => {
  const remote = s.changeWorkspaceSettings({ ...fixture(), categoryCatalog: [] }, { showDailyFooter: false });
  const merged = s.mergeWorkspaces(remote, fixture());
  assert.deepEqual(merged.categoryCatalog, []);
  assert.equal(merged.settings.showDailyFooter, false);
  assert.equal(merged.tasks[0].category, undefined);
  assert.equal(merged.recurringTasks[0].category, undefined);
  assert.equal(merged.tasks.length, 2);
});

test("schedule edits preserve existing tasks and use the selected weekday for new repeats", () => {
  const data = fixture();
  const edited = r.editRecurringSchedule(data, "series", { title: "New work", category: "Learning", repeat: "weekly", weekday: 1 }, now);
  assert.deepEqual(edited.tasks, data.tasks);
  assert.equal(edited.recurringTasks[0].startKey, "2026-11-16");
  assert.ok(s.getWorkspaceCategories(edited).includes("Learning"));
  const monday = r.materializeRecurringTasks(edited, "2026-11-16T12:00:00Z");
  assert.equal(monday.tasks.length, 3);
  assert.equal(monday.tasks[2].title, "New work");
  assert.equal(monday.tasks[2].category, "Learning");
  assert.equal(monday.tasks[2].status, "todo");
});

test("pause/resume keeps the weekday, exclusions, completion, and no-backfill behavior", () => {
  const data = fixture();
  data.recurringTasks[0].skippedKeys = ["2026-11-18"];
  const paused = r.setRecurringScheduleActive(data, "series", false, now);
  const resumed = r.setRecurringScheduleActive(paused, "series", true, now);
  assert.deepEqual(resumed.tasks, data.tasks);
  assert.equal(resumed.recurringTasks[0].startKey, "2026-11-11");
  assert.equal(r.materializeRecurringTasks(resumed, "2026-11-18T12:00:00Z").tasks.length, 2);
  assert.equal(r.materializeRecurringTasks(resumed, "2026-11-25T12:00:00Z").tasks.length, 3);
});

test("resuming a due schedule creates only a missing current occurrence", () => {
  const data = fixture();
  data.recurringTasks[0].repeat = "daily";
  data.recurringTasks[0].active = false;
  const resumed = r.setRecurringScheduleActive(data, "series", true, now);
  assert.equal(resumed.tasks.length, 3);
  const again = r.setRecurringScheduleActive(resumed, "series", true, now);
  assert.equal(again.tasks.length, 3);
  assert.equal(again.tasks[0].status, "done");
});

test("concurrent category and preference saves reapply safely to the latest revision", async () => {
  const originalFetch = global.fetch;
  let saved = fixture();
  let revision = 0;
  let conflicts = 0;
  global.fetch = async (_url, options = {}) => {
    if (options.method !== "PUT") return Response.json({ exists: true, data: saved, revision: String(revision) });
    const body = JSON.parse(options.body);
    if (body.expectedRevision !== String(revision)) { conflicts++; return Response.json({}, { status: 409 }); }
    saved = body.data;
    revision++;
    return Response.json({ data: saved, revision: String(revision) });
  };
  try {
    await Promise.all([
      client.persistWorkspaceMutation((data) => s.renameWorkspaceCategory(data, "Work", "Career", now)),
      client.persistWorkspaceMutation((data) => s.changeWorkspaceSettings(data, { dayView: "board", backgrounds: { settings: "winter" } })),
    ]);
    assert.ok(conflicts > 0);
    assert.equal(saved.settings.dayView, "board");
    assert.equal(saved.settings.backgrounds.settings, "winter");
    assert.equal(s.countCategoryReferences(saved, "Career"), 4);
    assert.equal(w.isWorkspaceData(saved), true);
  } finally { global.fetch = originalFetch; }
});
