import { BadRequestException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from 'generated/prisma/enums';
import { PlanLimits } from 'src/plans/interfaces/plans.interface';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboardStats(orgId: string) {
    if (!orgId)
      throw new BadRequestException('Please provide organization ID.');

    const organization = await this.prismaService.organization.findUnique({
      where: {
        id: orgId,
      },
    });

    if (!organization) throw new BadRequestException('Organization not found.');

    const [
      membersCount,
      projectsCount,
      workspacesCount,
      activeSubscription,
      recentLogs,
    ] = await Promise.all([
      this.prismaService.organizationMember.count({
        where: {
          organizationId: orgId,
        },
      }),
      this.prismaService.project.count({
        where: {
          workspace: {
            organizationId: orgId,
          },
        },
      }),
      this.prismaService.workspace.count({
        where: {
          organizationId: orgId,
        },
      }),
      this.prismaService.subscription.findFirst({
        where: {
          orgId,
          status: SubscriptionStatus.ACTIVE,
        },
      }),
      this.prismaService.auditLog.findMany({
        where: {
          organizationId: orgId,
        },
        take: 5,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const limits = activeSubscription?.limits as unknown as PlanLimits;

    const percentage = {
      members: (membersCount / (limits?.maxMembersPerOrg || 0)) * 100,
      projects: (projectsCount / (limits?.maxProjectsPerWorkspace || 0)) * 100,
      workspaces: (workspacesCount / (limits?.maxWorkspaces || 0)) * 100,
    };

    return {
      success: true,
      message: 'Dashboard stats found.',
      stats: {
        membersCount,
        projectsCount,
        workspacesCount,
        activeSubscription,
        recentLogs,
      },
      percentage,
    };
  }
}
