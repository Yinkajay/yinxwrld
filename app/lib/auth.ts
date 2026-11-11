import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "yinxwrld_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function isAuthConfigured() {
  return Boolean(
    process.env.WORKSPACE_PASSWORD && process.env.WORKSPACE_PASSWORD.length >= 16 &&
    process.env.WORKSPACE_SESSION_SECRET && process.env.WORKSPACE_SESSION_SECRET.length >= 32,
  );
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function passwordMatches(candidate: string) {
  const password = process.env.WORKSPACE_PASSWORD;
  return isAuthConfigured() && Boolean(password) && constantTimeEqual(candidate, password!);
}

function sign(expiration: string) {
  return createHmac("sha256", process.env.WORKSPACE_SESSION_SECRET!)
    .update(`yinxwrld:${expiration}`)
    .digest("base64url");
}

export function createSessionToken() {
  if (!isAuthConfigured()) throw new Error("Workspace authentication is not configured.");
  const expiration = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS);
  return `${expiration}.${sign(expiration)}`;
}

export function isValidSessionToken(token: string | null | undefined) {
  if (!token || !isAuthConfigured()) return false;
  const [expiration, signature, extra] = token.split(".");
  if (!expiration || !signature || extra !== undefined || !/^\d+$/.test(expiration)) return false;
  if (Number(expiration) <= Math.floor(Date.now() / 1000)) return false;
  return constantTimeEqual(signature, sign(expiration));
}

export function isValidSessionCookie(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false;
  const cookie = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return false;
  try {
    return isValidSessionToken(decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)));
  } catch {
    return false;
  }
}

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
