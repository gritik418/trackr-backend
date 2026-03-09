import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Limit } from '../enums/limit.enum';

@Injectable()
export class LimitHandler {
  constructor(private readonly prismaService: PrismaService) {}

  async checkLimit(
    limitKey: Limit,
    orgId: string,
    context?: any,
  ): Promise<boolean> {
    const currentUsage = await this.getCurrentUsage(limitKey, orgId, context);
    const limitValue = context?.limitValue;

    if (typeof limitValue === 'boolean') {
      return limitValue;
    }

    if (typeof limitValue === 'number') {
      return currentUsage < limitValue;
    }

    return true;
  }

  private async getCurrentUsage(
    limitKey: Limit,
    orgId: string,
    context?: any,
  ): Promise<number> {
    switch (limitKey) {
      case Limit.MAX_WORKSPACES:
        return this.prismaService.workspace.count({
          where: { organizationId: orgId },
        });

      case Limit.MAX_PROJECTS_PER_WORKSPACE:
        if (!context?.workspaceId) return 0;
        return this.prismaService.project.count({
          where: { workspaceId: context.workspaceId },
        });

      case Limit.MAX_TASKS_PER_PROJECT:
        if (!context?.projectId) return 0;
        return this.prismaService.task.count({
          where: { projectId: context.projectId },
        });

      case Limit.MAX_MEMBERS_PER_ORG:
        return this.prismaService.organizationMember.count({
          where: { organizationId: orgId },
        });

      default:
        return 0;
    }
  }
}
