import { z } from 'zod';
import { ProjectNature } from 'generated/prisma/enums';

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  nature: z.nativeEnum(ProjectNature).optional(),
});

export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;

export default updateProjectSchema;
