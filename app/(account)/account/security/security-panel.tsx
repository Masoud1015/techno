"use client";
// React 19 form actions safely invoke the server-only initial-password operation.
import { useActionState, useEffect, useState, type FormEvent } from "react";
// Refresh Server Components after changing a capability flag such as hasPassword.
import { useRouter } from "next/navigation";
// Social linking and change-password use supported Better Auth browser APIs.
import { authClient } from "@/lib/auth-client";
// Only setting a FIRST password calls a restricted server action.
import { setInitialPassword, type SetPasswordState } from "./actions";

// Server supplies the provider status without leaking any tokens or password hashes.
type Props = { hasGoogle: boolean; hasPassword: boolean; phoneVerified: boolean; googleEnabled: boolean };
// No credential value is stored outside controlled input fields.
const initial: SetPasswordState = { ok: false, message: "" };

// One central panel controls the two optional login methods.
export function SecurityPanel({ hasGoogle, hasPassword, phoneVerified, googleEnabled }: Props) {
  // Navigation is needed to refresh provider connection flags after an action.
  const router = useRouter();
  // Secure server action state: only message strings are returned.
  const [state, action, pending] = useActionState(setInitialPassword, initial);
  // Existing password updates require the OLD password rather than session alone.
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Feedback for credential and Google actions, separate from Server Action result.
  const [message, setMessage] = useState("");
  // Stop repeated clicks during network activity.
  const [busy, setBusy] = useState(false);

  // When the first password is created, re-fetch capabilities from the server.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  // Initiate explicit OAuth linking only for an already authenticated account.
  async function connectGoogle() {
    if (busy || hasGoogle || !googleEnabled) return;
    setMessage("");
    setBusy(true);
    try {
      // Better Auth binds Google's subject to the CURRENT user's Account record.
      const { error } = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/account/security",
      });
      if (error) throw new Error("LINK_FAILED");
    } catch {
      setMessage("اتصال گوگل انجام نشد؛ مجدداً با پیامک وارد شوید و تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  // Existing credentials can be changed only with the current password.
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    if (newPassword.length < 12 || newPassword.length > 128) {
      setMessage("رمز جدید باید حداقل ۱۲ کاراکتر داشته باشد.");
      return;
    }
    setBusy(true);
    try {
      // revokeOtherSessions mitigates compromised old sessions on password change.
      const { error } = await authClient.changePassword({
        currentPassword: oldPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) throw new Error("CHANGE_FAILED");
      // Clear both sensitive fields after success.
      setOldPassword("");
      setNewPassword("");
      setMessage("رمز با موفقیت تغییر کرد.");
    } catch {
      setMessage("رمز فعلی نامعتبر است یا تغییر رمز انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  // The security panel is not a standalone auth provider or identity database.
  return (
    <div className="space-y-6">
      {/* Show all transient messages with screen-reader announcements. */}
      {message && <p role="status" className="rounded-lg bg-amber-100 p-3">{message}</p>}
      {/* Google accounts can only be attached to the currently authenticated User. */}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-bold">حساب گوگل</h2>
        <p className="text-sm text-neutral-600">{hasGoogle ? "حساب گوگل متصل است و می‌توانی از صفحه ورود با آن وارد شوی." : "برای ورود سریع‌تر، گوگل خودت را به همین حساب متصل کن."}</p>
        {!hasGoogle && <button onClick={() => void connectGoogle()} disabled={busy || !googleEnabled} className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">{googleEnabled ? "اتصال گوگل" : "پیکربندی گوگل تکمیل نشده"}</button>}
      </section>
      {/* Phone verification gates first-password creation on the server too. */}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-bold">رمز عبور</h2>
        {/* A password-less phone account needs the server-only setPassword action. */}
        {!hasPassword && phoneVerified && (
          <form action={action} className="space-y-3">
            <p className="text-sm text-neutral-600">برای اولین بار یک رمز حداقل ۱۲ کاراکتری تعریف کن. اگر نشست قدیمی باشد باید دوباره وارد شوی.</p>
            <label htmlFor="first-password" className="block text-sm">رمز جدید</label>
            <input id="first-password" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="w-full rounded-lg border p-2" />
            <label htmlFor="first-confirm" className="block text-sm">تکرار رمز</label>
            <input id="first-confirm" name="confirmPassword" type="password" autoComplete="new-password" required className="w-full rounded-lg border p-2" />
            {state.message && <p role="status" className="text-sm">{state.message}</p>}
            <button type="submit" disabled={pending} className="rounded-lg bg-amber-500 px-4 py-2 font-bold disabled:opacity-50">تنظیم رمز اولیه</button>
          </form>
        )}
        {/* Existing credentials need the old password (the session is not enough). */}
        {hasPassword && (
          <form className="space-y-3" onSubmit={changePassword}>
            <label htmlFor="old-password" className="block text-sm">رمز فعلی</label>
            <input id="old-password" type="password" autoComplete="current-password" required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full rounded-lg border p-2" />
            <label htmlFor="new-password" className="block text-sm">رمز جدید</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border p-2" />
            <button type="submit" disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 font-bold disabled:opacity-50">تغییر رمز</button>
          </form>
        )}
        {/* Never let an unverified phone bootstrap a new credential. */}
        {!hasPassword && !phoneVerified && <p className="text-sm text-red-700">ابتدا شماره موبایل را تأیید کن.</p>}
      </section>
    </div>
  );
}
