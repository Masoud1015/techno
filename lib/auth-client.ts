// This small client is imported only by browser components.
import { createAuthClient } from "better-auth/react";
// The phone client adds typed OTP and phone-password functions.
import { phoneNumberClient } from "better-auth/client/plugins";

// Same-origin is the default, so no hard-coded deployment hostname is necessary.
export const authClient = createAuthClient({
  plugins: [phoneNumberClient()],
});
