import { BadRequestException, Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AuditAction,
  AuditEntityType,
  SubscriptionStatus,
} from 'generated/prisma/enums';
import { PdfService } from 'src/pdf/pdf.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetAuditLogsDto } from './dto/get-audit-logs.schema';
import { PlanLimits } from 'src/plans/interfaces/plans.interface';

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
  constructor(
    private readonly prismaService: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async createLog(data: CreateAuditLogDto) {
    return this.prismaService.auditLog.create({
      data: {
        ...data,
        details: data.details || {},
      },
    });
  }

  async getLogs(
    params: GetAuditLogsDto & { orgId: string; workspaceId: string | null },
  ) {
    const {
      orgId,
      workspaceId,
      userId,
      action,
      entityType,
      entityId,
      limit = 50,
      page = 1,
      search,
      startDate,
      endDate,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {};
    if (orgId) where.organizationId = orgId;
    if (workspaceId) where.workspaceId = workspaceId;
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const subscription = await this.prismaService.subscription.findFirst({
      where: {
        orgId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found.');
    }

    const limits = subscription.limits as unknown as PlanLimits;

    if (limits.auditLogRetentionDays === null) {
      throw new BadRequestException(
        'Audit log retention is not available for this plan.',
      );
    }

    if (limits.auditLogRetentionDays && startDate && endDate) {
      const requestedDays =
        new Date(endDate || Date.now()).getTime() -
        new Date(startDate || 0).getTime();
      if (requestedDays > limits.auditLogRetentionDays * 24 * 60 * 60 * 1000) {
        throw new BadRequestException(
          'Requested date range is greater than allowed audit log retention days.',
        );
      }
    }

    where.createdAt = {
      gte: new Date(
        startDate ||
          Date.now() - limits.auditLogRetentionDays * 24 * 60 * 60 * 1000,
      ),
      lte: new Date(endDate || Date.now()),
    };

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

  async exportLogs(
    orgId: string,
    res: Response,
    req: Request,
    query: GetAuditLogsDto,
  ) {
    const userId = req.user?.id;

    const subscription = await this.prismaService.subscription.findFirst({
      where: {
        orgId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      throw new BadRequestException('No active subscription found.');
    }

    const limits = subscription.limits as unknown as PlanLimits;

    if (!limits.isLogExportAvailable) {
      throw new BadRequestException(
        'Log export is not available for this plan.',
      );
    }

    if (limits.auditLogRetentionDays === null) {
      throw new BadRequestException(
        'Audit log retention is not available for this plan.',
      );
    }

    if (limits.auditLogRetentionDays && query.startDate && query.endDate) {
      const requestedDays =
        new Date(query.endDate || Date.now()).getTime() -
        new Date(query.startDate || 0).getTime();

      if (requestedDays > limits.auditLogRetentionDays * 24 * 60 * 60 * 1000) {
        throw new BadRequestException(
          'Requested date range is greater than allowed audit log retention days.',
        );
      }
    }

    const where: any = {};
    if (orgId) where.organizationId = orgId;

    if (query.startDate || query.endDate) {
      where.createdAt = {
        gte: new Date(
          query.startDate ||
            Date.now() - limits.auditLogRetentionDays * 24 * 60 * 60 * 1000,
        ),
        lte: new Date(query.endDate || Date.now()),
      };
    }

    if (!userId) throw new BadRequestException('User ID is required');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) throw new BadRequestException('User not found');

    const logs = await this.prismaService.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const pdf = this.pdfService.generateAuditLogsPdf(logs, res, {
      exportedBy: user.name,
      dateRange: `${new Date(query.startDate || 0).toLocaleDateString()} - ${new Date(query.endDate || Date.now()).toLocaleDateString()}`,
    });

    return pdf;
  }
}
