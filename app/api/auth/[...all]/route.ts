// Export the unified Better Auth API into Next.js App Router.
import { auth } from "@/lib/auth";
// Adapt Better Auth request handlers to Next.js Request/Response objects.
import { toNextJsHandler } from "better-auth/next-js";
// Prisma and Node cryptography require Node runtime, not Edge runtime.
export const runtime = "nodejs";
// One catch-all handles OTP, sessions, Google callback and password operations.
export const { GET, POST } = toNextJsHandler(auth);
