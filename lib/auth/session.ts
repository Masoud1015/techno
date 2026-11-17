// Server-only authorization must happen again for every protected operation.
import "server-only";
// Next.js request headers carry Better Auth's secure session cookie.
import { headers } from "next/headers";
// Redirect only from server components, not from arbitrary API handlers.
import { redirect } from "next/navigation";
// One central Better Auth instance verifies all login methods.
import { auth } from "@/lib/auth";

// Return a verified session or redirect to login, preserving destination.
export async function requireSession(destination = "/account") {
  // Fetch active session using actual request cookies, never user-supplied IDs.
  const session = await auth.api.getSession({ headers: await headers() });
  // A missing or expired session must not see protected account data.
  if (!session) redirect(`/login?next=${encodeURIComponent(destination)}`);
  // Return the session so callers can constrain queries by session.user.id.
  return session;
}
