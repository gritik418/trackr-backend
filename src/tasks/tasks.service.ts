import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { AssignTaskDto } from './dto/assign-task.schema';
import { CreateTaskDto } from './dto/create-task.schema';
import { GetTasksDto } from './dto/get-tasks.schema';
import { UpdateTaskDto } from './dto/update-task.schema';
import { CreateCommentDto } from './dto/create-comment.schema';
import { UpdateCommentDto } from './dto/update-comment.schema';
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
      tag,
      assignedToIds,
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

    if (project.nature === ProjectNature.PUBLIC) {
      if (workspaceMember.role === WorkspaceRole.MEMBER) {
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

  async createComment(
    projectId: string,
    taskId: string,
    data: CreateCommentDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

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

    const comment = await this.prismaService.taskComment.create({
      data: {
        taskId,
        userId,
        content: data.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Comment added successfully',
      comment,
    };
  }

  async getComments(projectId: string, taskId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

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

    const comments = await this.prismaService.taskComment.findMany({
      where: {
        taskId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return {
      success: true,
      message: 'Comments fetched successfully',
      comments,
    };
  }

  async updateComment(
    projectId: string,
    taskId: string,
    commentId: string,
    data: UpdateCommentDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const comment = await this.prismaService.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new UnauthorizedException('You can only update your own comments');
    }

    if (comment.taskId !== taskId) {
      throw new BadRequestException('Comment does not belong to this task');
    }

    const updatedComment = await this.prismaService.taskComment.update({
      where: { id: commentId },
      data: {
        content: data.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Comment updated successfully',
      comment: updatedComment,
    };
  }
}
