"use client";
// Browser state keeps the recovery code out of browser URL/history.
import { useState, type FormEvent } from "react";
// Recovery returns the user to the regular unified phone-first login page.
import Link from "next/link";
// The same phone plugin implements reset OTP and credential replacement.
import { authClient } from "@/lib/auth-client";
// Normalize Iranian numbers and OTP digits exactly as in login.
import { asciiDigits, normalizeIranMobile } from "@/lib/auth/phone";

// Password reset has a smaller state machine than normal login.
type Stage = "request" | "reset" | "complete";

// No independent password store is created; Better Auth owns credential hashing.
export function ResetPasswordForm() {
  // Stage is changed only when the preceding request has been accepted.
  const [stage, setStage] = useState<Stage>("request");
  // Raw mobile string is needed only for entry and error correction.
  const [rawPhone, setRawPhone] = useState("");
  // Canonical mobile is used for the server's OTP challenge.
  const [phone, setPhone] = useState("");
  // The new password is not persisted to browser storage.
  const [newPassword, setNewPassword] = useState("");
  // Recovery OTP is transient, bounded to six digits.
  const [otp, setOtp] = useState("");
  // Disable forms during network requests.
  const [busy, setBusy] = useState(false);
  // UI errors do not reveal whether an account exists for a phone number.
  const [error, setError] = useState("");

  // Ask the plugin to send the password reset challenge.
  async function requestCode(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    let normalized: string;
    try {
      normalized = normalizeIranMobile(rawPhone);
    } catch {
      setError("شماره موبایل معتبر نیست.");
      return;
    }
    setBusy(true);
    try {
      // Server-side handler owns SMS quota and OTP generation.
      const { error: authError } = await authClient.phoneNumber.requestPasswordReset({ phoneNumber: normalized });
      // An upstream error cannot be treated as a delivered SMS.
      if (authError) throw new Error("RESET_REQUEST_FAILED");
      setPhone(normalized);
      setStage("reset");
    } catch {
      // Keep recovery enumeration-resistant; avoid explaining if the number exists.
      setError("درخواست بازیابی پذیرفته نشد. کمی بعد دوباره امتحان کنید.");
    } finally {
      setBusy(false);
    }
  }

  // Complete the reset only after the server accepts the OTP and new credential.
  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    // Match the Better Auth policy and avoid accidental short passwords.
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("رمز باید بین ۱۲ تا ۱۲۸ کاراکتر باشد.");
      return;
    }
    // A bad input must not even reach the server verification endpoint.
    if (!/^\d{6}$/.test(otp)) {
      setError("کد ۶ رقمی را کامل وارد کنید.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // This call checks OTP, changes credential and revokes old sessions per policy.
      const { error: authError } = await authClient.phoneNumber.resetPassword({ phoneNumber: phone, otp, newPassword });
      if (authError) throw new Error("RESET_FAILED");
      // Discard sensitive state as soon as recovery finishes.
      setOtp("");
      setNewPassword("");
      setStage("complete");
    } catch {
      setError("کد معتبر نیست یا تغییر رمز انجام نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  // Accessible RTL form uses native browser semantics.
  return (
    <section className="space-y-5">
      {/* Display a predictable heading for all recovery stages. */}
      <h1 className="text-center text-2xl font-bold text-amber-400">بازیابی رمز عبور</h1>
      {/* The same announcement component reports errors to screen readers. */}
      {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
      {/* First verify the phone associated with the credential. */}
      {stage === "request" && (
        <form className="space-y-3" onSubmit={requestCode}>
          <label htmlFor="recover-phone" className="block text-sm">شماره موبایل</label>
          <input id="recover-phone" dir="ltr" type="tel" autoComplete="tel" required value={rawPhone} onChange={(e) => setRawPhone(e.target.value)} className="w-full rounded-xl bg-white/15 p-3 text-center" placeholder="09151234567" />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-amber-500 p-3 font-bold text-black disabled:opacity-50">دریافت کد بازیابی</button>
        </form>
      )}
      {/* The second form requires a code and a new password, never the old one. */}
      {stage === "reset" && (
        <form className="space-y-3" onSubmit={resetPassword}>
          <p className="text-sm text-white/75">کد ارسال‌شده به {phone} را وارد کنید.</p>
          <label htmlFor="recover-code" className="block text-sm">کد بازیابی</label>
          <input id="recover-code" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(asciiDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} required className="w-full rounded-xl bg-white/15 p-3 text-center" />
          <label htmlFor="recover-password" className="block text-sm">رمز جدید</label>
          <input id="recover-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="w-full rounded-xl bg-white/15 p-3" />
          <button type="submit" disabled={busy} className="w-full rounded-xl bg-amber-500 p-3 font-bold text-black disabled:opacity-50">تغییر رمز عبور</button>
          {/* Restart rather than generating untracked recovery codes on every error. */}
          <button type="button" onClick={() => { setStage("request"); setOtp(""); setNewPassword(""); }} className="w-full text-sm text-white/70">اصلاح شماره و درخواست مجدد</button>
        </form>
      )}
      {/* Reset does not log the user in automatically; authenticate again explicitly. */}
      {stage === "complete" && <p role="status" className="text-center text-green-300">رمز تغییر کرد. حالا می‌توانید وارد شوید.</p>}
      {/* Permanent escape route to phone-first login. */}
      <Link href="/login" className="block text-center text-sm text-amber-300 underline">بازگشت به ورود</Link>
    </section>
  );
}
