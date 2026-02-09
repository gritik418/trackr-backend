import { z } from 'zod';

export const acceptWorkspaceInviteSchema = z.object({
  token: z.uuid('Invalid invite token'),
});

export type AcceptWorkspaceInviteDto = z.infer<
  typeof acceptWorkspaceInviteSchema
>;
