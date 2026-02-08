import { z } from 'zod';
import { ProjectNature, ProjectStatus } from 'generated/prisma/enums';

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  nature: z.enum(ProjectNature).optional(),
  status: z.enum(ProjectStatus).optional(),
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export default updateProjectSchema;
