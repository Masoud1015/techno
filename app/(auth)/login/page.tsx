// The login page is a Server Component; no browser-only hooks belong here.
import { headers } from "next/headers";
// Already-authenticated users should not see the login form again.
import { redirect } from "next/navigation";
// Authenticate the cookie on the server before rendering the public UI.
import { auth } from "@/lib/auth";
// Sanitize any return-to URL to prevent open redirect vulnerabilities.
import { safeReturnTo } from "@/lib/auth/phone";
// Client component owns inputs, OTP state and OAuth button interactions.
import { LoginForm } from "./login-form";

// Next.js 16 provides searchParams asynchronously in page components.
type Props = { searchParams: Promise<{ next?: string; error?: string }> };

// Route is /login; (auth) is a route group and does not change the URL.
export default async function LoginPage({ searchParams }: Props) {
  // User-provided query values are untrusted until they are checked.
  const query = await searchParams;
  // Keep only allowed local app paths as post-login destinations.
  const nextPath = safeReturnTo(query.next);
  // Check the database-backed session using the current request headers.
  const session = await auth.api.getSession({ headers: await headers() });
  // An authenticated user can go straight to the account (or requested destination).
  if (session) redirect(nextPath);
  // Keep transient Google callback failure readable without exposing provider internals.
  return <LoginForm nextPath={nextPath} googleError={Boolean(query.error)} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />;
}
