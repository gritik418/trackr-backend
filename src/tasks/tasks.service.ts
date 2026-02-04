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
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: { members: { where: { user: { id: req.user.id } } } },
    });
    if (!workspace) throw new NotFoundException('Workspace not found.');

    if (!workspace.members.length)
      throw new UnauthorizedException(
        'Only workspace members can create tasks.',
      );

    if (!['ADMIN', 'OWNER'].includes(workspace.members[0].role))
      throw new UnauthorizedException(
        'Only workspace owner/admin can create tasks.',
      );

    const { title, description, status, assignedToId, categoryId } = data;

    const task = await this.prismaService.task.create({
      data: {
        title,
        description,
        workspaceId,
        status: status,
        assignedToId: assignedToId || null,
        categoryId: categoryId || null,
        createdById: req.user.id,
      },
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
