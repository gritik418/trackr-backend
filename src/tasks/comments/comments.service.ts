import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ProjectNature, ProjectRole } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.schema';
import { UpdateCommentDto } from './dto/update-comment.schema';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createComment(taskId: string, data: CreateCommentDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const projectId = task?.projectId;

    if (!projectId) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
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

    const response = {
      success: true,
      message: 'Comment added successfully',
      comment,
    };

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_COMMENT_CREATE,
      entityType: AuditEntityType.COMMENT,
      entityId: comment.id,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { taskId, content: data.content },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return response;
  }

  async getComments(taskId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const projectId = task.projectId;
    if (!projectId) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
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

    const response = {
      success: true,
      message: 'Comment updated successfully',
      comment: updatedComment,
    };

    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { workspace: true } } },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_COMMENT_UPDATE,
      entityType: AuditEntityType.COMMENT,
      entityId: commentId,
      organizationId: task?.project?.workspace?.organizationId,
      workspaceId: task?.project?.workspaceId,
      userId,
      details: { taskId, content: data.content },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return response;
  }

  async deleteComment(taskId: string, commentId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    const task = await this.prismaService.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const projectId = task.projectId;
    if (!projectId) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const comment = await this.prismaService.taskComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.taskId !== taskId) {
      throw new BadRequestException('Comment does not belong to this task');
    }

    const projectMember = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    const isAuthor = comment.userId === userId;
    const isModerator =
      projectMember &&
      (projectMember.role === ProjectRole.OWNER ||
        projectMember.role === ProjectRole.ADMIN);

    if (!isAuthor && !isModerator) {
      throw new UnauthorizedException(
        'You are not authorized to delete this comment',
      );
    }

    await this.prismaService.taskComment.delete({
      where: { id: commentId },
    });

    const response = {
      success: true,
      message: 'Comment deleted successfully',
    };

    await this.auditLogsService.createLog({
      action: AuditAction.TASK_COMMENT_DELETE,
      entityType: AuditEntityType.COMMENT,
      entityId: commentId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { taskId },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return response;
  }
}
