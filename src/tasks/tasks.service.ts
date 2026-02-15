import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';
import { AssignTaskDto } from './dto/assign-task.schema';
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

    const task = await this.prismaService.task.create({
      data: {
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

    const { status, priority, assignedToId, tag } = query;

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
      where: {
        projectId,
        status,
        priority,
        tag,
        assignees: assignedToId
          ? {
              some: {
                id: assignedToId,
              },
            }
          : undefined,
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
      categoryId,
      tag,
      assignedToIds,
    } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
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

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        status,
        priority,
        deadline,
        categoryId,
        tag,
        assignees: assignedToIds
          ? {
              set: assignedToIds.map((id) => ({ id })),
            }
          : undefined,
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
      details: { title, status, priority, tag },
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

    const { userId: assigneeId } = data;

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
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

        const assigneeMember =
          await this.prismaService.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: assigneeId,
                workspaceId: project.workspaceId,
              },
            },
          });

        if (!assigneeMember) {
          throw new BadRequestException(
            'Assignee is not a member of this workspace',
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
            'You are not authorized to assign tasks in this project',
          );
        }

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
            'Assignee is not a member of this project',
          );
        }
      }
    }

    const updatedTask = await this.prismaService.task.update({
      where: { id: taskId },
      data: {
        assignees: {
          connect: { id: assigneeId },
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
      details: { assigneeId },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Task assigned successfully',
      task: updatedTask,
    };
  }

  async getMyTasks(projectId: string, query: GetTasksDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const { status, priority, tag } = query;

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
      where: {
        projectId,
        status,
        priority,
        tag,
        assignees: {
          some: {
            id: userId,
          },
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
