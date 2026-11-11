import { emptyWorkspace, isWorkspaceData } from "@/app/lib/workspace";
import { isSameOriginRequest, isValidSessionCookie } from "@/app/lib/auth";
import { getWorkspaceCollection } from "@/app/lib/mongodb";

function unauthorized() {
  return Response.json({ error: "Sign in to access this workspace." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isValidSessionCookie(request.headers.get("cookie"))) return unauthorized();

  try {
    const workspaces = await getWorkspaceCollection();
    const saved = await workspaces.findOne({ _id: "personal" });
    return Response.json(
      saved
        ? { exists: true, data: saved.data, updatedAt: saved.updatedAt }
        : { exists: false, data: emptyWorkspace(), updatedAt: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "MongoDB is not connected yet." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!isValidSessionCookie(request.headers.get("cookie"))) return unauthorized();
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This workspace update was blocked." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The workspace data was not valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("data" in body) || !isWorkspaceData(body.data)) {
    return Response.json({ error: "The workspace data did not match the expected format." }, { status: 400 });
  }

  try {
    const workspaces = await getWorkspaceCollection();
    const data = body.data;
    const updatedAt = new Date().toISOString();

    await workspaces.updateOne(
      { _id: "personal" },
      { $set: { data, updatedAt } },
      { upsert: true },
    );

    return Response.json({ data, updatedAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "MongoDB could not save the workspace." }, { status: 503 });
  }
}
