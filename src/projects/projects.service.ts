import {
  BadRequestException,
  ForbiddenException,
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
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddProjectMemberDto } from './dto/add-member.schema';
import { CreateProjectDto } from './dto/create-project.schema';
import { UpdateProjectDto } from './dto/update-project.schema';
import {
  ProjectOverview,
  ProjectTaskStatusCount,
  ProjectVelocity,
} from './interfaces/project-overview.interface';

@Injectable()
export class ProjectsService {
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

  async createProject(
    workspaceId: string,
    data: CreateProjectDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const isOrgAdmin = await this.isOrgAdmin(workspace.organizationId, userId);

    const member = await this.prismaService.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    const { name, description, nature } = data;

    const existingProject = await this.prismaService.project.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name,
        },
      },
    });

    if (existingProject) {
      throw new BadRequestException('Project with this name already exists');
    }

    return this.prismaService.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name,
          description,
          nature,
          workspaceId,
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId,
          role: ProjectRole.OWNER,
        },
      });

      await this.auditLogsService.createLog({
        action: AuditAction.PROJECT_CREATE,
        entityType: AuditEntityType.PROJECT,
        entityId: project.id,
        organizationId: workspace.organizationId,
        workspaceId,
        userId,
        details: { name: project.name, nature: project.nature },
        ipAddress: req.ip as string,
        userAgent: req.headers['user-agent'] as string,
      });

      return {
        success: true,
        message: 'Project created successfully',
        project,
      };
    });
  }

  async getProjects(workspaceId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        organization: {
          include: {
            members: {
              where: {
                userId,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    const isOrgAdminOrOwner =
      workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(workspace.organization.members[0].role);

    const member = await this.prismaService.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member && !isOrgAdminOrOwner) {
      throw new UnauthorizedException('You are not a member of this workspace');
    }

    const projects = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        ...(!isOrgAdminOrOwner && {
          OR: [
            {
              members: {
                some: {
                  userId,
                },
              },
            },
            {
              nature: ProjectNature.PUBLIC,
            },
          ],
        }),
      },
    });

    return {
      success: true,
      message: 'Projects fetched successfully',
      projects,
    };
  }

  async getProjectById(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: {
          include: {
            organization: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
        members: true,
      },
    });

    const user = project?.members.find(
      (member) => member.userId === req.user?.id,
    );

    const sanitizedProject = {
      ...project,
      role: user?.role,
    };

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgAdmin =
      project.workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(
        project.workspace.organization.members[0].role,
      );

    const member = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!member && project.nature !== ProjectNature.PUBLIC && !isOrgAdmin) {
      throw new UnauthorizedException('You are not a member of this project');
    }

    return {
      success: true,
      message: 'Project fetched successfully',
      project: sanitizedProject,
    };
  }

  async updateProject(projectId: string, data: UpdateProjectDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: {
        workspace: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

    const userRole = project.members[0]?.role;
    if (!isOrgAdmin && (!userRole || !['OWNER', 'ADMIN'].includes(userRole))) {
      throw new ForbiddenException(
        'Only project owner/admin or organization owner/admin can update project.',
      );
    }

    const { name, description, nature, status } = data;

    if (name && name !== project.name) {
      const existingProject = await this.prismaService.project.findFirst({
        where: {
          workspaceId: project.workspaceId,
          name,
          NOT: { id: projectId },
        },
      });
      if (existingProject) {
        throw new BadRequestException('Project with this name already exists');
      }
    }

    const updatedProject = await this.prismaService.project.update({
      where: { id: projectId },
      data: {
        name,
        description,
        nature,
        status,
      },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.PROJECT_UPDATE,
      entityType: AuditEntityType.PROJECT,
      entityId: projectId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { name, description, nature, status },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Project updated successfully',
      project: updatedProject,
    };
  }

  async getProjectMembers(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
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

    // If not an org admin, and project is private, check if user is a project member
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
        throw new UnauthorizedException('You are not a member of this project');
      }
    }

    const members = await this.prismaService.projectMember.findMany({
      where: {
        projectId,
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
      message: 'Project members fetched successfully',
      members,
    };
  }

  async deleteProject(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

    if (isOrgAdmin) {
      // Allow deletion
    } else if (project.nature === ProjectNature.PRIVATE) {
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
      if (
        projectMember.role !== ProjectRole.OWNER &&
        projectMember.role !== ProjectRole.ADMIN
      ) {
        throw new ForbiddenException(
          'You are not allowed to delete this project',
        );
      }
    } else if (project.nature === ProjectNature.PUBLIC) {
      const workspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId,
              workspaceId: project.workspaceId,
            },
          },
        });
      if (!workspaceMember) {
        throw new UnauthorizedException(
          'You are not a member of this workspace',
        );
      }
      if (
        workspaceMember.role !== ProjectRole.OWNER &&
        workspaceMember.role !== ProjectRole.ADMIN
      ) {
        throw new ForbiddenException(
          'You are not allowed to delete this project',
        );
      }
    }

    await this.prismaService.project.delete({
      where: { id: projectId },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.PROJECT_DELETE,
      entityType: AuditEntityType.PROJECT,
      entityId: projectId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { name: project.name },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Project deleted successfully',
    };
  }

  async addProjectMember(
    projectId: string,
    data: AddProjectMemberDto,
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

    const { userId: targetUserId, role } = data;

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: {
            userId: targetUserId,
            workspaceId: project.workspaceId,
          },
        },
        include: { workspace: true },
      },
    );

    if (!workspaceMember) {
      throw new BadRequestException('User is not a member of this workspace');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      workspaceMember.workspace.organizationId,
      userId,
    );

    if (!isOrgAdmin) {
      // Check if project admin/owner
      const requester = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
        throw new UnauthorizedException(
          'Only project owner/admin or organization owner/admin can add members.',
        );
      }
    }

    const existingMember = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this project');
    }

    const member = await this.prismaService.projectMember.create({
      data: {
        projectId,
        userId: targetUserId,
        role,
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

    await this.auditLogsService.createLog({
      action: AuditAction.PROJECT_MEMBER_ADD,
      entityType: AuditEntityType.PROJECT_MEMBER,
      entityId: targetUserId,
      organizationId: workspaceMember.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { addedUserId: targetUserId, role },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member added to project successfully',
      member,
    };
  }

  async removeProjectMember(
    projectId: string,
    targetUserId: string,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgAdmin = await this.isOrgAdmin(
      project.workspace.organizationId,
      userId,
    );

    if (!isOrgAdmin) {
      // Check if the user making the request has permission (OWNER or ADMIN)
      const requester = await this.prismaService.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!requester || !['OWNER', 'ADMIN'].includes(requester.role)) {
        // Also allow if it's the user removing themselves
        if (userId !== targetUserId) {
          throw new ForbiddenException(
            'Only project owner/admin or organization owner/admin can remove members.',
          );
        }
      }
    }

    // Cannot remove the owner of the project
    const memberToRemove = await this.prismaService.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!memberToRemove) {
      throw new NotFoundException('Member not found in this project');
    }

    if (memberToRemove.role === 'OWNER') {
      throw new BadRequestException('Cannot remove the project owner');
    }

    await this.prismaService.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.PROJECT_MEMBER_REMOVE,
      entityType: AuditEntityType.PROJECT_MEMBER,
      entityId: targetUserId,
      organizationId: project.workspace.organizationId,
      workspaceId: project.workspaceId,
      userId,
      details: { removedUserId: targetUserId, role: memberToRemove.role },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member removed from project successfully',
    };
  }

  async projectOverview(projectId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const project = await this.prismaService.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
        nature: true,
        name: true,
        description: true,
        status: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          include: { members: { where: { userId } } },
        },
        members: { where: { userId } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isWorkspaceAdmin =
      project.workspace.members[0].role === WorkspaceRole.ADMIN ||
      project.workspace.members[0].role === WorkspaceRole.OWNER;

    const isProjectAdmin =
      project.members[0].role === ProjectRole.ADMIN ||
      project.members[0].role === ProjectRole.OWNER;

    const isProjectMember = project.members[0].userId === userId;

    if (
      project.nature !== ProjectNature.PUBLIC &&
      !isWorkspaceAdmin &&
      !isProjectMember
    ) {
      throw new UnauthorizedException('You are not a member of this project');
    }

    const membersCount = await this.prismaService.projectMember.count({
      where: {
        projectId,
      },
    });

    const overview: ProjectOverview = {
      id: project.id,
      name: project.name,
      description: project.description || '',
      nature: project.nature,
      status: project.status,
      ownerId: project.ownerId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      membersCount,
    };

    if (isWorkspaceAdmin || isProjectAdmin) {
      overview.velocity = await this.calculateProjectVelocity(projectId);
    }
    overview.taskStatusCount = await this.getTaskStatusCount(projectId);

    return {
      success: true,
      message: 'Project overview fetched successfully',
      overview,
    };
  }

  private async calculateProjectVelocity(
    projectId: string,
  ): Promise<ProjectVelocity> {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);

    const tasks = await this.prismaService.task.findMany({
      where: { projectId },
      select: {
        status: true,
        completedAt: true,
      },
    });
    const totalTasks = tasks.length;

    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.DONE,
    ).length;

    const completionRate =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    const last7Days: { date: string; completed: number }[] = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(sevenDaysAgo);
      day.setDate(sevenDaysAgo.getDate() + i);

      day.setHours(0, 0, 0, 0);

      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const completed = tasks.filter(
        (t) =>
          t.completedAt &&
          t.completedAt >= day &&
          t.completedAt < nextDay &&
          t.status === TaskStatus.DONE,
      ).length;

      last7Days.push({
        date: day.toLocaleDateString('en-CA'),
        completed,
      });
    }

    const weeklyCompleted = last7Days.reduce(
      (sum, day) => sum + day.completed,
      0,
    );
    return {
      completionRate,
      last7Days,
      weeklyCompleted,
    };
  }

  private async getTaskStatusCount(
    projectId: string,
  ): Promise<ProjectTaskStatusCount> {
    const [
      totalTasks,
      todoTasks,
      inProgressTasks,
      inReviewTasks,
      completedTasks,
      blockedTasks,
      canceledTasks,
      onHoldTasks,
    ] = await Promise.all([
      this.prismaService.task.count({
        where: { projectId },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.TODO },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.IN_PROGRESS },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.IN_REVIEW },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.DONE },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.BLOCKED },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.CANCELED },
      }),
      this.prismaService.task.count({
        where: { projectId, status: TaskStatus.ON_HOLD },
      }),
    ]);

    return {
      total: totalTasks,
      todo: todoTasks,
      inProgress: inProgressTasks,
      inReview: inReviewTasks,
      done: completedTasks,
      blocked: blockedTasks,
      canceled: canceledTasks,
      onHold: onHoldTasks,
    };
  }
}
