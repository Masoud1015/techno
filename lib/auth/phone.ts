// Persian digits frequently appear after users copy their number from a device.
const fa = "۰۱۲۳۴۵۶۷۸۹";
// Some keyboards use the Arabic-Indic digits instead.
const ar = "٠١٢٣٤٥٦٧٨٩";

// Convert localized numerals without changing the meaning of the input.
export function asciiDigits(input: string): string {
  // Replace Persian digits with their decimal positions.
  return input.replace(/[۰-۹]/g, (x) => String(fa.indexOf(x)))
    // Also normalize Arabic-Indic numerals.
    .replace(/[٠-٩]/g, (x) => String(ar.indexOf(x)));
}

// All keys and database fields use a single canonical E.164 representation.
export function normalizeIranMobile(input: string): string {
  // Trim and discard only harmless presentation separators.
  const p = asciiDigits(input).trim().replace(/[\s()-]/g, "");
  // Local format 09xxxxxxxxx => +989xxxxxxxxx.
  if (/^09\d{9}$/.test(p)) return "+98" + p.slice(1);
  // International format without the plus sign.
  if (/^989\d{9}$/.test(p)) return "+" + p;
  // International dialing prefix 00.
  if (/^00989\d{9}$/.test(p)) return "+" + p.slice(2);
  // Already-normalized format.
  if (/^\+989\d{9}$/.test(p)) return p;
  // Never allow arbitrary phone-like values into database keys.
  throw new Error("INVALID_IRAN_MOBILE");
}

// The SMS provider accepts the familiar local format in this adapter.
export function localIranMobile(phone: string): string {
  // Using the canonical converter prevents inconsistent recipient identifiers.
  return "0" + normalizeIranMobile(phone).slice(3);
}

// Do not accept `//evil.com`, backslashes or URL schemes as return locations.
export function safeReturnTo(value: unknown): string {
  // Only relative paths within the application are allowed.
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/account";
  // Limit post-login navigation to explicitly approved protected route families.
  if (!/^\/(?:account|checkout|orders|services)(?:\/|\?|$)/.test(value)) return "/account";
  // Reject backslashes and control characters used for URL confusion.
  if (/[\\\u0000-\u001F\u007F]/.test(value)) return "/account";
  // Avoid looping back to auth routes after success.
  if (value.startsWith("/login") || value.startsWith("/forgot-password")) return "/account";
  // Keep the verified relative destination and optional query string.
  return value;
}
