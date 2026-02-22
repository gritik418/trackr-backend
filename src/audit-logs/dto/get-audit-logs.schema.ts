import { z } from 'zod';

export const getAuditLogsSchema = z.object({
  dateRange: z
    .enum(['all-time', 'last-7-days', 'last-30-days', 'last-90-days'])
    .default('all-time'),
});

export type GetAuditLogsDto = z.infer<typeof getAuditLogsSchema>;
