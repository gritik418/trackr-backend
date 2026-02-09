import { ProjectRole } from 'generated/prisma/enums';
import { z } from 'zod';

export const addProjectMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(ProjectRole).default(ProjectRole.MEMBER),
});

export type AddProjectMemberDto = z.infer<typeof addProjectMemberSchema>;
