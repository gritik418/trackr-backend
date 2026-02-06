import { z } from 'zod';

const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(3, 'Organization name must be at least 3 characters long.')
    .max(50, "Organization name can't exceed 50 characters."),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters long.')
    .max(40, "Slug can't exceed 40 characters.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug can only contain lowercase letters, numbers, and hyphens (no spaces).',
    ),
  logoUrl: z.url('Logo must be a valid URL.').optional().or(z.literal('')),
  websiteUrl: z
    .url('Website must be a valid URL.')
    .optional()
    .or(z.literal('')),
  contactEmail: z.email('Please enter a valid email address.'),
  description: z
    .string()
    .max(200, "Description can't exceed 200 characters.")
    .optional()
    .or(z.literal('')),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;

export default createOrganizationSchema;
