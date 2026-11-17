// This boundary isolates every authentication decision from vendor-specific APIs.
export interface SmsProvider {
  // Resolves only when the SMS gateway accepts the OTP send request.
  sendOtp(input: { phone: string; code: string }): Promise<void>;
}
