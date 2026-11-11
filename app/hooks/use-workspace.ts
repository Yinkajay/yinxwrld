"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearLegacyWorkspace,
  emptyWorkspace,
  hasWorkspaceEntries,
  mergeCategoryLists,
  readLegacyWorkspace,
  type LegacyWorkspace,
  type WorkspaceData,
} from "@/app/lib/workspace";
import { persistWorkspaceMutation, readRemoteWorkspace, type WorkspaceMutation } from "@/app/lib/workspace-client";

function enqueueRemoteTask<T>(queue: { current: Promise<void> }, task: () => Promise<T>) {
  const result = queue.current.catch(() => undefined).then(task);
  queue.current = result.then(() => undefined, () => undefined);
  return result;
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
    categories: mergeCategoryLists(remote.categories, legacy.categories),
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
  const pendingWritesRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

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
    let remote = await readRemoteWorkspace();
    const legacy = legacyWorkspaceRef.current;

    if (legacy?.data && hasWorkspaceEntries(legacy.data)) {
      const legacyData = legacy.data;
      if (!isSameWorkspace(mergeWorkspaces(remote.data, legacyData), remote.data)) {
        remote = await persistWorkspaceMutation((current) => mergeWorkspaces(current, legacyData));
      }
    }

    let legacyWarning: string | null = null;
    if (legacy) {
      clearLegacyWorkspace();
      legacyWorkspaceRef.current = null;
      if (legacy.corrupt && !remote.exists) {
        legacyWarning = "An old browser copy could not be read. The MongoDB workspace is ready to use.";
      }
    }

    if (pendingWritesRef.current === 0) adoptWorkspace(remote.data);
    if (legacyWarning) setStorageMessage(legacyWarning);
  }, [adoptWorkspace]);

  const queueRemoteRefresh = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    if (pendingWritesRef.current > 0) return Promise.resolve();

    const refresh = enqueueRemoteTask(remoteQueueRef, loadFromMongo)
      .catch(markUnavailable)
      .finally(() => { refreshPromiseRef.current = null; });
    refreshPromiseRef.current = refresh;
    return refresh;
  }, [loadFromMongo, markUnavailable]);

  const retryConnection = useCallback(() => {
    void queueRemoteRefresh();
  }, [queueRemoteRefresh]);

  const queueRemoteWrite = useCallback((update: WorkspaceMutation) => {
    pendingWritesRef.current += 1;
    void enqueueRemoteTask(remoteQueueRef, async () => {
      const saved = await persistWorkspaceMutation(update);
      persistedDataRef.current = saved.data;
      if (pendingWritesRef.current === 1) adoptWorkspace(saved.data);
    }).catch(() => {
      markUnavailable();
      if (pendingWritesRef.current === 1) {
        dataRef.current = persistedDataRef.current;
        setData(persistedDataRef.current);
      }
    }).finally(() => { pendingWritesRef.current -= 1; });
  }, [adoptWorkspace, markUnavailable]);

  useEffect(() => {
    let cancelled = false;
    legacyWorkspaceRef.current = readLegacyWorkspace();

    void queueRemoteRefresh()
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void queueRemoteRefresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 5_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [queueRemoteRefresh]);

  const updateWorkspace = useCallback((update: (current: WorkspaceData) => WorkspaceData) => {
    if (!isConnectedRef.current) return;

    const next = update(dataRef.current);
    dataRef.current = next;
    setData(next);
    queueRemoteWrite(update);
  }, [queueRemoteWrite]);

  return { data, isLoaded, isConnected, storageMessage, retryConnection, updateWorkspace };
}
