"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result: { configured?: boolean; authenticated?: boolean } | null) => {
        setConfigured(Boolean(result?.configured));
        if (result?.authenticated) router.replace("/");
      })
      .catch(() => setConfigured(false));
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(typeof result.error === "string" ? result.error : "Could not sign in. Try again.");
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next") || "/";
      let nextPath = "/";
      if (requestedPath.startsWith("/")) {
        try {
          const destination = new URL(requestedPath, window.location.origin);
          if (destination.origin === window.location.origin) {
            nextPath = `${destination.pathname}${destination.search}${destination.hash}`;
          }
        } catch {
          // Ignore malformed return paths and open the home page instead.
        }
      }
      router.replace(nextPath);
    } catch {
      setMessage("Could not reach the sign in service. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="login-page" aria-labelledby="login-heading">
      <div className="login-card">
        <span className="brand-logo login-brand-logo" role="img" aria-label="yinxwrld" />
        <p className="panel-kicker">YOUR PERSONAL SPACE</p>
        <h1 id="login-heading">Good to have you back.</h1>
        <p className="login-description">Sign in to open your workspace.</p>

        {configured === false ? (
          <p className="login-message" role="status">
            Sign in is not configured on this server yet. Add a workspace password of at least 16 characters and a session secret of at least 32 characters to its environment.
          </p>
        ) : (
          <form className="login-form" onSubmit={signIn}>
            <label htmlFor="workspace-password">Workspace password</label>
            <input
              id="workspace-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoFocus
            />
            {message && <p className="login-message" role="alert">{message}</p>}
            <button className="button button-primary" type="submit" disabled={!password || isSubmitting || configured === null}>
              {isSubmitting ? "Opening…" : "Open workspace"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
