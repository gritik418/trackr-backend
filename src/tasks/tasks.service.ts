import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.schema';

@Injectable()
export class TasksService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTask(workspaceId: string, data: CreateTaskDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const {
      title,
      description,
      status,
      priority,
      deadline,
      projectId,
      assignedToId,
      categoryId,
      links,
    } = data;

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

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException(
        'Project does not belong to this workspace',
      );
    }

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

    if (assignedToId) {
      const assignedUserMember =
        await this.prismaService.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId,
              userId: assignedToId,
            },
          },
        });

      if (!assignedUserMember) {
        throw new BadRequestException(
          'Assigned user is not a member of this project',
        );
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
