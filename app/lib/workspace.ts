export const WORKSPACE_TIME_ZONE = "Africa/Lagos";

export type TaskPeriod = "day" | "week";
export type TaskStatus = "todo" | "doing" | "done";

export type Task = {
  id: string;
  title: string;
  period: TaskPeriod;
  periodKey: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  carriedFrom?: string;
};

export type ProjectStatus = "planned" | "active" | "paused" | "complete";

export type CreativeProject = {
  id: string;
  title: string;
  notes: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
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
};

export type WorkspaceLoadResult = {
  data: WorkspaceData;
  status: "ready" | "unavailable" | "corrupt";
};

const STORAGE_KEY = "daybook-workspace-v1";
const PENDING_SYNC_KEY = `${STORAGE_KEY}:pending-sync`;
const CHANGE_EVENT = "daybook-workspace-change";

export function emptyWorkspace(): WorkspaceData {
  return {
    version: 1,
    tasks: [],
    projects: [],
    ideas: [],
    rolloverHandled: {},
  };
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
    (value.carriedFrom === undefined || typeof value.carriedFrom === "string")
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
    typeof value.updatedAt === "string"
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

export function isWorkspaceData(value: unknown): value is WorkspaceData {
  return (
    isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.projects) && value.projects.every(isProject) &&
    Array.isArray(value.ideas) && value.ideas.every(isIdea) &&
    isRecord(value.rolloverHandled) &&
    Object.values(value.rolloverHandled).every((entry) => entry === "carried" || entry === "kept")
  );
}

export function hasWorkspaceEntries(data: WorkspaceData) {
  return data.tasks.length > 0 || data.projects.length > 0 || data.ideas.length > 0 || Object.keys(data.rolloverHandled).length > 0;
}

export function loadWorkspace(): WorkspaceLoadResult {
  if (typeof window === "undefined") {
    return { data: emptyWorkspace(), status: "unavailable" };
  }

  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { data: emptyWorkspace(), status: "unavailable" };
  }

  if (!stored) return { data: emptyWorkspace(), status: "ready" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return { data: emptyWorkspace(), status: "corrupt" };
  }

  if (!isWorkspaceData(parsed)) {
    return { data: emptyWorkspace(), status: "corrupt" };
  }

  return { data: parsed, status: "ready" };
}

export function saveWorkspace(data: WorkspaceData): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function hasPendingWorkspaceSync() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PENDING_SYNC_KEY) === "true";
  } catch {
    return false;
  }
}

export function setPendingWorkspaceSync(pending: boolean) {
  if (typeof window === "undefined") return false;
  try {
    if (pending) window.localStorage.setItem(PENDING_SYNC_KEY, "true");
    else window.localStorage.removeItem(PENDING_SYNC_KEY);
    return true;
  } catch {
    return false;
  }
}

export function subscribeToWorkspaceChanges(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, listener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
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
];

export function getDailyFooterItem(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  const index = ((dayNumber % DAILY_FOOTER_ITEMS.length) + DAILY_FOOTER_ITEMS.length) % DAILY_FOOTER_ITEMS.length;
  return DAILY_FOOTER_ITEMS[index];
}

