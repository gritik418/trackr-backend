import z from 'zod';

export const getOrgMembersSchema = z.object({
  search: z.string().optional().default(''),
  limit: z.coerce.number().optional().default(10),
  page: z.coerce.number().optional().default(1),
});

export type GetOrgMembersDto = z.infer<typeof getOrgMembersSchema>;
