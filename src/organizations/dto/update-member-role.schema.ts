import { OrgRole } from 'generated/prisma/enums';
import { z } from 'zod';

const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(OrgRole, {
    message: 'Invalid role.',
  }),
});

export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;

export default updateMemberRoleSchema;
