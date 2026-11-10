"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyWorkspace,
  loadWorkspace,
  saveWorkspace,
  subscribeToWorkspaceChanges,
  type WorkspaceData,
} from "@/app/lib/workspace";

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(() => emptyWorkspace());
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const dataRef = useRef(data);
  const storageStatusRef = useRef<"ready" | "unavailable" | "corrupt">("ready");

  useEffect(() => {
    const syncFromStorage = () => {
      const result = loadWorkspace();
      dataRef.current = result.data;
      storageStatusRef.current = result.status;
      setData(result.data);
      setIsLoaded(true);
      setStorageMessage(
        result.status === "unavailable"
          ? "Browser storage is unavailable. Changes will only remain until this page is closed."
          : result.status === "corrupt"
            ? "Saved data could not be read. It has been left untouched, and changes will not replace it."
            : null,
      );
    };

    syncFromStorage();
    return subscribeToWorkspaceChanges(syncFromStorage);
  }, []);

  const updateWorkspace = useCallback((update: (current: WorkspaceData) => WorkspaceData) => {
    const next = update(dataRef.current);
    dataRef.current = next;
    setData(next);

    if (storageStatusRef.current === "corrupt") return;

    const saved = saveWorkspace(next);
    if (saved) {
      storageStatusRef.current = "ready";
      setStorageMessage(null);
    } else {
      storageStatusRef.current = "unavailable";
      setStorageMessage(
        "Browser storage is unavailable. Changes will only remain until this page is closed.",
      );
    }
  }, []);

  return { data, isLoaded, storageMessage, updateWorkspace };
}
