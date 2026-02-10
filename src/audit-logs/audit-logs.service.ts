import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface CreateAuditLogDto {
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditLogsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createLog(data: CreateAuditLogDto) {
    return this.prismaService.auditLog.create({
      data: {
        ...data,
        details: data.details || {},
      },
    });
  }

  async getLogs(params: {
    orgId?: string;
    workspaceId?: string;
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      orgId,
      workspaceId,
      userId,
      action,
      entityType,
      entityId,
      limit = 50,
      offset = 0,
    } = params;

    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (workspaceId) where.workspaceId = workspaceId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [logs, total] = await Promise.all([
      this.prismaService.auditLog.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prismaService.auditLog.count({ where }),
    ]);

    return {
      success: true,
      logs,
      total,
      limit,
      offset,
    };
  }
}
