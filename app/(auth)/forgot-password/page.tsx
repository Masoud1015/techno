// This route never requires a signed-in session: it is the account recovery entry.
import { ResetPasswordForm } from "./reset-form";

// Dedicated route provides a bookmarkable destination from password sign-in.
export default function ForgotPasswordPage() {
  // The component owns both stages: phone request and verified reset.
  return <ResetPasswordForm />;
}
