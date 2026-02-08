import { WorkspaceRole } from 'generated/prisma/enums';
import { z } from 'zod';

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceRole),
});

export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;

export default updateMemberRoleSchema;
