import {
  createSessionToken,
  isAuthConfigured,
  isSameOriginRequest,
  passwordMatches,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/app/lib/auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This sign in request was blocked." }, { status: 403 });
  }
  if (!isAuthConfigured()) {
    return Response.json({ error: "Workspace sign in is not configured yet." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Enter your workspace password." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("password" in body) || typeof body.password !== "string") {
    return Response.json({ error: "Enter your workspace password." }, { status: 400 });
  }
  if (!passwordMatches(body.password)) {
    return Response.json({ error: "That password did not match." }, { status: 401 });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookie = [
    `${SESSION_COOKIE}=${createSessionToken()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
  return Response.json({ success: true }, {
    headers: { "Set-Cookie": `${cookie}${secure}`, "Cache-Control": "no-store" },
  });
}
