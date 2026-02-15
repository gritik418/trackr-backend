import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ProjectNature, ProjectRole } from 'generated/prisma/enums';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const projectId = req.params.projectId as string | null;
    const userId = req.user?.id;

    if (!projectId) {
      throw new BadRequestException('Project ID is required.');
    }

    if (!userId) {
      throw new ForbiddenException('Access denied');
    }

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            organization: { include: { members: { where: { userId } } } },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgAdminOrOwner =
      project.workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(
        project.workspace.organization.members[0].role,
      );

    if (isOrgAdminOrOwner) return true;

    const membership = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          userId,
          projectId,
        },
      },
      include: { project: { include: { workspace: true } } },
    });

    if (!membership && project.nature === ProjectNature.PRIVATE) {
      throw new ForbiddenException('You are not a member of this project');
    }

    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (project.nature === ProjectNature.PUBLIC) {
      const workspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: project.workspaceId,
            },
          },
        });

      if (!workspaceMember) {
        throw new ForbiddenException('You are not a member of this workspace');
      }

      if (
        !requiredRoles.includes(workspaceMember.role as unknown as ProjectRole)
      ) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }
    } else {
      if (membership && !requiredRoles.includes(membership.role)) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }
    }

    return true;
  }
}
