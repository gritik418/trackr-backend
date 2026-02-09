import { z } from 'zod';

export const acceptOrgInviteSchema = z.object({
  token: z.string().uuid('Invalid invite token'),
});

export type AcceptOrgInviteDto = z.infer<typeof acceptOrgInviteSchema>;
