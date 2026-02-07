// Email verification token expiration (10 minutes)
export const VERIFICATION_TOKEN_EXPIRY_MINUTES = 10;
export const VERIFICATION_TOKEN_EXPIRY_MS =
  VERIFICATION_TOKEN_EXPIRY_MINUTES * 60 * 1000;

// Password reset token expiration (10 minutes)
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 10;
export const PASSWORD_RESET_TOKEN_EXPIRY_MS =
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;

// Organization invite expiration
export const ORG_INVITE_EXPIRY_DAYS = 7;
export const ORG_INVITE_EXPIRY_MS =
  ORG_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
