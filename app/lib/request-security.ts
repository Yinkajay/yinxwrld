export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    return (originUrl.protocol === "https:" || originUrl.protocol === "http:") &&
      originUrl.origin === origin && originUrl.host === host.toLowerCase();
  } catch {
    return false;
  }
}
