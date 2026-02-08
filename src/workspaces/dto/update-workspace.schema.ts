import { z } from 'zod';

const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(3, 'Workspace name must be at least 3 characters long.')
    .max(50, "Workspace name can't exceed 50 characters.")
    .optional(),
  iconUrl: z.url('Icon url must be a valid URL.').optional().or(z.literal('')),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long.')
    .max(40, "Slug can't exceed 40 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug can only contain lowercase letters, numbers, and hyphens (no spaces).',
    )
    .optional(),
  description: z
    .string()
    .max(200, "Description can't exceed 200 characters.")
    .optional()
    .or(z.literal('')),
});

export type UpdateWorkspaceDto = z.infer<typeof updateWorkspaceSchema>;

export default updateWorkspaceSchema;
