// Keep this module imported only by server-side auth; the API key stays on the server.
// Use a provider interface so the SMS gateway can later be swapped without editing auth.
import type { SmsProvider } from "@/lib/sms/provider";
// Normalize the gateway's expected local Iranian recipient format.
import { localIranMobile } from "@/lib/auth/phone";

// Model only the response properties used by this adapter.
type Result = { return?: { status?: number; message?: string } };

// Concrete Kavenegar Verify Lookup adapter.
export const kavenegar: SmsProvider = {
  // Called only by Better Auth's OTP send hooks on the server.
  async sendOtp({ phone, code }) {
    // Read secrets at call time; they must not be client-visible.
    const key = process.env.KAVENEGAR_API_KEY;
    // Template is configured in the Kavenegar console.
    const template = process.env.KAVENEGAR_OTP_TEMPLATE;
    // Fail safely if the gateway is not configured.
    if (!key || !template) throw new Error("SMS_CONFIG_MISSING");
    // This endpoint matches the published VerifyLookup API.
    const endpoint = `https://api.kavenegar.com/v1/${encodeURIComponent(key)}/verify/lookup.json`;
    // Form-encode parameters; do not concatenate raw user-supplied values into a URL.
    const body = new URLSearchParams({ receptor: localIranMobile(phone), token: code, template });
    // Avoid caching OTP sends and prevent indefinitely waiting on the provider.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    // An HTTP failure is distinct from an OTP that the user entered incorrectly.
    if (!response.ok) throw new Error("SMS_PROVIDER_HTTP_ERROR");
    // Decode and verify the gateway's own status field too.
    const data = (await response.json()) as Result;
    // Provider acceptance is NOT proof of handset delivery.
    if (data.return?.status !== 200) throw new Error("SMS_PROVIDER_REJECTED");
  },
};
