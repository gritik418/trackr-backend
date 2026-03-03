import { InviteStatus } from 'generated/prisma/enums';
import z from 'zod';

export const getOrgInvitesSchema = z.object({
  search: z.string().optional().default(''),
  limit: z.coerce.number().optional().default(10),
  page: z.coerce.number().optional().default(1),
  status: z.enum(InviteStatus).optional(),
});

export type GetOrgInvitesDto = z.infer<typeof getOrgInvitesSchema>;
