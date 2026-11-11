"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyWorkspace,
  hasPendingWorkspaceSync,
  hasWorkspaceEntries,
  isWorkspaceData,
  loadWorkspace,
  saveWorkspace,
  setPendingWorkspaceSync,
  type WorkspaceData,
} from "@/app/lib/workspace";

type RemoteWorkspace = {
  exists: boolean;
  data: WorkspaceData;
};

class WorkspaceRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function enqueueRemoteTask<T>(queue: { current: Promise<void> }, task: () => Promise<T>) {
  const result = queue.current.catch(() => undefined).then(task);
  queue.current = result.then(() => undefined, () => undefined);
  return result;
}

async function readRemoteWorkspace(): Promise<RemoteWorkspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new WorkspaceRequestError("Could not load the workspace.", response.status);

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
  if (!response.ok) throw new WorkspaceRequestError("Could not save the workspace.", response.status);

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("data" in result) || !isWorkspaceData(result.data)) {
    throw new Error("MongoDB returned workspace data in an unexpected format.");
  }
  return result.data;
}

function failureMessage(error: unknown, hasLocalCopy: boolean) {
  if (error instanceof WorkspaceRequestError && error.status === 401) {
    return "Your sign in expired. Sign in again to sync your workspace.";
  }

  return hasLocalCopy
    ? "MongoDB is unavailable. Changes are saved in this browser and will sync when the connection returns."
    : "MongoDB is unavailable and browser storage cannot be used. Changes may not be saved.";
}

function isSameWorkspace(left: WorkspaceData, right: WorkspaceData) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(() => emptyWorkspace());
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const dataRef = useRef(data);
  const localWritableRef = useRef(false);
  const remoteQueueRef = useRef<Promise<void>>(Promise.resolve());

  const writeLocalCopy = useCallback((next: WorkspaceData) => {
    if (!localWritableRef.current) return false;
    const saved = saveWorkspace(next);
    if (!saved) localWritableRef.current = false;
    return saved;
  }, []);

  const adoptWorkspace = useCallback((next: WorkspaceData) => {
    dataRef.current = next;
    setData(next);
    writeLocalCopy(next);
    setPendingWorkspaceSync(false);
  }, [writeLocalCopy]);

  const handleRemoteFailure = useCallback((error: unknown) => {
    setStorageMessage(failureMessage(error, localWritableRef.current));
    if (error instanceof WorkspaceRequestError && error.status === 401) {
      window.location.assign("/login");
    }
  }, []);

  const queueRemoteWrite = useCallback((snapshot: WorkspaceData) => {
    setPendingWorkspaceSync(true);
    void enqueueRemoteTask(remoteQueueRef, async () => {
      const saved = await writeRemoteWorkspace(snapshot);
      if (isSameWorkspace(dataRef.current, snapshot)) {
        adoptWorkspace(saved);
        setStorageMessage(null);
      }
    }).catch(handleRemoteFailure);
  }, [adoptWorkspace, handleRemoteFailure]);

  const queueRemoteRefresh = useCallback(() => {
    void enqueueRemoteTask(remoteQueueRef, async () => {
      const remote = await readRemoteWorkspace();

      if (hasPendingWorkspaceSync()) {
        const snapshot = dataRef.current;
        const saved = await writeRemoteWorkspace(snapshot);
        if (isSameWorkspace(dataRef.current, snapshot)) adoptWorkspace(saved);
      } else if (remote.exists) {
        adoptWorkspace(remote.data);
      } else if (hasWorkspaceEntries(dataRef.current)) {
        const snapshot = dataRef.current;
        setPendingWorkspaceSync(true);
        const saved = await writeRemoteWorkspace(snapshot);
        if (isSameWorkspace(dataRef.current, snapshot)) adoptWorkspace(saved);
      }

      setStorageMessage(null);
    }).catch(handleRemoteFailure);
  }, [adoptWorkspace, handleRemoteFailure]);

  useEffect(() => {
    let cancelled = false;
    const local = loadWorkspace();
    localWritableRef.current = local.status === "ready";
    if (local.status === "corrupt") setPendingWorkspaceSync(false);
    dataRef.current = local.data;
    // Browser storage is only available after hydration and must seed the workspace state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(local.data);

    void enqueueRemoteTask(remoteQueueRef, async () => {
      const remote = await readRemoteWorkspace();

      if (hasPendingWorkspaceSync() || (!remote.exists && hasWorkspaceEntries(dataRef.current))) {
        const snapshot = dataRef.current;
        const saved = await writeRemoteWorkspace(snapshot);
        if (isSameWorkspace(dataRef.current, snapshot)) adoptWorkspace(saved);
      } else if (remote.exists) {
        adoptWorkspace(remote.data);
      }

      if (local.status === "corrupt") {
        setStorageMessage(remote.exists
          ? "Your browser copy could not be read. The MongoDB copy is now in use."
          : "Your browser copy could not be read. This workspace is starting empty.");
      } else {
        setStorageMessage(null);
      }
    }).catch(handleRemoteFailure).finally(() => {
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
  }, [adoptWorkspace, handleRemoteFailure, queueRemoteRefresh]);

  const updateWorkspace = useCallback((update: (current: WorkspaceData) => WorkspaceData) => {
    const next = update(dataRef.current);
    dataRef.current = next;
    setData(next);
    setPendingWorkspaceSync(true);
    writeLocalCopy(next);
    queueRemoteWrite(next);
    if (localWritableRef.current) setStorageMessage(null);
  }, [queueRemoteWrite, writeLocalCopy]);

  return { data, isLoaded, storageMessage, updateWorkspace };
}
