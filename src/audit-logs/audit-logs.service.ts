import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';

export interface CreateAuditLogDto {
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
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
    action?: AuditAction;
    entityType?: AuditEntityType;
    entityId?: string;
    limit?: number;
    page?: number;
  }) {
    const {
      orgId,
      workspaceId,
      userId,
      action,
      entityType,
      entityId,
      limit = 50,
      page = 1,
    } = params;

    const skip = (page - 1) * limit;

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
        skip,
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
      page,
    };
  }
}
