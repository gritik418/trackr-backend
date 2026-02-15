import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { WorkspaceRole } from 'generated/prisma/enums';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const workspaceId = req.params.workspaceId as string | null;
    const workspaceSlug = req.params.workspaceSlug as string | null;
    const orgId = req.params.orgId as string | null;
    const orgSlug = req.params.orgSlug as string | null;
    const userId = req.user?.id;

    if (!workspaceId && !workspaceSlug) {
      throw new BadRequestException('Workspace ID or Slug is required.');
    }

    if (!userId) {
      throw new ForbiddenException('Access denied');
    }

    const workspace = await this.prismaService.workspace.findFirst({
      where: {
        OR: [
          { id: workspaceId || undefined },
          { slug: workspaceSlug || undefined },
        ],
        organization:
          orgId || orgSlug
            ? {
                OR: [
                  { id: orgId || undefined },
                  { slug: orgSlug || undefined },
                ],
              }
            : undefined,
      },
      select: {
        id: true,
        organization: { select: { members: { where: { userId } } } },
      },
    });

    if (!workspace) {
      throw new ForbiddenException('Workspace not found or access denied');
    }

    const isOrgAdminOrOwner =
      workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(workspace.organization.members[0].role);

    const membership = await this.prismaService.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId: workspace.id,
        },
      },
    });

    if (!membership && !isOrgAdminOrOwner) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    if (isOrgAdminOrOwner) return true;

    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
