import { z } from 'zod';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';

export const getAuditLogsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.nativeEnum(AuditEntityType).optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
});

export type GetAuditLogsDto = z.infer<typeof getAuditLogsSchema>;
