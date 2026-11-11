"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLegacyWorkspace,
  emptyWorkspace,
  hasWorkspaceEntries,
  isWorkspaceData,
  readLegacyWorkspace,
  type LegacyWorkspace,
  type WorkspaceData,
} from "@/app/lib/workspace";

type RemoteWorkspace = {
  exists: boolean;
  data: WorkspaceData;
};

function enqueueRemoteTask<T>(queue: { current: Promise<void> }, task: () => Promise<T>) {
  const result = queue.current.catch(() => undefined).then(task);
  queue.current = result.then(() => undefined, () => undefined);
  return result;
}

async function readRemoteWorkspace(): Promise<RemoteWorkspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the workspace from MongoDB.");

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("data" in result) || !isWorkspaceData(result.data)) {
    throw new Error("MongoDB returned workspace data in an unexpected format.");
  }

  return {
    exists: "exists" in result && result.exists === true,
    data: result.data,
  };
}

async function writeRemoteWorkspace(data: WorkspaceData): Promise<WorkspaceData> {
  const response = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!response.ok) throw new Error("Could not save the workspace to MongoDB.");

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("data" in result) || !isWorkspaceData(result.data)) {
    throw new Error("MongoDB returned workspace data in an unexpected format.");
  }
  return result.data;
}

function isSameWorkspace(left: WorkspaceData, right: WorkspaceData) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mergeById<T extends { id: string; updatedAt: string }>(remote: T[], legacy: T[]) {
  const merged = new Map<string, T>();
  for (const entry of remote) merged.set(entry.id, entry);
  for (const entry of legacy) {
    const current = merged.get(entry.id);
    if (!current || entry.updatedAt > current.updatedAt) merged.set(entry.id, entry);
  }
  return [...merged.values()];
}

function mergeWorkspaces(remote: WorkspaceData, legacy: WorkspaceData): WorkspaceData {
  return {
    version: 1,
    tasks: mergeById(remote.tasks, legacy.tasks),
    projects: mergeById(remote.projects, legacy.projects),
    ideas: mergeById(remote.ideas, legacy.ideas),
    rolloverHandled: { ...remote.rolloverHandled, ...legacy.rolloverHandled },
  };
}

const unavailableMessage = "MongoDB is unavailable. Your workspace cannot be loaded or saved right now. Nothing is saved in this browser.";

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(() => emptyWorkspace());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const dataRef = useRef(data);
  const persistedDataRef = useRef<WorkspaceData>(emptyWorkspace());
  const isConnectedRef = useRef(false);
  const remoteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const legacyWorkspaceRef = useRef<LegacyWorkspace | null>(null);

  const adoptWorkspace = useCallback((next: WorkspaceData) => {
    dataRef.current = next;
    persistedDataRef.current = next;
    setData(next);
    isConnectedRef.current = true;
    setIsConnected(true);
    setStorageMessage(null);
  }, []);

  const markUnavailable = useCallback(() => {
    isConnectedRef.current = false;
    setIsConnected(false);
    setStorageMessage(unavailableMessage);
  }, []);

  const loadFromMongo = useCallback(async () => {
    const remote = await readRemoteWorkspace();
    const legacy = legacyWorkspaceRef.current;
    let next = remote.exists ? remote.data : emptyWorkspace();
    let shouldWrite = false;

    if (legacy?.data && hasWorkspaceEntries(legacy.data)) {
      if (!remote.exists) {
        next = legacy.data;
        shouldWrite = true;
      } else {
        next = mergeWorkspaces(remote.data, legacy.data);
        shouldWrite = !isSameWorkspace(next, remote.data);
      }
    }

    if (shouldWrite) next = await writeRemoteWorkspace(next);

    let legacyWarning: string | null = null;
    if (legacy) {
      clearLegacyWorkspace();
      legacyWorkspaceRef.current = null;
      if (legacy.corrupt && !remote.exists) {
        legacyWarning = "An old browser copy could not be read. The MongoDB workspace is ready to use.";
      }
    }

    adoptWorkspace(next);
    if (legacyWarning) setStorageMessage(legacyWarning);
  }, [adoptWorkspace]);

  const queueRemoteRefresh = useCallback(() => {
    void enqueueRemoteTask(remoteQueueRef, loadFromMongo).catch(markUnavailable);
  }, [loadFromMongo, markUnavailable]);

  const retryConnection = useCallback(() => {
    queueRemoteRefresh();
  }, [queueRemoteRefresh]);

  const queueRemoteWrite = useCallback((snapshot: WorkspaceData) => {
    void enqueueRemoteTask(remoteQueueRef, async () => {
      const saved = await writeRemoteWorkspace(snapshot);
      persistedDataRef.current = saved;
      if (isSameWorkspace(dataRef.current, snapshot)) adoptWorkspace(saved);
    }).catch(() => {
      markUnavailable();
      if (isSameWorkspace(dataRef.current, snapshot)) {
        dataRef.current = persistedDataRef.current;
        setData(persistedDataRef.current);
      }
    });
  }, [adoptWorkspace, markUnavailable]);

  useEffect(() => {
    let cancelled = false;
    legacyWorkspaceRef.current = readLegacyWorkspace();

    void enqueueRemoteTask(remoteQueueRef, loadFromMongo)
      .catch(markUnavailable)
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") queueRemoteRefresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadFromMongo, markUnavailable, queueRemoteRefresh]);

  const updateWorkspace = useCallback((update: (current: WorkspaceData) => WorkspaceData) => {
    if (!isConnectedRef.current) return;

    const next = update(dataRef.current);
    dataRef.current = next;
    setData(next);
    queueRemoteWrite(next);
  }, [queueRemoteWrite]);

  return { data, isLoaded, isConnected, storageMessage, retryConnection, updateWorkspace };
}
