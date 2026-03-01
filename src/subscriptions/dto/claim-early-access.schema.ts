import { z } from 'zod';

export const claimEarlyAccessSchema = z.object({
  planId: z.string('Please enter a valid plan ID.'),
});

export type ClaimEarlyAccessDto = z.infer<typeof claimEarlyAccessSchema>;
