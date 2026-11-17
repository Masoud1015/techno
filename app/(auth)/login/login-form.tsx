"use client";
// React state drives the three mutually exclusive login modes.
import { useEffect, useState, type FormEvent } from "react";
// App Router allows client-side navigation after a session cookie is issued.
import { useRouter } from "next/navigation";
// All authentication operations are delegated to the Better Auth client.
import { authClient } from "@/lib/auth-client";
// Normalize input even when the user types Persian or Arabic digits.
import { asciiDigits, normalizeIranMobile } from "@/lib/auth/phone";
// Standard Next.js links preserve regular navigation semantics.
import Link from "next/link";

// A closed union makes invalid UI states impossible to represent accidentally.
type Mode = "phone" | "otp" | "password";
// The server determines the destination; this client never trusts a raw URL.
type Props = { nextPath: string; googleError: boolean; googleEnabled: boolean };

// One reusable view matches the phone-first login experience in your mockup.
export function LoginForm({ nextPath, googleError, googleEnabled }: Props) {
  // Next.js client-side navigation helper.
  const router = useRouter();
  // Initial page always opens on phone + OTP, not social login.
  const [mode, setMode] = useState<Mode>("phone");
  // Store the visible raw input separately from its canonical phone representation.
  const [phoneInput, setPhoneInput] = useState("");
  // Canonical phone is captured only after successful local input validation.
  const [phone, setPhone] = useState("");
  // OTP remains transient UI state; never put it in localStorage or URLs.
  const [otp, setOtp] = useState("");
  // Password is also transient and never logged.
  const [password, setPassword] = useState("");
  // Prevent parallel clicks and duplicate in-flight auth requests.
  const [busy, setBusy] = useState(false);
  // Use safe generic errors without revealing whether a number is registered.
  const [error, setError] = useState(googleError ? "ورود با گوگل انجام نشد؛ ابتدا با پیامک وارد شوید و سپس گوگل را متصل کنید." : "");
  // Countdown is presentation only; the real cooldown is enforced in PostgreSQL.
  const [seconds, setSeconds] = useState(0);

  // Decrement the visible timer once per second while it is active.
  useEffect(() => {
    // Do not allocate an interval when already at zero.
    if (seconds <= 0) return;
    // Schedule one tick and clean it up whenever the state changes.
    const timer = setTimeout(() => setSeconds((x) => Math.max(0, x - 1)), 1000);
    // Cleanup prevents orphan timers after navigation.
    return () => clearTimeout(timer);
  }, [seconds]);

  // Return to the original protected page after session creation.
  function finishLogin() {
    // Router replace prevents the Back button from resubmitting OTP.
    router.replace(nextPath);
    // Refresh Server Components to read the newly written session cookie.
    router.refresh();
  }

  // Request a new OTP through Better Auth, never directly to the SMS provider.
  async function sendOtp(event?: FormEvent) {
    // Prevent native browser form navigation when called by the form.
    event?.preventDefault();
    // Ignore duplicate submits while another send request is pending.
    if (busy) return;
    // Clear stale failures before a new attempt.
    setError("");
    // Client normalization is for UX; the server validates again independently.
    let canonical: string;
    try {
      canonical = normalizeIranMobile(phoneInput);
    } catch {
      setError("شماره موبایل ایران را به شکل صحیح وارد کنید.");
      return;
    }
    // Block the button until the request completes.
    setBusy(true);
    try {
      // Built-in plugin creates the challenge and calls the SMS adapter server-side.
      const { error: authError } = await authClient.phoneNumber.sendOtp({ phoneNumber: canonical });
      // Server-side quota/cooldown failures must not be treated as success.
      if (authError) throw new Error("OTP_SEND_FAILED");
      // Save the canonical number used to validate the code later.
      setPhone(canonical);
      // Start the visible cooldown; the server is still authoritative.
      setSeconds(60);
      // Transition to code entry only after the send request was accepted.
      setMode("otp");
    } catch {
      setError("ارسال کد فعلاً ممکن نیست یا محدودیت ارسال فعال است. کمی بعد دوباره تلاش کنید.");
    } finally {
      // Always restore the form even when a network call fails.
      setBusy(false);
    }
  }

  // Verify the challenge and obtain Better Auth's regular session cookie.
  async function verifyOtp(event: FormEvent) {
    // Keep OTP out of the URL and prevent a full-page navigation.
    event.preventDefault();
    // Exactly six ASCII digits are allowed, including codes beginning with zero.
    if (!/^\d{6}$/.test(otp) || busy) return;
    // Drop any previous warning when a new verification begins.
    setError("");
    // Prevent double verification requests.
    setBusy(true);
    try {
      // This endpoint also handles new mobile-user sign-up on successful verification.
      const { error: authError } = await authClient.phoneNumber.verify({ phoneNumber: phone, code: otp });
      // Never navigate without a verified server-created session.
      if (authError) throw new Error("OTP_VERIFY_FAILED");
      // Remove the sensitive OTP from the visible input after success.
      setOtp("");
      // Continue to the business route selected before login.
      finishLogin();
    } catch {
      // Same message for wrong, stale, or exhausted code avoids internal detail leaks.
      setError("کد تأیید معتبر نیست یا منقضی شده است.");
    } finally {
      setBusy(false);
    }
  }

  // Credential login resolves to the same User and Session as OTP.
  async function loginPassword(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    let canonical: string;
    try {
      canonical = normalizeIranMobile(phoneInput);
    } catch {
      setError("شماره موبایل معتبر نیست.");
      return;
    }
    setBusy(true);
    try {
      // Credential lookup uses the phone plugin and existing credential Account.
      const { error: authError } = await authClient.signIn.phoneNumber({ phoneNumber: canonical, password, rememberMe: true });
      if (authError) throw new Error("INVALID_CREDENTIALS");
      // Clear password memory as soon as the request succeeds.
      setPassword("");
      finishLogin();
    } catch {
      // Do not disclose whether the phone exists or has a password.
      setError("شماره موبایل یا رمز عبور صحیح نیست.");
    } finally {
      setBusy(false);
    }
  }

  // Google is enabled only for a previously linked account.
  async function loginGoogle() {
    if (busy || !googleEnabled) return;
    setError("");
    setBusy(true);
    try {
      // OAuth state and PKCE are managed by Better Auth, not by custom browser code.
      const { error: authError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: nextPath,
        errorCallbackURL: "/login?error=google",
      });
      if (authError) throw new Error("GOOGLE_AUTH_FAILED");
      // Usually the browser redirects before this finally block executes.
    } catch {
      setError("ورود گوگل انجام نشد؛ ابتدا ورود پیامکی و اتصال گوگل را انجام دهید.");
    } finally {
      setBusy(false);
    }
  }

  // A single JSX branch per mode reduces conflicting validation and button behavior.
  return (
    <div className="space-y-5">
      {/* Fixed heading helps screen readers discover the current auth step. */}
      <header className="rounded-2xl border border-white/10 bg-white/10 p-5 text-center">
        <h1 className="text-2xl font-bold text-amber-400">{mode === "otp" ? "تأیید شماره موبایل" : mode === "password" ? "ورود با رمز عبور" : "خوش آمدید"}</h1>
        <p className="mt-2 text-sm text-white/75">{mode === "otp" ? `کد ارسال‌شده به ${phone} را وارد کنید` : "برای ادامه وارد حساب تکنوفارم شوید"}</p>
      </header>
      {/* Persistent alert uses role=alert so assistive technology announces errors. */}
      {error && <p role="alert" className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
      {/* Phone and password modes share the same phone input. */}
      {mode !== "otp" && (
        <form className="space-y-3" onSubmit={mode === "phone" ? sendOtp : loginPassword}>
          {/* A real label improves keyboard access and password manager behavior. */}
          <label htmlFor="phone" className="block text-sm">شماره موبایل</label>
          {/* Render the mobile number left-to-right even in an RTL page. */}
          <input id="phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="09151234567" required maxLength={20} className="w-full rounded-xl border border-white/20 bg-white/15 p-3 text-center text-white outline-none focus:border-amber-400" />
          {/* Password fields are shown only when explicitly requested. */}
          {mode === "password" && (
            <>
              <label htmlFor="password" className="block text-sm">رمز عبور</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-white/20 bg-white/15 p-3 text-white outline-none focus:border-amber-400" />
              {/* The reset flow verifies the same phone before changing credentials. */}
              <Link className="block text-sm text-amber-300 underline" href="/forgot-password">فراموشی رمز عبور</Link>
            </>
          )}
          {/* Use type=submit so Enter works like clicking the primary CTA. */}
          <button disabled={busy} type="submit" className="w-full rounded-xl bg-amber-500 p-3 font-bold text-neutral-950 disabled:opacity-50">{busy ? "در حال بررسی..." : mode === "phone" ? "دریافت کد تأیید" : "ورود با رمز عبور"}</button>
        </form>
      )}
      {/* Verify form is rendered only after an accepted OTP-send request. */}
      {mode === "otp" && (
        <form className="space-y-3" onSubmit={verifyOtp}>
          <label htmlFor="otp" className="block text-sm">کد تأیید ۶ رقمی</label>
          <input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" dir="ltr" value={otp} onChange={(e) => setOtp(asciiDigits(e.target.value).replace(/\D/g, "").slice(0, 6))} maxLength={6} required className="w-full rounded-xl border border-white/20 bg-white/15 p-3 text-center text-xl tracking-[.4em] text-white" />
          <button type="submit" disabled={busy || otp.length !== 6} className="w-full rounded-xl bg-amber-500 p-3 font-bold text-neutral-950 disabled:opacity-50">تأیید و ورود</button>
          {/* Resending uses the same quota-checked send function. */}
          <button type="button" disabled={busy || seconds > 0} onClick={() => void sendOtp()} className="w-full text-sm text-amber-300 disabled:text-white/50">{seconds > 0 ? `ارسال مجدد پس از ${seconds} ثانیه` : "ارسال مجدد کد"}</button>
          <button type="button" onClick={() => { setMode("phone"); setOtp(""); setError(""); }} className="w-full text-sm text-white/70">اصلاح شماره</button>
        </form>
      )}
      {/* Secondary actions do not steal focus from the main SMS login CTA. */}
      <div className="border-t border-white/20 pt-4 text-center text-sm text-white/70">همچنین می‌توانید</div>
      {/* Password mode can be toggled without navigating away or losing the phone. */}
      <button type="button" onClick={() => { setMode(mode === "password" ? "phone" : "password"); setError(""); }} className="w-full rounded-xl border border-white/20 p-3 text-sm" disabled={busy}>{mode === "password" ? "ورود با پیامک" : "ورود با رمز عبور"}</button>
      {/* Google works for accounts explicitly linked from account security settings. */}
      <button type="button" onClick={() => void loginGoogle()} disabled={busy || !googleEnabled} className="w-full rounded-xl border border-white/20 p-3 text-sm disabled:opacity-40">{googleEnabled ? "ورود با گوگل" : "ورود گوگل هنوز فعال نشده"}</button>
      {/* Explain linking so first-time customers do not think Google registration is broken. */}
      <p className="text-center text-xs text-white/55">بار اول با موبایل وارد شوید؛ سپس می‌توانید حساب گوگل را متصل کنید.</p>
    </div>
  );
}
