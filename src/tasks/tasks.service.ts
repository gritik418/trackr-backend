import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.schema';
import { GetTasksDto } from './dto/get-tasks.schema';
import { UpdateTaskDto } from './dto/update-task.schema';
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

  async getTasks(projectId: string, query: GetTasksDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const { status, priority, assignedToId } = query;

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
          'You are not authorized to view tasks in this project',
        );
      }
    }

    const tasks = await this.prismaService.task.findMany({
      where: {
        projectId,
        status,
        priority,
        assignedToId,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      message: 'Tasks fetched successfully',
      tasks,
    };
  }

  async updateTask(
    projectId: string,
    taskId: string,
    data: UpdateTaskDto,
    req: Request,
  ) {
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
    } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestException('Task does not belong to this project');
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

    if (project.nature === ProjectNature.PUBLIC) {
      if (workspaceMember.role === WorkspaceRole.MEMBER) {
        throw new UnauthorizedException(
          'Only workspace admins and owners can update tasks in public projects',
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

      if (!projectMember) {
        throw new UnauthorizedException(
          'You are not authorized to update tasks in this project',
        );
      }
    }

    if (assignedToId) {
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

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        priority,
        deadline,
        assignedToId,
        categoryId,
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
      message: 'Task updated successfully',
      task: updatedTask,
    };
  }
}
