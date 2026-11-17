"use client";
// Client-side navigation runs after Better Auth has invalidated the session.
import { useRouter } from "next/navigation";
// Use the library's official sign-out API rather than deleting a cookie manually.
import { authClient } from "@/lib/auth-client";

// Reusable button for both account and future storefront headers.
export function SignOutButton() {
  // Router updates the currently displayed authenticated screen.
  const router = useRouter();
  // The button stays a native button for keyboard accessibility.
  return <button type="button" className="rounded-lg border border-red-200 px-4 py-2 text-red-700" onClick={async () => {
    // The server revokes the cookie's corresponding session.
    const { error } = await authClient.signOut();
    // If sign-out fails, do not falsely claim the user was logged out.
    if (error) return;
    // Move away from private pages when the operation succeeds.
    router.replace("/login");
    // Invalidate the browser's Server Component snapshot.
    router.refresh();
  }}>خروج از حساب</button>;
}
