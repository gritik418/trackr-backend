import { z } from 'zod';
import { WorkspaceRole } from 'generated/prisma/enums';

const sendWorkspaceInviteSchema = z.object({
  email: z.email('Invalid email address.'),
  role: z.enum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});

export type SendWorkspaceInviteDto = z.infer<typeof sendWorkspaceInviteSchema>;

export default sendWorkspaceInviteSchema;
