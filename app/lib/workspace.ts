export const WORKSPACE_TIME_ZONE = "Africa/Lagos";
export const BUILT_IN_CATEGORIES = ["Personal", "Work", "Creative", "Home"] as const;
export const MAX_CATEGORY_LENGTH = 40;

type CategorizedItem = { category?: string };

export type TaskPeriod = "day" | "week";
export type TaskStatus = "todo" | "doing" | "done";
export type TaskRepeat = "none" | "daily" | "weekdays" | "weekly";
export type WorkspaceScene = "sunset" | "winter";
export type PlannerLayout = "today" | "both" | "combined";
export type TaskView = "list" | "board";
export type PlannerCardStyle = "soft" | "ruled-paper";
export type WorkspaceSettings = {
  backgrounds: { home: WorkspaceScene; creative: WorkspaceScene; settings: WorkspaceScene };
  showDailyFooter: boolean;
  plannerLayout: PlannerLayout;
  dayView: TaskView;
  weekView: TaskView;
  plannerCardStyle?: PlannerCardStyle;
};
export type ResolvedWorkspaceSettings = Omit<WorkspaceSettings, "plannerCardStyle"> & { plannerCardStyle: PlannerCardStyle };

export type RecurringTask = {
  id: string;
  title: string;
  category?: string;
  period: TaskPeriod;
  repeat: Exclude<TaskRepeat, "none">;
  startKey: string;
  active: boolean;
  skippedKeys: string[];
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  period: TaskPeriod;
  periodKey: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  carriedFrom?: string;
  dismissedOn?: string;
  completedAt?: string;
  category?: string;
  recurringTaskId?: string;
};

export type ProjectStatus = "planned" | "active" | "paused" | "complete";

export type CreativeProject = {
  id: string;
  title: string;
  notes: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  category?: string;
};

export type CreativeIdea = {
  id: string;
  title: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceData = {
  version: 1;
  tasks: Task[];
  projects: CreativeProject[];
  ideas: CreativeIdea[];
  rolloverHandled: Record<string, "carried" | "kept">;
  categories?: string[];
  recurringTasks?: RecurringTask[];
  settings?: WorkspaceSettings;
  categoryCatalog?: string[];
};

const STORAGE_KEY = "daybook-workspace-v1";
const PENDING_SYNC_KEY = `${STORAGE_KEY}:pending-sync`;

export function emptyWorkspace(): WorkspaceData {
  return {
    version: 1,
    tasks: [],
    projects: [],
    ideas: [],
    rolloverHandled: {},
    categories: [],
    recurringTasks: [],
  };
}

export function getCategoryOptions(categories: string[] = []) {
  const seen = new Set(BUILT_IN_CATEGORIES.map((category) => category.toLocaleLowerCase()));
  return [
    ...BUILT_IN_CATEGORIES,
    ...categories.filter((category) => {
      const key = category.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

export function normalizeCategoryName(value: string, categories: string[] = []) {
  const name = value.trim().replace(/\s+/g, " ").slice(0, MAX_CATEGORY_LENGTH).trimEnd();
  if (!name) return undefined;
  const existing = getCategoryOptions(categories).find((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase());
  return existing ?? name;
}

export function addCustomCategory(categories: string[] = [], category?: string) {
  if (!category || getCategoryOptions(categories).some((existing) => existing.toLocaleLowerCase() === category.toLocaleLowerCase())) {
    return categories;
  }
  return [...categories, category];
}

export function mergeCategoryLists(...lists: Array<string[] | undefined>) {
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const categories of lists) {
    for (const category of categories ?? []) {
      const key = category.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(category);
    }
  }
  return merged;
}

export function filterByCategory<T extends CategorizedItem>(items: T[], category: string) {
  if (!category) return items;
  return items.filter((item) => !item.category || item.category === category);
}

function isValidCategory(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_CATEGORY_LENGTH && value === value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    (value.period === "day" || value.period === "week") &&
    typeof value.periodKey === "string" &&
    (value.status === "todo" || value.status === "doing" || value.status === "done") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.carriedFrom === undefined || typeof value.carriedFrom === "string") &&
    (value.dismissedOn === undefined || (typeof value.dismissedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.dismissedOn))) &&
    (value.completedAt === undefined || (typeof value.completedAt === "string" && Number.isFinite(Date.parse(value.completedAt)))) &&
    (value.category === undefined || isValidCategory(value.category)) &&
    (value.recurringTaskId === undefined || typeof value.recurringTaskId === "string")
  );
}

function isProject(value: unknown): value is CreativeProject {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.notes === "string" &&
    (value.status === "planned" || value.status === "active" || value.status === "paused" || value.status === "complete") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.category === undefined || isValidCategory(value.category))
  );
}

function isIdea(value: unknown): value is CreativeIdea {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.notes === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isRecurringTask(value: unknown): value is RecurringTask {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" &&
    (value.category === undefined || isValidCategory(value.category)) &&
    (value.period === "day" || value.period === "week") &&
    (value.repeat === "daily" || value.repeat === "weekdays" || value.repeat === "weekly") &&
    (value.period !== "week" || value.repeat === "weekly") &&
    isDateKey(value.startKey) &&
    typeof value.active === "boolean" && Array.isArray(value.skippedKeys) &&
    value.skippedKeys.every(isDateKey) &&
    typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}

function isWorkspaceSettings(value: unknown): value is WorkspaceSettings {
  if (!isRecord(value) || !isRecord(value.backgrounds)) return false;
  const isScene = (scene: unknown) => scene === "sunset" || scene === "winter";
  const isView = (view: unknown) => view === "list" || view === "board";
  return isScene(value.backgrounds.home) && isScene(value.backgrounds.creative) && isScene(value.backgrounds.settings) &&
    typeof value.showDailyFooter === "boolean" &&
    ["today", "both", "combined"].includes(value.plannerLayout as string) && isView(value.dayView) && isView(value.weekView) &&
    (value.plannerCardStyle === undefined || value.plannerCardStyle === "soft" || value.plannerCardStyle === "ruled-paper");
}

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  return (
    isRecord(value) &&
    value.version === 1 &&
    (value.settings === undefined || isWorkspaceSettings(value.settings)) &&
    (value.categoryCatalog === undefined || (Array.isArray(value.categoryCatalog) && value.categoryCatalog.every(isValidCategory) &&
      new Set(value.categoryCatalog.map((category) => category.toLocaleLowerCase())).size === value.categoryCatalog.length)) &&
    Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.projects) && value.projects.every(isProject) &&
    Array.isArray(value.ideas) && value.ideas.every(isIdea) &&
    isRecord(value.rolloverHandled) &&
    Object.values(value.rolloverHandled).every((entry) => entry === "carried" || entry === "kept") &&
    (value.recurringTasks === undefined || (Array.isArray(value.recurringTasks) && value.recurringTasks.every(isRecurringTask) &&
      new Set(value.recurringTasks.map((series) => series.id)).size === value.recurringTasks.length)) &&
    (value.categories === undefined || (
      Array.isArray(value.categories) &&
      value.categories.every(isValidCategory) &&
      new Set(value.categories.map((category) => category.toLocaleLowerCase())).size === value.categories.length &&
      value.categories.every((category) => !BUILT_IN_CATEGORIES.some((builtIn) => builtIn.toLocaleLowerCase() === category.toLocaleLowerCase()))
    ))
  );
}

export function hasWorkspaceEntries(data: WorkspaceData) {
  return data.tasks.length > 0 || data.projects.length > 0 || data.ideas.length > 0 || Boolean(data.categories?.length) || Boolean(data.recurringTasks?.length) || data.categoryCatalog !== undefined || data.settings !== undefined || Object.keys(data.rolloverHandled).length > 0;
}

export type LegacyWorkspace = {
  data: WorkspaceData | null;
  corrupt: boolean;
};

/** Read the old browser copy once so it can be moved into MongoDB. */
export function readLegacyWorkspace(): LegacyWorkspace {
  if (typeof window === "undefined") return { data: null, corrupt: false };

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { data: null, corrupt: false };

    const parsed: unknown = JSON.parse(stored);
    if (!isWorkspaceData(parsed)) return { data: null, corrupt: true };
    return { data: parsed, corrupt: false };
  } catch {
    return { data: null, corrupt: true };
  }
}

/** Remove the old browser copy after MongoDB has loaded or accepted it. */
export function clearLegacyWorkspace() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(PENDING_SYNC_KEY);
  } catch {
    // The app no longer reads or writes browser storage after migration.
  }
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getLagosDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WORKSPACE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDaysToKey(dayKey: string, amount: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getWeekStartKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return addDaysToKey(dayKey, -((weekday + 6) % 7));
}

function dateAtLagosNoon(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatDayLabel(dayKey: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: WORKSPACE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    ...options,
  }).format(dateAtLagosNoon(dayKey));
}

export function formatWeekRange(weekStartKey: string) {
  const weekEndKey = addDaysToKey(weekStartKey, 6);
  const start = new Intl.DateTimeFormat("en-NG", {
    timeZone: WORKSPACE_TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(dateAtLagosNoon(weekStartKey));
  const end = new Intl.DateTimeFormat("en-NG", {
    timeZone: WORKSPACE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateAtLagosNoon(weekEndKey));
  return `${start} – ${end}`;
}

export type DailyFooterItem = {
  kind: "thought" | "prompt";
  text: string;
  byline?: string;
};

const DAILY_FOOTER_ITEMS: DailyFooterItem[] = [
  { kind: "thought", text: "Well done is better than well said.", byline: "Benjamin Franklin" },
  { kind: "prompt", text: "What would make today feel well spent?" },
  { kind: "thought", text: "Great things are done by a series of small things brought together.", byline: "Vincent van Gogh" },
  { kind: "prompt", text: "What can you make a little progress on today?" },
  { kind: "thought", text: "It always seems impossible until it is done.", byline: "Nelson Mandela" },
  { kind: "prompt", text: "What deserves your attention before anything else?" },
  { kind: "thought", text: "Nothing is worth more than this day.", byline: "Johann Wolfgang von Goethe" },
  { kind: "prompt", text: "What can you leave unfinished without guilt?" },
  { kind: "thought", text: "Forever is composed of nows.", byline: "Emily Dickinson" },
  { kind: "prompt", text: "What small thing would bring you some joy today?" },
  { kind: "thought", text: "Adopt the pace of nature: her secret is patience.", byline: "Ralph Waldo Emerson" },
  { kind: "prompt", text: "What do you want to remember about today?" },
  { kind: "thought", text: "A little progress still counts." },
  { kind: "prompt", text: "What is one thing worth finishing today?" },
  { kind: "thought", text: "Rest is part of the work." },
  { kind: "prompt", text: "What can you make easier for yourself?" },
  { kind: "thought", text: "You can begin before you feel ready." },
  { kind: "prompt", text: "Where would a little patience help?" },
  { kind: "thought", text: "Attention is a resource. Spend it on what matters." },
  { kind: "prompt", text: "What has been taking more energy than it deserves?" },
  { kind: "thought", text: "A quiet start can still lead somewhere." },
  { kind: "prompt", text: "What is one thing you can do in ten minutes?" },
  { kind: "thought", text: "Good work often grows from ordinary days." },
  { kind: "prompt", text: "What do you need more of today?" },
  { kind: "thought", text: "It is enough to take the next step." },
  { kind: "prompt", text: "What would you like to give your full attention to?" },
  { kind: "thought", text: "Your pace is allowed to change." },
  { kind: "prompt", text: "What can wait until another day?" },
  { kind: "thought", text: "Some things become clearer after you begin." },
  { kind: "prompt", text: "What is something you handled better than before?" },
  { kind: "thought", text: "Small promises to yourself deserve care." },
  { kind: "prompt", text: "What would make the next hour feel lighter?" },
  { kind: "thought", text: "Curiosity can make a hard thing easier to approach." },
  { kind: "prompt", text: "What are you curious about right now?" },
  { kind: "thought", text: "Not every useful day feels impressive." },
  { kind: "prompt", text: "Which promise to yourself can you keep today?" },
  { kind: "thought", text: "You are allowed to make room for the unexpected." },
  { kind: "prompt", text: "What would you do if you were not trying to make it perfect?" },
  { kind: "thought", text: "Consistency is returning, not never stopping." },
  { kind: "prompt", text: "What is one thing you can appreciate about your surroundings?" },
  { kind: "thought", text: "A pause can help you choose with intention." },
  { kind: "prompt", text: "Is there anything you need to say no to today?" },
  { kind: "thought", text: "The unfinished is not the same as the failed." },
  { kind: "prompt", text: "What does a good enough result look like?" },
  { kind: "thought", text: "You can care about the outcome and still be gentle with yourself." },
  { kind: "prompt", text: "What would help you feel more present?" },
  { kind: "thought", text: "Progress is easier to notice when you look back." },
  { kind: "prompt", text: "What have you learned from a recent mistake?" },
  { kind: "thought", text: "A fresh page does not require a perfect plan." },
  { kind: "prompt", text: "What can you prepare now to help your future self?" },
  { kind: "thought", text: "There is value in doing one thing with care." },
  { kind: "prompt", text: "What part of today can you look forward to?" },
  { kind: "thought", text: "Let the day be what it is. Find your part in it." },
  { kind: "prompt", text: "What can you let go of for now?" },
  { kind: "thought", text: "Effort can be quiet and still be real." },
  { kind: "prompt", text: "When did you last feel fully absorbed in something?" },
  { kind: "thought", text: "A slower choice can be the wiser choice." },
  { kind: "prompt", text: "What would you like to make, explore, or understand?" },
  { kind: "thought", text: "You do not need to solve everything today." },
  { kind: "prompt", text: "What is one thing you want to remember from this season?" },
];

const DAILY_FOOTER_ROTATION_ANCHOR = "2026-11-15";
// Keep the first expanded day on the thought that is already live today.
const DAILY_FOOTER_ROTATION_ANCHOR_INDEX = 12;

export function getDailyFooterItem(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const [anchorYear, anchorMonth, anchorDay] = DAILY_FOOTER_ROTATION_ANCHOR.split("-").map(Number);
  const anchorDayNumber = Math.floor(Date.UTC(anchorYear, anchorMonth - 1, anchorDay) / 86_400_000);
  const offset = DAILY_FOOTER_ROTATION_ANCHOR_INDEX + dayNumber - anchorDayNumber;
  const index = ((offset % DAILY_FOOTER_ITEMS.length) + DAILY_FOOTER_ITEMS.length) % DAILY_FOOTER_ITEMS.length;
  return DAILY_FOOTER_ITEMS[index];
}

