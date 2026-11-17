// Bun provides a Jest-like test runner without extra dependencies.
import { describe, expect, test } from "bun:test";
// Test the same pure helpers used by both the browser and server.
import { asciiDigits, normalizeIranMobile, safeReturnTo } from "../lib/auth/phone";

// The same handset must not create different identities due to input formatting.
describe("Iranian mobile normalization", () => {
  // A domestic eleven-digit number is accepted.
  test("converts local Iranian format", () => {
    expect(normalizeIranMobile("09151234567")).toBe("+989151234567");
  });
  // International forms point to exactly the same user identifier.
  test("normalizes three international variants", () => {
    expect(normalizeIranMobile("989151234567")).toBe("+989151234567");
    expect(normalizeIranMobile("00989151234567")).toBe("+989151234567");
    expect(normalizeIranMobile("+989151234567")).toBe("+989151234567");
  });
  // Persian and Arabic-Indic numerals are normalized safely.
  test("accepts regional digits", () => {
    expect(asciiDigits("۰۹۱۵١٢٣٤٥٦٧")).toBe("09151234567");
    expect(normalizeIranMobile("۰۹۱۵١٢٣٤٥٦٧")).toBe("+989151234567");
  });
  // Non-Iranian and malformed identifiers are rejected, not silently truncated.
  test("rejects malformed numbers", () => {
    expect(() => normalizeIranMobile("01234567890")).toThrow();
    expect(() => normalizeIranMobile("0915123456")).toThrow();
    expect(() => normalizeIranMobile("+12025550123")).toThrow();
  });
});

// User-provided return URLs must not redirect the browser to attacker sites.
describe("safe return-to path", () => {
  // A relative destination should survive when no scheme is involved.
  test("allows a local application route", () => {
    expect(safeReturnTo("/account/security")).toBe("/account/security");
  });
  // Network-path references must be blocked.
  test("blocks double slash redirects", () => {
    expect(safeReturnTo("//evil.example")).toBe("/account");
  });
  // Unapproved destinations are rejected even when they are same-origin.
  test("blocks unapproved paths", () => {
    expect(safeReturnTo("/api/auth/get-session")).toBe("/account");
    expect(safeReturnTo(["/account"])).toBe("/account");
  });
  // Relative loops into login should fall back to account.
  test("blocks auth redirect loops", () => {
    expect(safeReturnTo("/login")).toBe("/account");
  });
});
