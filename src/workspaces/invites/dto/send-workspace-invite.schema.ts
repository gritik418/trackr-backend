import { z } from 'zod';
import { WorkspaceRole } from 'generated/prisma/enums';

const sendWorkspaceInviteSchema = z.object({
  email: z.string().email('Invalid email address.'),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});

export type SendWorkspaceInviteDto = z.infer<typeof sendWorkspaceInviteSchema>;

export default sendWorkspaceInviteSchema;
