import { z } from 'zod';

const updateOrganizationSchema = z.object({
  name: z
    .string()
    .min(3, 'Organization name must be at least 3 characters long.')
    .max(50, "Organization name can't exceed 50 characters.")
    .optional(),
  logoUrl: z.url('Logo must be a valid URL.').optional().or(z.literal('')),
  websiteUrl: z
    .url('Website must be a valid URL.')
    .optional()
    .or(z.literal('')),
  contactEmail: z
    .email('Please enter a valid email address.')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .max(200, "Description can't exceed 200 characters.")
    .optional(),
});

export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

export default updateOrganizationSchema;
