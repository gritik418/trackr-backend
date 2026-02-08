import { WorkspaceRole } from 'generated/prisma/enums';
import { z } from 'zod';

export const addMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;

export default addMemberSchema;
