import { isAuthConfigured, isValidSessionCookie } from "@/app/lib/auth";

export async function GET(request: Request) {
  return Response.json(
    {
      configured: isAuthConfigured(),
      authenticated: isValidSessionCookie(request.headers.get("cookie")),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
