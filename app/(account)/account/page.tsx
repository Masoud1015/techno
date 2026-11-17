// Each account page must derive userId from the trusted session.
import { requireSession } from "@/lib/auth/session";
// Keep customer details outside Better Auth tables.
import { prisma } from "@/lib/prisma";
// Next Link creates navigation without client-side auth logic.
import Link from "next/link";
// Small interactive sign-out button uses Better Auth's signOut endpoint.
import { SignOutButton } from "@/components/auth/sign-out-button";

// This Server Component renders only after the auth cookie was checked.
export default async function AccountPage() {
  // The returned ID is trusted because the auth library validated the session.
  const session = await requireSession("/account");
  // Fetch ONLY the profile connected to that user ID.
  const profile = await prisma.customerProfile.findUnique({ where: { userId: session.user.id } });
  // Do not display the synthetic placeholder email as a real address.
  const safeName = profile?.fullName || session.user.name;
  // Present customer actions; orders/services can be added under this subtree later.
  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-2xl bg-white p-6 shadow-sm">
      {/* Name is escaped by React automatically. */}
      <h1 className="text-2xl font-bold">حساب کاربری تکنوفارم</h1>
      <p>خوش آمدید، {safeName}</p>
      {/* Phone is the verified business identity, not an unverified Google profile. */}
      <p dir="ltr" className="text-left text-sm text-neutral-600">{session.user.phoneNumber || "شماره تأییدشده ثبت نشده"}</p>
      {/* Security settings manage Google and password methods attached to this User. */}
      <Link href="/account/security" className="block rounded-lg bg-amber-100 p-3">روش‌های ورود و امنیت حساب</Link>
      {/* Sign out invalidates the current session rather than clearing localStorage. */}
      <SignOutButton />
    </div>
  );
}
