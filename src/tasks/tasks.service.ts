import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.schema';
import { Request } from 'express';
import { sanitizeUser } from 'src/common/utils/sanitize-user';

@Injectable()
export class TasksService {
  constructor(private readonly prismaService: PrismaService) {}

  async createTask(workspaceId: string, data: CreateTaskDto, req: Request) {
    const userId = req.user?.id;
    if (!userId || typeof userId === undefined)
      throw new UnauthorizedException('Unauthenticated');

    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: userId },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');
    if (!workspace.members.length)
      throw new UnauthorizedException(
        'Only workspace members can create tasks.',
      );

    const member = workspace.members[0];

    if (!['OWNER', 'ADMIN'].includes(member.role))
      throw new UnauthorizedException(
        'Only workspace owner/admin can create tasks.',
      );

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

    if (assignedToId) {
      const isValidAssignee =
        await this.prismaService.workspaceMember.findFirst({
          where: {
            workspaceId,
            userId: assignedToId,
          },
        });

      if (!isValidAssignee)
        throw new BadRequestException(
          'Assigned user is not a member of this workspace.',
        );
    }

    const task = await this.prismaService.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title,
          description,
          status,
          priority,
          deadline: deadline ? new Date(deadline) : null,
          workspaceId,
          assignedToId: assignedToId || null,
          categoryId: categoryId || null,
          createdById: userId,
          links: links
            ? {
                create: links.map((link) => ({
                  title: link.title,
                  url: link.url,
                })),
              }
            : undefined,
        },
        include: {
          links: true,
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          userId: userId,
          type: 'CREATED',
        },
      });

      if (assignedToId) {
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: userId,
            type: 'ASSIGNED',
            meta: {
              from: null,
              to: assignedToId,
            },
          },
        });
      }

      if (priority) {
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: userId,
            type: 'PRIORITY_CHANGED',
            meta: {
              from: null,
              to: priority,
            },
          },
        });
      }

      if (deadline) {
        await tx.taskActivity.create({
          data: {
            taskId: task.id,
            userId: userId,
            type: 'DEADLINE_CHANGED',
            meta: {
              from: null,
              to: deadline,
            },
          },
        });
      }

      return task;
    });

    return {
      success: true,
      message: 'Task created successfully.',
      task,
    };
  }

  async getTasks(workspaceId: string) {
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      select: { id: true },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    const tasks = await this.prismaService.task.findMany({
      where: { workspaceId },
      include: {
        assignedTo: true,
        createdBy: true,
        category: true,
        workspace: true,
      },
    });

    const sanitizedTasks = tasks.map((task) => {
      const assignedTo = task.assignedTo ? sanitizeUser(task.assignedTo) : null;
      const createdBy = task.createdBy ? sanitizeUser(task.createdBy) : null;

      return {
        ...task,
        assignedTo,
        createdBy,
      };
    });

    return {
      success: true,
      message: 'Tasks retrieved successfully.',
      tasks: sanitizedTasks,
    };
  }

  async getTaskById(taskId: string, workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    if (!taskId) throw new BadRequestException('Task ID is required.');

    const task = await this.prismaService.task.findFirst({
      where: {
        id: taskId,
        workspaceId: workspaceId,
        workspace: { members: { some: { user: { id: req.user.id } } } },
      },
      include: {
        workspace: true,
        assignedTo: true,
        createdBy: true,
        category: true,
        activities: true,
        comments: true,
        attachments: true,
        links: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found.');

    const sanitizedTask = {
      ...task,
      assignedTo: task.assignedTo ? sanitizeUser(task.assignedTo) : null,
      createdBy: task.createdBy ? sanitizeUser(task.createdBy) : null,
    };

    return {
      success: true,
      message: 'Task retrieved successfully.',
      task: sanitizedTask,
    };
  }
}
