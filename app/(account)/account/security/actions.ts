"use server";
// This file is never imported as client logic; only its Server Action reference is sent.
import { headers } from "next/headers";
// Check current login status before granting a new credential to any user.
import { auth } from "@/lib/auth";
// DB query prevents overwriting an existing credential without its current password.
import { prisma } from "@/lib/prisma";

// Explicit action state keeps success/failure messages serializable for React.
export type SetPasswordState = { ok: boolean; message: string };

// A newly verified phone account can add its first credential.
export async function setInitialPassword(
  // React's form-state integration provides the previous result.
  _previous: SetPasswordState,
  // HTML form sends the new password to this server action over POST.
  data: FormData,
): Promise<SetPasswordState> {
  // Form data is untrusted, even when the component enforces minLength.
  const password = data.get("newPassword");
  // Reject incorrect field types and unsafe lengths before expensive hashing.
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return { ok: false, message: "رمز باید بین ۱۲ تا ۱۲۸ کاراکتر باشد." };
  }
  // Compare confirmation server-side; browser validation can be bypassed.
  if (password !== data.get("confirmPassword")) {
    return { ok: false, message: "تکرار رمز عبور مطابقت ندارد." };
  }
  // Read only the cookie/header values belonging to this request.
  const requestHeaders = await headers();
  // Session must be valid; no userId is accepted from FormData.
  const session = await auth.api.getSession({ headers: requestHeaders });
  // Unauthenticated requests cannot set anyone's credentials.
  if (!session) return { ok: false, message: "ابتدا وارد حساب شوید." };
  // A real verified phone is required before adding the first password.
  if (session.user.phoneNumberVerified !== true) {
    return { ok: false, message: "ابتدا شماره موبایل خود را تأیید کنید." };
  }
  // Reauthentication is useful for sensitive account operations.
  const age = Date.now() - new Date(session.session.createdAt).getTime();
  // Never let a months-old stolen session add an entirely new login method.
  if (age > 10 * 60_000 || age < -60_000) {
    return { ok: false, message: "برای تنظیم رمز، دوباره با پیامک وارد شوید." };
  }
  // Avoid allowing setPassword to overwrite an already-configured credential.
  const credential = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "credential" },
    select: { id: true },
  });
  // Existing credentials must use changePassword and current-password verification.
  if (credential) return { ok: false, message: "برای تغییر رمز قبلی از بخش تغییر رمز استفاده کنید." };
  try {
    // Delegate salted hashing and credential creation to Better Auth itself.
    await auth.api.setPassword({ body: { newPassword: password }, headers: requestHeaders });
    // No plaintext password is returned or stored in any profile record.
    return { ok: true, message: "رمز ورود با موفقیت تنظیم شد." };
  } catch {
    // Internal auth errors are not reflected verbatim into a public response.
    return { ok: false, message: "ثبت رمز انجام نشد. دوباره تلاش کنید." };
  }
}
