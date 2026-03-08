import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuditAction,
  AuditEntityType,
  ProjectNature,
  ProjectRole,
  TaskStatus,
  WorkspaceRole,
} from 'generated/prisma/enums';
import { TaskUncheckedCreateInput } from 'generated/prisma/models';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignTaskDto } from './dto/assign-task.schema';
import { CreateTaskDto } from './dto/create-task.schema';
import {
  GetMyTasksDto as GetTasksDto,
  TaskPriorityWithAll,
  TaskStatusWithAll,
} from '../workspaces/dto/get-my-tasks.schema';
import { UnassignTaskDto } from './dto/unassign-task.schema';
import { UpdateTaskDto } from './dto/update-task.schema';

@Injectable()
export class TasksService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private async isOrgAdmin(orgId: string, userId: string): Promise<boolean> {
    const orgMember = await this.prismaService.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
      select: { role: true },
    });

    return !!orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role);
  }

  async createTask(projectId: string, data: CreateTaskDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const {
      title,
      description,
      status,
      priority,
      deadline,
      tag,
      assignedToIds,
      categoryId,
      links,
    } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workspaceId = project.workspaceId;

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin) {
      if (project.nature === ProjectNature.PRIVATE) {
        const projectMember = await this.prismaService.projectMember.findUnique(
          {
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          },
        );

        if (!projectMember) {
          throw new UnauthorizedException(
            'You are not authorized to create tasks in this project',
          );
        }
      }

      if (project.nature === ProjectNature.PUBLIC) {
        if (workspaceMember!.role === WorkspaceRole.MEMBER) {
          throw new UnauthorizedException(
            'Only workspace admins and owners can create tasks in public projects',
          );
        }
      } else {
        const projectMember = await this.prismaService.projectMember.findUnique(
          {
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          },
        );

        if (!projectMember || projectMember.role === ProjectRole.MEMBER) {
          throw new UnauthorizedException(
            'You are not authorized to create tasks in this project',
          );
        }
      }
    }

    if (assignedToIds && assignedToIds.length > 0) {
      if (project.nature === ProjectNature.PUBLIC) {
        const assignedWorkspaceMembers =
          await this.prismaService.workspaceMember.findMany({
            where: {
              userId: { in: assignedToIds },
              workspaceId,
            },
            select: { userId: true },
          });

        if (assignedWorkspaceMembers.length !== assignedToIds.length) {
          throw new BadRequestException(
            'One or more assigned users are not members of this workspace',
          );
        }
      } else {
        const assignedProjectMembers =
          await this.prismaService.projectMember.findMany({
            where: {
              projectId,
              userId: { in: assignedToIds },
            },
            select: { userId: true },
          });

        if (assignedProjectMembers.length !== assignedToIds.length) {
          throw new BadRequestException(
            'One or more assigned users are not members of this project',
          );
        }
      }
    }

    const taskData: TaskUncheckedCreateInput = {
      title,
      description,
      status,
      priority,
      deadline,
      workspaceId,
      projectId,
      categoryId,
      tag,
      createdById: userId,
      assignees: {
        connect: assignedToIds?.map((id) => ({ id })) || [],
      },
      links: {
        create: links,
      },
    };

    if (status === TaskStatus.DONE) {
      taskData.completedAt = new Date();
    }

    const task = await this.prismaService.task.create({
      data: taskData,
      include: {
        assignees: {
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

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_CREATE,
      entityType: AuditEntityType.TASK,
      entityId: task.id,
      organizationId: project.workspace.organizationId,
      workspaceId,
      userId,
      details: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignees: task.assignees.map((assignee) => ({
          id: assignee.id,
          name: assignee.name,
          email: assignee.email,
        })),
        category: task.category,
        tag: task.tag,
        links: task.links,
        deadline: task.deadline,
        description: task.description,
        categoryId: task.categoryId,
        createdById: {
          id: userId,
          name: req?.user?.name,
          email: req?.user?.email,
        },
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        completedAt: task.completedAt,
      },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
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

    const where: Record<string, any> = {
      projectId,
    };
    const { status, priority, tag, page, limit, sortBy, sortOrder, search } =
      query;

    if (status && status !== TaskStatusWithAll.ALL) where.status = status;
    if (priority) where.priority = priority;
    if (tag) where.tag = tag;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Record<string, any> = {};
    if (sortBy) orderBy[sortBy] = sortOrder;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workspaceId = project.workspaceId;

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin && project.nature === ProjectNature.PRIVATE) {
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
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        assignees: {
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
      orderBy,
    });

    const totalTasks = await this.prismaService.task.count({
      where,
    });

    return {
      success: true,
      message: 'Tasks fetched successfully.',
      tasks,
      pagination: {
        page,
        limit,
        total: totalTasks,
        totalPages: Math.ceil(totalTasks / limit),
      },
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

    const updatedFields: Record<string, string | Date> = {};
    if (data.title) updatedFields.title = data.title;
    if (data.description) updatedFields.description = data.description;
    if (data.status) updatedFields.status = data.status;
    if (data.status && data.status === TaskStatus.DONE)
      updatedFields.completedAt = new Date();
    if (data.priority) updatedFields.priority = data.priority;
    if (data.deadline) updatedFields.deadline = data.deadline;
    if (data.categoryId) updatedFields.categoryId = data.categoryId;
    if (data.tag) updatedFields.tag = data.tag;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestException('Task does not belong to this project');
    }

    const workspaceId = project.workspaceId;

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin) {
      if (project.nature === ProjectNature.PUBLIC) {
        if (workspaceMember!.role === WorkspaceRole.MEMBER) {
          throw new UnauthorizedException(
            'Only workspace admins and owners can update tasks in public projects',
          );
        }
      } else {
        const projectMember = await this.prismaService.projectMember.findUnique(
          {
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          },
        );

        if (!projectMember) {
          throw new UnauthorizedException(
            'You are not authorized to update tasks in this project',
          );
        }
      }
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        ...updatedFields,
      },
      include: {
        assignees: {
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

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_UPDATE,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      organizationId: project.workspace.organizationId,
      workspaceId,
      userId,
      details: {
        ...updatedFields,
        previousState: {
          title: task.title,
          status: task.status,
          priority: task.priority,
          deadline: task.deadline,
          categoryId: task.categoryId,
          tag: task.tag,
          description: task.description,
        },
        updatedBy: {
          id: userId,
          name: req?.user?.name,
          email: req?.user?.email,
        },
      },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Task updated successfully',
      task: updatedTask,
    };
  }

  async assignTask(
    projectId: string,
    taskId: string,
    data: AssignTaskDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { userIds: assigneeIds } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestException('Task does not belong to this project');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin) {
      if (project.nature === ProjectNature.PUBLIC) {
        if (workspaceMember!.role === WorkspaceRole.MEMBER) {
          throw new UnauthorizedException(
            'Only workspace admins and owners can assign tasks in public projects',
          );
        }

        const validatedAssigneeIds: string[] = [];

        for (const assigneeId of assigneeIds) {
          const assigneeMember =
            await this.prismaService.workspaceMember.findUnique({
              where: {
                userId_workspaceId: {
                  userId: assigneeId,
                  workspaceId: project.workspaceId,
                },
              },
            });

          if (assigneeMember) {
            validatedAssigneeIds.push(assigneeId);
          }
        }

        if (validatedAssigneeIds.length !== assigneeIds.length) {
          throw new BadRequestException(
            'One or more assignees are not members of this workspace.',
          );
        }
      } else {
        const projectMember = await this.prismaService.projectMember.findUnique(
          {
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          },
        );

        if (
          !projectMember &&
          workspaceMember?.role !== WorkspaceRole.OWNER &&
          workspaceMember?.role !== WorkspaceRole.ADMIN
        ) {
          throw new UnauthorizedException(
            'You are not authorized to assign tasks in this project',
          );
        }

        for (const assigneeId of assigneeIds) {
          const assigneeProjectMember =
            await this.prismaService.projectMember.findUnique({
              where: {
                projectId_userId: {
                  projectId,
                  userId: assigneeId,
                },
              },
            });

          if (!assigneeProjectMember) {
            throw new BadRequestException(
              'One or more assignees are not members of this project.',
            );
          }
        }
      }
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        assignees: {
          connect: assigneeIds.map((id) => ({ id })),
        },
      },
      include: {
        assignees: {
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

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_ASSIGN,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: {
        taskId: taskId,
        previousAssignees: task.assignees, // task was fetched before update
        assignedTo: updatedTask.assignees
          .filter((assignee) => assigneeIds?.includes(assignee.id))
          .map((assignee) => ({
            id: assignee.id,
            name: assignee.name,
            email: assignee.email,
          })),
        assignedBy: {
          userId,
          name: user?.name,
          email: user?.email,
        },
      },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Task assigned successfully',
      task: updatedTask,
    };
  }

  async unassignTask(
    projectId: string,
    taskId: string,
    data: UnassignTaskDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { userIds: assigneeIds } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: { assignees: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestException('Task does not belong to this project');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin) {
      if (project.nature === ProjectNature.PUBLIC) {
        if (workspaceMember!.role === WorkspaceRole.MEMBER) {
          throw new UnauthorizedException(
            'Only workspace admins and owners can unassign tasks in public projects',
          );
        }
      } else {
        const projectMember = await this.prismaService.projectMember.findUnique(
          {
            where: {
              projectId_userId: {
                projectId,
                userId,
              },
            },
          },
        );

        if (
          !projectMember &&
          workspaceMember?.role !== WorkspaceRole.OWNER &&
          workspaceMember?.role !== WorkspaceRole.ADMIN
        ) {
          throw new UnauthorizedException(
            'You are not authorized to unassign tasks in this project',
          );
        }
      }
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        assignees: {
          disconnect: assigneeIds.map((id) => ({ id })),
        },
      },
      include: {
        assignees: {
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

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_UNASSIGN,
      entityType: AuditEntityType.TASK,
      entityId: taskId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: {
        taskId: taskId,
        previousAssignees: task.assignees,
        unassignedFrom: (
          await this.prismaService.user.findMany({
            where: { id: { in: assigneeIds } },
            select: { id: true, name: true, email: true },
          })
        ).map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
        unassignedBy: {
          userId,
          name: user?.name,
          email: user?.email,
        },
      },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Task unassigned successfully',
      task: updatedTask,
    };
  }

  async getMyTasks(projectId: string, query: GetTasksDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const { status, priority, tag, search, sortBy, sortOrder, limit, page } =
      query;

    const where: Record<string, any> = {};

    if (status && status !== TaskStatusWithAll.ALL) where.status = status;
    if (priority && priority !== TaskPriorityWithAll.ALL)
      where.priority = priority;
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }
    if (tag) where.tag = tag;

    const orderBy: Record<string, any> = {};

    if (sortBy) {
      orderBy[sortBy] = sortOrder ? sortOrder : 'asc';
    }

    where.assignees = { some: { id: userId } };
    where.projectId = projectId;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workspaceId = project.workspaceId;

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

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

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin && project.nature === ProjectNature.PRIVATE) {
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
      where,
      take: limit,
      skip: (page - 1) * limit,
      include: {
        assignees: {
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
      orderBy: orderBy || { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Tasks fetched successfully',
      tasks,
    };
  }

  async getTaskById(projectId: string, taskId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });

    if (!task || !task.project) {
      throw new NotFoundException('Task not found');
    }

    if (task.projectId !== projectId) {
      throw new BadRequestException('Task does not belong to this project');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      task.project.workspace.organizationId,
      userId,
    );

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId,
            workspaceId: task.project.workspaceId,
          },
        },
      },
    );

    if (!workspaceMember && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    if (!isOrgAdmin && task.project.nature === ProjectNature.PRIVATE) {
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

    const taskWithDetails = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: {
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
      message: 'Task fetched successfully',
      task: taskWithDetails,
    };
  }
}
