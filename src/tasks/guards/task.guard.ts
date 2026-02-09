import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectNature } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TaskGuard implements CanActivate {
  constructor(private readonly prismaService: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const taskId = req.params.taskId as string | null;
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Unauthenticated');
    }

    if (!taskId) {
      throw new BadRequestException('Task ID is required.');
    }

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const projectId = task.projectId;
    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.nature === ProjectNature.PRIVATE) {
      const projectMember = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!projectMember) {
        throw new UnauthorizedException('You are not a member of this project');
      }
    }

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: project.workspaceId,
          },
        },
      },
    );

    if (!workspaceMember) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    return true;
  }
}
