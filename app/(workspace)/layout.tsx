import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isValidSessionToken, SESSION_COOKIE } from "@/app/lib/auth";

async function RequireWorkspaceSession({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!isValidSessionToken(session)) redirect("/login");

  return children;
}

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <RequireWorkspaceSession>{children}</RequireWorkspaceSession>
    </Suspense>
  );
}
