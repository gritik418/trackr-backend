import { z } from 'zod';
import { ProjectNature } from 'generated/prisma/enums';

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional().nullable(),
  nature: z.enum(ProjectNature).default(ProjectNature.PRIVATE),
});

export type CreateProjectDto = z.infer<typeof createProjectSchema>;

export default createProjectSchema;
