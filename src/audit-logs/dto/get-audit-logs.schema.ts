import { z } from 'zod';

export const getAuditLogsSchema = z.object({
  orgId: z.string().optional(),
  workspaceId: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  startDate: z.coerce.date().default(new Date()).optional(),
  endDate: z.coerce.date().default(new Date()).optional(),
  search: z.string().optional().default(''),
  limit: z.coerce.number().optional().default(50),
  page: z.coerce.number().optional().default(1),
});

export type GetAuditLogsDto = z.infer<typeof getAuditLogsSchema>;
