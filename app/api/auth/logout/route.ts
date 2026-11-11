import { isSameOriginRequest, SESSION_COOKIE } from "@/app/lib/auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This sign out request was blocked." }, { status: 403 });
  }

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json({ success: true }, {
    headers: {
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
      "Cache-Control": "no-store",
    },
  });
}
