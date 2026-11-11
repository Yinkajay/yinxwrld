import { emptyWorkspace, isWorkspaceData } from "@/app/lib/workspace";
import { isSameOriginRequest } from "@/app/lib/request-security";
import { getWorkspaceCollection } from "@/app/lib/mongodb";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Netlify-CDN-Cache-Control": "no-store",
  "X-Workspace-API": "2",
};

function databaseUnavailable(error: unknown) {
  const details = typeof error === "object" && error !== null ? error : {};
  const name = "name" in details && typeof details.name === "string" ? details.name : "Error";
  const errorCode = "code" in details ? details.code : undefined;
  const code = !process.env.MONGODB_URI ? "MONGODB_URI_MISSING"
    : errorCode === 18 ? "MONGODB_AUTHENTICATION_FAILED"
    : name === "MongoParseError" ? "MONGODB_URI_INVALID"
    : name === "MongoServerSelectionError" || name === "MongoNetworkError" ||
      errorCode === "ENOTFOUND" || errorCode === "ECONNREFUSED" || errorCode === "ETIMEDOUT"
      ? "MONGODB_CONNECTION_FAILED" : "MONGODB_ERROR";

  console.error("Workspace database unavailable", { code, errorName: name });
  return Response.json({ error: "MongoDB is not connected yet.", code }, { status: 503, headers: responseHeaders });
}

export async function GET() {
  try {
    const workspaces = await getWorkspaceCollection();
    const saved = await workspaces.findOne({ _id: "personal" });
    return Response.json(
      saved
        ? { exists: true, data: saved.data, updatedAt: saved.updatedAt, revision: saved.revision ?? null }
        : { exists: false, data: emptyWorkspace(), updatedAt: null, revision: null },
      { headers: responseHeaders },
    );
  } catch (error) {
    return databaseUnavailable(error);
  }
}

export async function PUT(request: Request) {
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

  if (!("expectedRevision" in body) || (body.expectedRevision !== null && typeof body.expectedRevision !== "string")) {
    return Response.json({ error: "Refresh this page before saving changes." }, { status: 409 });
  }

  try {
    const workspaces = await getWorkspaceCollection();
    const data = body.data;
    const updatedAt = new Date().toISOString();
    const revision = crypto.randomUUID();

    const result = await workspaces.updateOne(
      { _id: "personal", revision: body.expectedRevision === null ? { $exists: false } : body.expectedRevision },
      { $set: { data, updatedAt, revision } },
      { upsert: body.expectedRevision === null },
    );

    if (!result.matchedCount && !result.upsertedCount) {
      return Response.json({ error: "The workspace changed on another device. Retry using the latest version." }, { status: 409 });
    }

    return Response.json({ data, updatedAt, revision }, { headers: responseHeaders });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return Response.json({ error: "The workspace changed on another device. Retry using the latest version." }, { status: 409 });
    }
    return databaseUnavailable(error);
  }
}
