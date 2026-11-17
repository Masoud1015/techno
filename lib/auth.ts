// Better Auth CLI imports this config too, so avoid the Next-specific server-only sentinel here.
// Core identity, account linking and database-backed sessions.
import { betterAuth } from "better-auth";
// The Prisma adapter reuses your existing ORM rather than introducing a second SQL client.
import { prismaAdapter } from "better-auth/adapters/prisma";
// Includes OTP, phone+password sign-in and SMS password recovery.
import { phoneNumber } from "better-auth/plugins";
// Ensures cookies are propagated when server-side Next.js actions use Better Auth.
import { nextCookies } from "better-auth/next-js";
// DB instance shared with domain models and quota accounting.
import { prisma } from "@/lib/prisma";
// Only canonical E.164 numbers are allowed into provider identities.
import { normalizeIranMobile } from "@/lib/auth/phone";
// The SMS provider handles external API formatting and response validation.
import { kavenegar } from "@/lib/sms/kavenegar";
// Provider-independent budget reservation runs before every send attempt.
import { reserveSms } from "@/lib/sms/quota";
// Derive stable, non-reversible placeholder emails for mobile-only customers.
import { createHmac } from "node:crypto";

// The base auth schema requires an email even for mobile registrations.
function temporaryEmail(phone: string): string {
  // Keep derivation secret independent from the SMS quota key.
  const secret = process.env.PHONE_EMAIL_SECRET;
  // Empty secrets could reveal the mapping to real phone numbers.
  if (!secret) throw new Error("PHONE_EMAIL_SECRET_MISSING");
  // Fixed-length HMAC also avoids leaking the phone in database exports.
  const tag = createHmac("sha256", secret).update(phone).digest("hex").slice(0, 48);
  // .invalid is reserved and cannot receive recovery emails.
  return `phone-${tag}@technofarm.invalid`;
}

// All sign-in methods must create sessions in one single identity system.
export const auth = betterAuth({
  // Use PostgreSQL through the project's existing Prisma Client.
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // A phone-only user can later set a password; public email sign-up is closed.
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  // Google stays optional during early SMS development when credentials are not ready.
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      disableSignUp: true,
    },
  } : {},
  // Disable automatic linking on email equality, especially with placeholder emails.
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      allowDifferentEmails: true,
    },
  },
  // Revocable DB sessions lasting seven days with daily activity-based renewal.
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  // Keep per-IP abuse throttles shared across app instances; SMS has an extra quota layer.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/phone-number/send-otp": { window: 60, max: 3 },
      "/phone-number/request-password-reset": { window: 60, max: 3 },
      "/phone-number/verify": { window: 60, max: 10 },
      "/sign-in/phone-number": { window: 60, max: 5 },
    },
  },
  // Trust only the IP field overwritten by our own reverse proxy; never trust raw client XFF.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  // Avoid silently changing the current project's ID conventions or cookie names.
  plugins: [
    // One plugin owns OTP generation, verification, phone sign-up and recovery.
    phoneNumber({
      otpLength: 6,
      expiresIn: 120,
      allowedAttempts: 5,
      // A credential login cannot bypass a pending mobile verification.
      requireVerification: true,
      // Only verified +989xxxxxxxxx numbers are valid at this boundary.
      phoneNumberValidator: (phone) => {
        try {
          return normalizeIranMobile(phone) === phone;
        } catch {
          return false;
        }
      },
      // A phone can create a user only after its OTP has been checked.
      signUpOnVerification: {
        getTempEmail: temporaryEmail,
        getTempName: () => "کاربر تکنوفارم",
      },
      // Always reserve money/recipient quotas BEFORE the paid API call.
      sendOTP: async ({ phoneNumber, code }) => {
        await reserveSms(phoneNumber);
        await kavenegar.sendOtp({ phone: phoneNumber, code });
      },
      // Password-recovery codes must be subject to the same cost protections.
      sendPasswordResetOTP: async ({ phoneNumber, code }) => {
        await reserveSms(phoneNumber);
        await kavenegar.sendOtp({ phone: phoneNumber, code });
      },
    }),
    // Keep this plugin last so Next.js Server Actions correctly send cookies.
    nextCookies(),
  ],
});
