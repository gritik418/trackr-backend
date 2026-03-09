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
  TaskStatus,
  WorkspaceRole,
} from 'generated/prisma/enums';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  GetMyTasksDto,
  TaskPriorityWithAll,
  TaskStatusWithAll,
} from 'src/workspaces/dto/get-my-tasks.schema';
import { AddMemberDto } from './dto/add-member.schema';
import { CreateWorkspaceDto } from './dto/create-workspace.schema';
import { UpdateMemberRoleDto } from './dto/update-member-role.schema';
import { UpdateWorkspaceDto } from './dto/update-workspace.schema';
import { WorkspaceOverview } from './interfaces/workspace-overview.interface';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private async isOrgAdminOrOwner(
    orgId: string,
    userId: string,
  ): Promise<boolean> {
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

  async createWorkspace(orgId: string, data: CreateWorkspaceDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { name, slug, description, iconUrl } = data;

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          where: { userId: req.user.id },
          select: { role: true },
        },
      },
    });

    if (!organization) throw new BadRequestException('Organization not found.');

    if (!organization.members.length)
      throw new UnauthorizedException(
        'You are not a member of this organization.',
      );

    if (!['OWNER', 'ADMIN'].includes(organization.members[0].role))
      throw new UnauthorizedException(
        'Only org owner/admin can create workspace.',
      );

    const existingSlug = await this.prismaService.workspace.findFirst({
      where: {
        slug,
      },
    });

    if (existingSlug) throw new BadRequestException('Slug is already in use.');

    const existingName = await this.prismaService.workspace.findFirst({
      where: {
        name,
        organizationId: orgId,
      },
    });
    if (existingName)
      throw new BadRequestException(
        'You have used the same name for another workspace.',
      );

    const workspace = await this.prismaService.workspace.create({
      data: {
        name,
        slug,
        description,
        iconUrl: iconUrl || '',
        organizationId: orgId,
        ownerId: req.user.id,
        members: {
          create: {
            userId: req.user.id,
            role: 'OWNER',
          },
        },
      },
      include: { members: { include: { user: true } }, owner: true },
    });

    const workspaceSanitized = {
      ...workspace,
      owner: sanitizeUser(workspace.owner),
      members: workspace.members.map((m) => ({
        ...m,
        user: sanitizeUser(m.user),
      })),
    };

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_CREATE,
      entityType: AuditEntityType.WORKSPACE,
      entityId: workspace.id,
      organizationId: orgId,
      workspaceId: workspace.id,
      userId: req.user.id,
      details: { name: workspace.name, slug: workspace.slug },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Workspace created successfully.',
      workspace: workspaceSanitized,
    };
  }

  async getWorkspaces(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required.');

    const orgMember = await this.prismaService.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: req.user.id,
      },
    });

    if (!orgMember)
      throw new UnauthorizedException('Not a member of this organization.');

    const userOrgRole = orgMember.role;

    if (userOrgRole === 'OWNER' || userOrgRole === 'ADMIN') {
      const workspaces = await this.prismaService.workspace.findMany({
        where: {
          organizationId: orgId,
        },
        include: {
          owner: true,
          members: true,
          projects: { select: { name: true } },
        },
      });
      const sanitizedWorkspaces = workspaces.map((w) => {
        const user = w.members.find((member) => member.userId === req.user?.id);
        return {
          ...w,
          role: user?.role,
          owner: sanitizeUser(w.owner),
        };
      });

      return {
        success: true,
        message: 'Workspaces retrieved successfully.',
        workspaces: sanitizedWorkspaces,
      };
    }
    const workspaces = await this.prismaService.workspace.findMany({
      where: {
        organizationId: orgId,
        members: { some: { userId: req.user.id } },
      },
      include: {
        owner: true,
        members: true,
        projects: { select: { name: true } },
      },
    });
    const sanitizedWorkspaces = workspaces.map((w) => {
      const user = w.members.find((member) => member.userId === req.user?.id);
      return {
        ...w,
        role: user?.role,
        owner: sanitizeUser(w.owner),
      };
    });

    return {
      success: true,
      message: 'Workspaces retrieved successfully.',
      workspaces: sanitizedWorkspaces,
    };
  }

  async getWorkspaceById(orgId: string, workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required.');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const isOrgAdmin = await this.isOrgAdminOrOwner(orgId, req.user.id);

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
        organizationId: orgId,
        ...(!isOrgAdmin && { members: { some: { userId: req.user.id } } }),
      },
      include: {
        owner: true,
        members: true,
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const user = workspace.members.find(
      (member) => member.userId === req.user?.id,
    );

    const sanitizedWorkspace = {
      ...workspace,
      owner: sanitizeUser(workspace.owner),
      role: user?.role,
    };

    return {
      success: true,
      message: 'Workspace retrieved successfully.',
      workspace: sanitizedWorkspace,
    };
  }

  async getWorkspaceBySlug(slug: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!slug) throw new BadRequestException('Workspace slug is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        slug,
      },
      include: {
        owner: true,
        members: true,
        organization: {
          include: {
            members: {
              where: { userId: req.user.id },
              select: { role: true, userId: true },
            },
          },
        },
        projects: { select: { name: true } },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const isOrgAdmin =
      workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(workspace.organization.members[0].role);

    const isWorkspaceMember = workspace.members.some(
      (m) => m.userId === req.user?.id,
    );

    if (!isOrgAdmin && !isWorkspaceMember) {
      throw new NotFoundException('Workspace not found.');
    }

    const user = workspace.members.find(
      (member) => member.userId === req.user?.id,
    );

    const organizationMember = workspace.organization.members.find(
      (member) => member.userId === req.user?.id,
    );

    if (!organizationMember) {
      throw new NotFoundException('Organization not found.');
    }

    const sanitizedWorkspace = {
      ...workspace,
      owner: sanitizeUser(workspace.owner),
      role: user?.role,
      organizationRole: organizationMember?.role,
    };

    return {
      success: true,
      message: 'Workspace retrieved successfully.',
      workspace: sanitizedWorkspace,
    };
  }

  async getWorkspaceMembers(workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        organization: {
          include: {
            members: {
              where: { userId: req.user.id },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const isOrgAdmin =
      workspace.organization.members.length > 0 &&
      ['OWNER', 'ADMIN'].includes(workspace.organization.members[0].role);

    const isWorkspaceMember = workspace.members.some(
      (m) => m.userId === req.user?.id,
    );

    if (!isOrgAdmin && !isWorkspaceMember) {
      throw new NotFoundException('Workspace not found.');
    }

    const sanitizedMembers = workspace.members.map((m) => ({
      ...m,
      user: sanitizeUser(m.user),
    }));

    return {
      success: true,
      message: 'Workspace members retrieved successfully.',
      members: sanitizedMembers,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    data: UpdateWorkspaceDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: req.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const isOrgAdmin = await this.isOrgAdminOrOwner(
      workspace.organizationId,
      req.user.id,
    );

    const userRole = workspace.members[0]?.role;
    if (!isOrgAdmin && (!userRole || !['OWNER', 'ADMIN'].includes(userRole))) {
      throw new UnauthorizedException(
        'Only workspace owner/admin or organization owner/admin can update workspace.',
      );
    }

    const { name, slug, description, iconUrl } = data;

    if (slug && slug !== workspace.slug) {
      const existingSlug = await this.prismaService.workspace.findFirst({
        where: { slug },
      });
      if (existingSlug)
        throw new BadRequestException('Slug is already in use.');
    }

    if (name && name !== workspace.name) {
      const existingName = await this.prismaService.workspace.findFirst({
        where: {
          name,
          organizationId: workspace.organizationId,
        },
      });
      if (existingName)
        throw new BadRequestException(
          'You have used the same name for another workspace.',
        );
    }

    const updatedWorkspace = await this.prismaService.workspace.update({
      where: { id: workspaceId },
      data: {
        name,
        slug,
        description,
        iconUrl,
      },
      include: {
        owner: true,
        members: true,
      },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_UPDATE,
      entityType: AuditEntityType.WORKSPACE,
      entityId: workspaceId,
      organizationId: updatedWorkspace.organizationId,
      workspaceId: workspaceId,
      userId: req.user.id,
      details: { name, slug, description, iconUrl },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Workspace updated successfully.',
      workspace: {
        ...updatedWorkspace,
        owner: sanitizeUser(updatedWorkspace.owner),
      },
    };
  }

  async deleteWorkspace(workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          where: { userId: req.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const isOrgAdmin = await this.isOrgAdminOrOwner(
      workspace.organizationId,
      req.user.id,
    );

    const userRole = workspace.members[0]?.role;
    if (!isOrgAdmin && userRole !== 'OWNER' && userRole !== 'ADMIN') {
      throw new UnauthorizedException(
        'Only the workspace owner/admin or organization owner/admin can delete the workspace.',
      );
    }

    await this.prismaService.workspace.delete({
      where: { id: workspaceId },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_DELETE,
      entityType: AuditEntityType.WORKSPACE,
      entityId: workspaceId,
      organizationId: workspace.organizationId,
      workspaceId: workspaceId,
      userId: req.user.id,
      details: { name: workspace.name },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Workspace deleted successfully.',
    };
  }

  async addWorkspaceMember(
    workspaceId: string,
    data: AddMemberDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { email, role } = data;

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: { organization: true },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) throw new NotFoundException('User not found.');

    const orgMember = await this.prismaService.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: workspace.organizationId,
        },
      },
    });

    const isRequesterOrgAdmin = await this.isOrgAdminOrOwner(
      workspace.organizationId,
      req.user.id,
    );

    if (!isRequesterOrgAdmin) {
      const requesterWorkspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: req.user.id, workspaceId },
          },
          select: { role: true },
        });

      if (
        !requesterWorkspaceMember ||
        !['OWNER', 'ADMIN'].includes(requesterWorkspaceMember.role)
      ) {
        throw new UnauthorizedException(
          'Only workspace owner/admin or organization owner/admin can add members.',
        );
      }
    }

    if (!orgMember) {
      throw new BadRequestException(
        'User must be a member of the organization first.',
      );
    }

    const existingWorkspaceMember =
      await this.prismaService.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId,
          },
        },
      });

    if (existingWorkspaceMember) {
      throw new BadRequestException(
        'User is already a member of this workspace.',
      );
    }

    await this.prismaService.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId,
        role,
      },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_MEMBER_ADD,
      entityType: AuditEntityType.WORKSPACE_MEMBER,
      entityId: user.id,
      organizationId: workspace.organizationId,
      workspaceId: workspaceId,
      userId: req.user.id,
      details: { addedUserId: user.id, role },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member added to workspace successfully.',
    };
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    memberId: string,
    data: UpdateMemberRoleDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { role } = data;

    const member = await this.prismaService.workspaceMember.findUnique({
      where: { id: memberId },
      include: { workspace: true },
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Workspace member not found.');
    }

    const isRequesterOrgAdmin = await this.isOrgAdminOrOwner(
      member.workspace.organizationId,
      req.user.id,
    );

    if (!isRequesterOrgAdmin) {
      const requesterWorkspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: req.user.id, workspaceId },
          },
          select: { role: true },
        });

      if (
        !requesterWorkspaceMember ||
        !['OWNER', 'ADMIN'].includes(requesterWorkspaceMember.role)
      ) {
        throw new UnauthorizedException(
          'Only workspace owner/admin or organization owner/admin can update member roles.',
        );
      }
    }

    if (member.role === 'OWNER' && role !== 'OWNER') {
      const ownersCount = await this.prismaService.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException(
          'Workspace must have at least one owner.',
        );
      }
    }

    await this.prismaService.workspaceMember.update({
      where: { id: memberId },
      data: { role },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_MEMBER_ROLE_UPDATE,
      entityType: AuditEntityType.WORKSPACE_MEMBER,
      entityId: memberId,
      organizationId: member.workspace.organizationId,
      workspaceId: workspaceId,
      userId: req.user.id,
      details: {
        previousRole: member.role,
        newRole: role,
        targetUserId: member.userId,
      },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member role updated successfully.',
    };
  }

  async removeWorkspaceMember(
    workspaceId: string,
    memberId: string,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const member = await this.prismaService.workspaceMember.findUnique({
      where: { id: memberId },
      include: { workspace: true },
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Workspace member not found.');
    }

    const isRequesterOrgAdmin = await this.isOrgAdminOrOwner(
      member.workspace.organizationId,
      req.user.id,
    );

    if (!isRequesterOrgAdmin) {
      const requesterWorkspaceMember =
        await this.prismaService.workspaceMember.findUnique({
          where: {
            userId_workspaceId: { userId: req.user.id, workspaceId },
          },
          select: { role: true },
        });

      if (
        !requesterWorkspaceMember ||
        !['OWNER', 'ADMIN'].includes(requesterWorkspaceMember.role)
      ) {
        throw new UnauthorizedException(
          'Only workspace owner/admin or organization owner/admin can remove members.',
        );
      }
    }

    if (member.role === 'OWNER') {
      const ownersCount = await this.prismaService.workspaceMember.count({
        where: { workspaceId, role: 'OWNER' },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException(
          'Workspace must have at least one owner.',
        );
      }
    }

    await this.prismaService.workspaceMember.delete({
      where: { id: memberId },
    });

    await this.auditLogsService.createLog({
      action: AuditAction.WORKSPACE_MEMBER_REMOVE,
      entityType: AuditEntityType.WORKSPACE_MEMBER,
      entityId: memberId,
      organizationId: member.workspace.organizationId,
      workspaceId: workspaceId,
      userId: req.user.id,
      details: { removedUserId: member.userId, role: member.role },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member removed from workspace successfully.',
    };
  }

  async getMyTasks(workspaceId: string, query: GetMyTasksDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const {
      statuses,
      priorities,
      tag,
      limit,
      page,
      search,
      sortBy,
      sortOrder,
      projectIds,
    } = query;

    const where: Record<string, any> = {
      workspaceId,
      assignees: { some: { id: req.user.id } },
    };

    if (
      statuses &&
      statuses.length > 0 &&
      !statuses.includes(TaskStatusWithAll.ALL)
    ) {
      where.status = { in: statuses };
    }

    if (
      priorities &&
      priorities.length > 0 &&
      !priorities.includes(TaskPriorityWithAll.ALL)
    ) {
      where.priority = { in: priorities };
    }
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
    if (projectIds && projectIds.length > 0) {
      where.projectId = { in: projectIds };
    }
    if (tag) where.tag = tag;

    const orderBy: Record<string, any> = {};

    if (sortBy) {
      orderBy[sortBy] = sortOrder ? sortOrder : 'asc';
    }

    const projects = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        members: { some: { userId: req.user.id } },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const total = await this.prismaService.task.count({ where });

    const tasks = await this.prismaService.task.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      include: {
        project: true,
        assignees: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: orderBy || { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'My tasks retrieved successfully.',
      tasks,
      projects,
      statuses: Object.values(TaskStatusWithAll),
      priorities: Object.values(TaskPriorityWithAll),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWorkspaceTasks(
    workspaceId: string,
    query: GetMyTasksDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const {
      statuses,
      priorities,
      tag,
      limit,
      page,
      search,
      sortBy,
      sortOrder,
      projectIds,
    } = query;

    const where: Record<string, any> = {
      workspaceId,
    };

    if (
      statuses &&
      statuses.length > 0 &&
      !statuses.includes(TaskStatusWithAll.ALL)
    ) {
      where.status = { in: statuses };
    }

    if (
      priorities &&
      priorities.length > 0 &&
      !priorities.includes(TaskPriorityWithAll.ALL)
    ) {
      where.priority = { in: priorities };
    }
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
    if (projectIds && projectIds.length > 0) {
      where.projectId = { in: projectIds };
    }
    if (tag) where.tag = tag;

    const orderBy: Record<string, any> = {};

    if (sortBy) {
      orderBy[sortBy] = sortOrder ? sortOrder : 'asc';
    }

    const projects = await this.prismaService.project.findMany({
      where: {
        workspaceId,
        members: { some: { userId: req.user.id } },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const total = await this.prismaService.task.count({ where });

    const tasks = await this.prismaService.task.findMany({
      where,
      take: limit,
      skip: (page - 1) * limit,
      include: {
        project: true,
        assignees: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: orderBy || { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Workspace tasks retrieved successfully.',
      tasks,
      projects,
      statuses: Object.values(TaskStatusWithAll),
      priorities: Object.values(TaskPriorityWithAll),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getWorkspaceOverview(workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found.');
    }

    const organizationMember =
      await this.prismaService.organizationMember.findFirst({
        where: {
          organizationId: workspace.organizationId,
          userId: req.user.id,
        },
        select: {
          role: true,
        },
      });

    const workspaceMember = await this.prismaService.workspaceMember.findUnique(
      {
        where: {
          userId_workspaceId: { userId: req.user.id, workspaceId },
        },
        select: {
          role: true,
        },
      },
    );

    if (!workspaceMember && !organizationMember) {
      throw new ForbiddenException(
        'You are not authorized to access this route.',
      );
    }

    if (
      workspaceMember?.role !== WorkspaceRole.OWNER &&
      workspaceMember?.role !== WorkspaceRole.ADMIN &&
      organizationMember?.role !== WorkspaceRole.OWNER &&
      organizationMember?.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You are not authorized to access this route.',
      );
    }

    const projects = await this.prismaService.project.findMany({
      where: {
        workspaceId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last14Days = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      membersCount,
      projectsCount,
      totalTasksCount,
      completedTasksCount,
      groupedTasks,
      recentTasks,
    ] = await Promise.all([
      this.prismaService.workspaceMember.count({
        where: { workspaceId },
      }),
      this.prismaService.project.count({
        where: { workspaceId },
      }),
      this.prismaService.task.count({
        where: { workspaceId },
      }),
      this.prismaService.task.count({
        where: { workspaceId, status: TaskStatus.DONE },
      }),
      this.prismaService.task.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: { _all: true },
      }),
      this.prismaService.task.findMany({
        where: {
          workspaceId,
          OR: [
            { createdAt: { gte: last30Days } },
            { completedAt: { gte: last30Days } },
          ],
        },
        select: {
          createdAt: true,
          completedAt: true,
          status: true,
        },
      }),
    ]);

    // Velocity Calculations
    const tasksCompletedLast7Days = recentTasks.filter(
      (t) => t.completedAt && t.completedAt >= last7Days,
    ).length;
    const tasksCompletedLast14Days = recentTasks.filter(
      (t) => t.completedAt && t.completedAt >= last14Days,
    ).length;
    const tasksCompletedLast30Days = recentTasks.filter(
      (t) => t.completedAt && t.completedAt >= last30Days,
    ).length;

    const completionRate =
      totalTasksCount === 0 ? 0 : (completedTasksCount / totalTasksCount) * 100;

    // Graph Data Preparation
    const dayMap: Record<string, { created: number; completed: number }> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      dayMap[date] = { created: 0, completed: 0 };
    }

    recentTasks.forEach((task) => {
      const createdDate = task.createdAt.toISOString().split('T')[0];
      if (dayMap[createdDate]) {
        dayMap[createdDate].created += 1;
      }
      if (task.completedAt) {
        const completedDate = task.completedAt.toISOString().split('T')[0];
        if (dayMap[completedDate]) {
          dayMap[completedDate].completed += 1;
        }
      }
    });

    const graphData = Object.entries(dayMap)
      .map(([date, counts]) => ({
        date,
        ...counts,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Ensure all statuses are present in the distribution
    const statusMap = groupedTasks.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    const taskStatusDistribution = Object.values(TaskStatus).map((status) => ({
      status,
      count: statusMap[status] || 0,
    }));

    return {
      success: true,
      message: 'Workspace overview retrieved successfully.',
      overview: {
        workspaceId,
        projectsCount,
        membersCount,
        tasks: taskStatusDistribution,
        completionRate,
        velocity: {
          tasksCompletedLast7Days,
          tasksCompletedLast14Days,
          tasksCompletedLast30Days,
          avgTasksPerDay: tasksCompletedLast30Days / 30,
        },
        graphs: {
          taskStatusDistribution,
          tasksCompletedOverTime: graphData.map((gd) => ({
            date: gd.date,
            count: gd.completed,
          })),
          tasksCreatedVsCompleted: graphData,
        },
      },
    };
  }
}
