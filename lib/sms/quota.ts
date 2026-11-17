// Shared PostgreSQL transaction prevents simultaneous requests bypassing SMS budgets.
// Keyed hashes avoid storing a raw phone number in quota records.
import { createHmac } from "node:crypto";
// Use the same database singleton as Better Auth.
import { prisma } from "@/lib/prisma";

// All intervals use milliseconds for consistency with JavaScript timestamps.
const MINUTE = 60_000;
// Express the locked table's relevant columns explicitly.
type Row = { count: number; windowStart: Date; lastReservedAt: Date | null };
// Each rule is applied within the same transaction.
type Rule = { key: string; max: number; windowMs: number; cooldownMs: number };

// A keyed hash makes the same recipient share the same quota without exposing their number.
function recipientKey(phone: string): string {
  // Do not reuse the SMS-provider secret for independent application concerns.
  const secret = process.env.SMS_QUOTA_SECRET;
  // Refuse to operate without the security secret.
  if (!secret) throw new Error("SMS_QUOTA_SECRET_MISSING");
  // HMAC prevents trivial reversal of the tiny mobile number search space.
  return "recipient:" + createHmac("sha256", secret).update(phone).digest("hex");
}

// Reserve an outbound SMS attempt; reservations remain spent on gateway timeouts.
export async function reserveSms(phone: string): Promise<void> {
  // Choose a conservative budget, but do not hard-code the business decision.
  const dailyBudget = Number(process.env.SMS_DAILY_BUDGET ?? "500");
  // Fail closed instead of accidentally removing the total site budget.
  if (!Number.isSafeInteger(dailyBudget) || dailyBudget < 1) throw new Error("INVALID_SMS_BUDGET");
  // Shared global quota and independent per-recipient controls.
  const rules: Rule[] = [
    { key: "global", max: dailyBudget, windowMs: 24 * 60 * MINUTE, cooldownMs: 0 },
    { key: recipientKey(phone), max: 3, windowMs: 15 * MINUTE, cooldownMs: MINUTE },
  ];
  // Lock in the same order everywhere to reduce deadlock risk.
  rules.sort((a, b) => a.key.localeCompare(b.key));

  // Either reserve every rule or reserve none; never make network calls inside a transaction.
  await prisma.$transaction(async (tx) => {
    // Apply each independent quota rule atomically.
    for (const rule of rules) {
      // Upsert an empty row if absent; concurrency resolves on the unique primary key.
      await tx.$executeRaw`
        INSERT INTO "sms_quota" ("key", "count", "windowStart", "lastReservedAt")
        VALUES (${rule.key}, 0, NOW(), NULL)
        ON CONFLICT ("key") DO NOTHING
      `;
      // Row-level lock blocks another writer until this transaction completes.
      const rows = await tx.$queryRaw<Row[]>`
        SELECT "count", "windowStart", "lastReservedAt"
        FROM "sms_quota" WHERE "key" = ${rule.key} FOR UPDATE
      `;
      // Missing rows indicate a deployment/schema issue and must not bypass limits.
      const row = rows[0];
      // Abort and roll back previous reservations if the table is inconsistent.
      if (!row) throw new Error("SMS_QUOTA_ROW_MISSING");
      // Clock is sampled after acquiring the lock to avoid using a stale time.
      const now = new Date();
      // Reset the fixed window after its configured interval has passed.
      const expired = now.getTime() - row.windowStart.getTime() >= rule.windowMs;
      // Counts are reset only for expired windows.
      const count = expired ? 0 : row.count;
      // A per-number cooldown protects users from SMS flooding.
      const tooSoon = row.lastReservedAt !== null &&
        now.getTime() - row.lastReservedAt.getTime() < rule.cooldownMs;
      // This error should be presented as a generic cooldown to avoid leaking account existence.
      if (tooSoon) throw new Error("SMS_COOLDOWN");
      // Refuse any new reservation when the window quota is exhausted.
      if (count >= rule.max) throw new Error("SMS_QUOTA_EXCEEDED");
      // Commit the new counter while row is still locked.
      await tx.smsQuota.update({
        where: { key: rule.key },
        data: {
          count: count + 1,
          windowStart: expired ? now : row.windowStart,
          lastReservedAt: now,
        },
      });
    }
  });
}
