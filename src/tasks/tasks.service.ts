import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.schema';
import { Request } from 'express';

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
}
