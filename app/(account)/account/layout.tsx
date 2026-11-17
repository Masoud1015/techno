// This Server Component protects the entire /account route subtree.
import type { ReactNode } from "react";
// Never rely on client-side `useSession` for authorization.
import { requireSession } from "@/lib/auth/session";

// Route group (account) is omitted from URLs, but /account remains protected.
export default async function AccountLayout({ children }: { children: ReactNode }) {
  // Validate the session on the server before rendering any sensitive child.
  await requireSession("/account");
  // Account pages use a lightweight RTL layout, separate from full-screen login.
  return <main dir="rtl" className="min-h-dvh bg-neutral-50 p-5 text-neutral-900 sm:p-10">{children}</main>;
}
