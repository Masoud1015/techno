// Security page is a Server Component backed by a validated session.
import Link from "next/link";
// Route parent also protects this path, but local verification makes dependencies explicit.
import { requireSession } from "@/lib/auth/session";
// Accounts are selected on the server; never expose provider tokens to the browser.
import { prisma } from "@/lib/prisma";
// The only client boundary is the interactive security controls.
import { SecurityPanel } from "./security-panel";

// Route URL is /account/security, even though it lives under a route group.
export default async function SecurityPage() {
  // Trust only a validated server session.
  const session = await requireSession("/account/security");
  // Retrieve provider IDs only; there is no reason to render OAuth tokens.
  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { providerId: true },
  });
  // Derive simple boolean flags for presentation.
  const hasGoogle = accounts.some((a) => a.providerId === "google");
  const hasPassword = accounts.some((a) => a.providerId === "credential");
  // The client receives only capability flags, not any credential hashes.
  return (
    <section className="mx-auto max-w-xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      {/* Visible breadcrumb keeps account recovery navigation obvious. */}
      <Link className="text-sm text-amber-700" href="/account">بازگشت به حساب</Link>
      <h1 className="text-2xl font-bold">امنیت و روش‌های ورود</h1>
      {/* Controls can link Google or set/change password for this same user. */}
      <SecurityPanel hasGoogle={hasGoogle} hasPassword={hasPassword} phoneVerified={session.user.phoneNumberVerified === true} googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)} />
    </section>
  );
}
