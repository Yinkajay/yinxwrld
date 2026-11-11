import { isWorkspaceData, type WorkspaceData } from "./workspace";

export type RemoteWorkspace = {
  exists: boolean;
  data: WorkspaceData;
  revision: string | null;
};

export type WorkspaceMutation = (current: WorkspaceData) => WorkspaceData;

export async function readRemoteWorkspace(): Promise<RemoteWorkspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the workspace from MongoDB.");

  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("data" in result) || !isWorkspaceData(result.data)) {
    throw new Error("MongoDB returned workspace data in an unexpected format.");
  }

  return {
    exists: "exists" in result && result.exists === true,
    data: result.data,
    revision: "revision" in result && typeof result.revision === "string" ? result.revision : null,
  };
}

/** Reapply each change to the latest database state, retrying concurrent writes. */
export async function persistWorkspaceMutation(update: WorkspaceMutation): Promise<RemoteWorkspace> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const remote = await readRemoteWorkspace();
    const response = await fetch("/api/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: update(remote.data), expectedRevision: remote.revision }),
    });

    if (response.status === 409) continue;
    if (!response.ok) throw new Error("Could not save the workspace to MongoDB.");

    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null || !("data" in result) || !isWorkspaceData(result.data) ||
      !("revision" in result) || typeof result.revision !== "string") {
      throw new Error("MongoDB returned workspace data in an unexpected format.");
    }

    return { exists: true, data: result.data, revision: result.revision };
  }

  throw new Error("The workspace is busy on another device. Please retry your change.");
}
