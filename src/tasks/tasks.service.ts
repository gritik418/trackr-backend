import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.schema';
import {
  ProjectNature,
  ProjectRole,
  WorkspaceRole,
} from 'generated/prisma/enums';

@Injectable()
export class TasksService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTask(projectId: string, data: CreateTaskDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const {
      title,
      description,
      status,
      priority,
      deadline,
      assignedToId,
      categoryId,
      links,
    } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workspaceId = project.workspaceId;

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId,
            workspaceId,
          },
        },
      },
    );

    if (!workspaceMember) {
      throw new UnauthorizedException('You are not a member of this workspace');
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
        throw new UnauthorizedException(
          'You are not authorized to create tasks in this project',
        );
      }
    }

    if (project.nature === ProjectNature.PUBLIC) {
      if (workspaceMember.role === WorkspaceRole.MEMBER) {
        throw new UnauthorizedException(
          'Only workspace admins and owners can create tasks in public projects',
        );
      }
    } else {
      const projectMember = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!projectMember || projectMember.role === ProjectRole.MEMBER) {
        throw new UnauthorizedException(
          'You are not authorized to create tasks in this project',
        );
      }
    }

    if (assignedToId && assignedToId !== userId) {
      if (project.nature === ProjectNature.PUBLIC) {
        const assignedWorkspaceMember =
          await this.prismaService.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: assignedToId,
                workspaceId,
              },
            },
          });

        if (!assignedWorkspaceMember) {
          throw new BadRequestException(
            'Assigned user is not a member of this workspace',
          );
        }
      } else {
        const assignedProjectMember =
          await this.prismaService.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId,
                userId: assignedToId,
              },
            },
          });

        if (!assignedProjectMember) {
          throw new BadRequestException(
            'Assigned user is not a member of this project',
          );
        }
      }
    }

    const task = await this.prismaService.task.create({
      data: {
        title,
        description,
        status,
        priority,
        deadline,
        workspaceId,
        projectId,
        assignedToId,
        categoryId,
        createdById: userId,
        links: {
          create: links,
        },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        category: true,
        links: true,
      },
    });

    return {
      success: true,
      message: 'Task created successfully',
      task,
    };
  }
}
