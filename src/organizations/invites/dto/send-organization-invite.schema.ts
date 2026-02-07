import { z } from 'zod';

const sendOrgInviteSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

export type SendOrgInviteDto = z.infer<typeof sendOrgInviteSchema>;

export default sendOrgInviteSchema;
