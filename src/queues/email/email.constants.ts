export const EMAIL_QUEUE = 'email';

export const EMAIL_JOBS = {
  SEND_VERIFICATION: 'send-verification',
  FORGOT_PASSWORD: 'forgot-password',
  RESET_PASSWORD: 'reset-password',

  ORGANIZATION_INVITE: 'organization-invite',
  WORKSPACE_INVITE: 'workspace-invite',

  WELCOME: 'welcome',
  SEND_EARLY_ACCESS_ACTIVATION: 'send-early-access-activation',
};

export const emailSubject = {
  [EMAIL_JOBS.WELCOME]: 'Welcome to Trackr',
  [EMAIL_JOBS.SEND_VERIFICATION]: 'Verify your Trackr account',
  [EMAIL_JOBS.FORGOT_PASSWORD]: 'Reset your Trackr password',
  [EMAIL_JOBS.ORGANIZATION_INVITE]:
    "You've been invited to join an organization on Trackr",
  [EMAIL_JOBS.WORKSPACE_INVITE]:
    "You've been invited to join a workspace on Trackr",
  [EMAIL_JOBS.SEND_EARLY_ACCESS_ACTIVATION]:
    'Early Access Plan Activated - Trackr',
};
