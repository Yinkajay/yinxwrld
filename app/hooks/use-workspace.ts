"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  clearLegacyWorkspace,
  emptyWorkspace,
  hasWorkspaceEntries,
  readLegacyWorkspace,
  type LegacyWorkspace,
  type WorkspaceData,
} from "@/app/lib/workspace";
import { persistWorkspaceMutation, readRemoteWorkspace, type WorkspaceMutation } from "@/app/lib/workspace-client";
import { materializeRecurringTasks } from "@/app/lib/recurrence";
import { mergeWorkspaces, WorkspaceInputError } from "@/app/lib/workspace-settings";

function enqueueRemoteTask<T>(queue: { current: Promise<void> }, task: () => Promise<T>) {
  const result = queue.current.catch(() => undefined).then(task);
  queue.current = result.then(() => undefined, () => undefined);
  return result;
}

function isSameWorkspace(left: WorkspaceData, right: WorkspaceData) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const unavailableMessage = "MongoDB is unavailable. Your workspace cannot be loaded or saved right now. Nothing is saved in this browser.";

function useWorkspaceState() {
  const [data, setData] = useState<WorkspaceData>(() => emptyWorkspace());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const dataRef = useRef(data);
  const persistedDataRef = useRef<WorkspaceData>(emptyWorkspace());
  const isConnectedRef = useRef(false);
  const remoteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const legacyWorkspaceRef = useRef<LegacyWorkspace | null>(null);
  const pendingWritesRef = useRef(0);
  const pendingMutationsRef = useRef<{ update: WorkspaceMutation; optimistic: boolean }[]>([]);
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

    const now = new Date().toISOString();
    if (materializeRecurringTasks(remote.data, now) !== remote.data) {
      remote = await persistWorkspaceMutation((current) => materializeRecurringTasks(current, now));
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
    void queueRemoteRefresh().then(() => { if (isConnectedRef.current) setSaveError(null); });
  }, [queueRemoteRefresh]);

  const queueRemoteWrite = useCallback((update: WorkspaceMutation, optimistic: boolean) => {
    pendingWritesRef.current += 1;
    const operation = { update, optimistic };
    pendingMutationsRef.current.push(operation);
    setIsSaving(true);
    setSaveError(null);
    return enqueueRemoteTask(remoteQueueRef, async () => {
      let success = false;
      try {
        const saved = await persistWorkspaceMutation(update);
        persistedDataRef.current = saved.data;
        isConnectedRef.current = true;
        setIsConnected(true);
        setStorageMessage(null);
        setHasSaved(true);
        success = true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "This change could not be saved. Try again.");
        if (!(error instanceof WorkspaceInputError)) markUnavailable();
      } finally {
        pendingMutationsRef.current = pendingMutationsRef.current.filter((item) => item !== operation);
        pendingWritesRef.current -= 1;
        let optimistic = persistedDataRef.current;
        for (const pending of pendingMutationsRef.current) {
          if (pending.optimistic) {
            try { optimistic = pending.update(optimistic); } catch { /* Its queued save will report the validation error. */ }
          }
        }
        dataRef.current = optimistic;
        setData(optimistic);
        setIsSaving(pendingWritesRef.current > 0);
      }
      return success;
    });
  }, [markUnavailable]);

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

  const updateWorkspace = useCallback((update: (current: WorkspaceData) => WorkspaceData, options: { optimistic?: boolean } = {}) => {
    if (!isConnectedRef.current) return Promise.resolve(false);
    try {
      const next = update(dataRef.current);
      if (options.optimistic !== false) {
        dataRef.current = next;
        setData(next);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "This change could not be saved.");
      return Promise.resolve(false);
    }
    return queueRemoteWrite(update, options.optimistic !== false);
  }, [queueRemoteWrite]);

  return { data, isLoaded, isConnected, isSaving, hasSaved, saveError, storageMessage, retryConnection, updateWorkspace };
}

const WorkspaceContext = createContext<ReturnType<typeof useWorkspaceState> | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspaceState();
  return createElement(WorkspaceContext.Provider, { value: workspace }, children);
}

export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  return workspace;
}
