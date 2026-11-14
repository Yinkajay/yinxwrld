import {
  BUILT_IN_CATEGORIES, MAX_CATEGORY_LENGTH, addDaysToKey, getCategoryOptions,
  mergeCategoryLists, type WorkspaceData, type WorkspaceSettings,
} from "./workspace";

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  backgrounds: { home: "sunset", creative: "winter", settings: "sunset" },
  showDailyFooter: true,
  plannerLayout: "today",
  dayView: "list",
  weekView: "list",
};

export class WorkspaceInputError extends Error {}

export function getWorkspaceSettings(data: WorkspaceData): WorkspaceSettings {
  return data.settings ?? DEFAULT_SETTINGS;
}

export type SettingsPatch = Partial<Omit<WorkspaceSettings, "backgrounds">> & {
  backgrounds?: Partial<WorkspaceSettings["backgrounds"]>;
};

export function changeWorkspaceSettings(data: WorkspaceData, patch: SettingsPatch): WorkspaceData {
  const current = getWorkspaceSettings(data);
  return { ...data, settings: { ...current, ...patch, backgrounds: { ...current.backgrounds, ...patch.backgrounds } } };
}

export function getWorkspaceCategories(data: WorkspaceData) {
  return data.categoryCatalog ?? getCategoryOptions(data.categories);
}

export function cleanCategoryName(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new WorkspaceInputError("Enter a category name.");
  if (name.length > MAX_CATEGORY_LENGTH) throw new WorkspaceInputError(`Use ${MAX_CATEGORY_LENGTH} characters or fewer.`);
  return name;
}

function sameName(left: string, right: string) {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function withCatalog(data: WorkspaceData, categoryCatalog: string[]): WorkspaceData {
  return {
    ...data, categoryCatalog,
    // Keep this legacy field readable by older clients; the catalog is authoritative.
    categories: categoryCatalog.filter((name) => !BUILT_IN_CATEGORIES.some((builtIn) => sameName(name, builtIn))),
  };
}

export function addWorkspaceCategory(data: WorkspaceData, value: string): WorkspaceData {
  const name = cleanCategoryName(value);
  const catalog = getWorkspaceCategories(data);
  if (catalog.some((item) => sameName(item, name))) throw new WorkspaceInputError("That category already exists.");
  return withCatalog(data, [...catalog, name]);
}

/** Inline assignment registers a new category and assigns its canonical name atomically. */
export function assignWorkspaceCategory(data: WorkspaceData, value: string) {
  if (!value.trim()) return { data, category: undefined };
  const name = cleanCategoryName(value);
  const existing = getWorkspaceCategories(data).find((item) => sameName(item, name));
  return existing ? { data, category: existing } : { data: addWorkspaceCategory(data, name), category: name };
}

export function countCategoryReferences(data: WorkspaceData, name: string) {
  return [...data.tasks, ...data.projects, ...(data.recurringTasks ?? [])]
    .filter((item) => item.category && sameName(item.category, name)).length;
}

function replaceReferences(data: WorkspaceData, name: string, replacement: string | undefined, now: string): WorkspaceData {
  function replace<T extends { category?: string; updatedAt: string }>(item: T): T {
    return item.category && sameName(item.category, name) ? { ...item, category: replacement, updatedAt: now } : item;
  }
  return { ...data, tasks: data.tasks.map(replace), projects: data.projects.map(replace), recurringTasks: data.recurringTasks?.map(replace) };
}

export function renameWorkspaceCategory(data: WorkspaceData, oldName: string, value: string, now: string): WorkspaceData {
  const name = cleanCategoryName(value);
  const catalog = getWorkspaceCategories(data);
  if (!catalog.includes(oldName)) throw new WorkspaceInputError("This category changed on another device. Choose it again.");
  if (catalog.some((item) => item !== oldName && sameName(item, name))) throw new WorkspaceInputError("That category already exists.");
  return withCatalog(replaceReferences(data, oldName, name, now), catalog.map((item) => item === oldName ? name : item));
}

export function removeWorkspaceCategory(data: WorkspaceData, name: string, replacement: string | undefined, now: string): WorkspaceData {
  const catalog = getWorkspaceCategories(data);
  if (!catalog.includes(name)) throw new WorkspaceInputError("This category has already been removed.");
  if (replacement && (replacement === name || !catalog.includes(replacement))) throw new WorkspaceInputError("Choose an available replacement category.");
  return withCatalog(replaceReferences(data, name, replacement, now), catalog.filter((item) => item !== name));
}

function mergeById<T extends { id: string; updatedAt: string }>(remote: T[], legacy: T[]) {
  const merged = new Map(remote.map((item) => [item.id, item]));
  for (const item of legacy) {
    const existing = merged.get(item.id);
    if (!existing || item.updatedAt > existing.updatedAt) merged.set(item.id, item);
  }
  return [...merged.values()];
}

export function mergeWorkspaces(remote: WorkspaceData, legacy: WorkspaceData): WorkspaceData {
  const catalog = remote.categoryCatalog ?? legacy.categoryCatalog;
  function clean<T extends { category?: string }>(item: T): T {
    if (!item.category || !catalog) return item;
    const canonical = catalog.find((name) => sameName(name, item.category!));
    return { ...item, category: canonical };
  }
  return {
    ...remote,
    tasks: mergeById(remote.tasks, legacy.tasks).map(clean),
    projects: mergeById(remote.projects, legacy.projects).map(clean),
    ideas: mergeById(remote.ideas, legacy.ideas),
    rolloverHandled: { ...remote.rolloverHandled, ...legacy.rolloverHandled },
    categories: mergeCategoryLists(remote.categories, legacy.categories),
    recurringTasks: mergeById(remote.recurringTasks ?? [], legacy.recurringTasks ?? []).map(clean),
    settings: remote.settings ?? legacy.settings,
    categoryCatalog: catalog,
  };
}

export function nextWeekday(dayKey: string, weekday: number) {
  const current = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return addDaysToKey(dayKey, (weekday - current + 7) % 7);
}

