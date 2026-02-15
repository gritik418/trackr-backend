import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.schema';
import { UpdateWorkspaceDto } from './dto/update-workspace.schema';
import { AddMemberDto } from './dto/add-member.schema';
import { UpdateMemberRoleDto } from './dto/update-member-role.schema';
import { Request } from 'express';
import { GetTasksDto } from 'src/tasks/dto/get-tasks.schema';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';

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

    const sanitizedWorkspace = {
      ...workspace,
      owner: sanitizeUser(workspace.owner),
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
              select: { role: true },
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

    const sanitizedWorkspace = {
      ...workspace,
      owner: sanitizeUser(workspace.owner),
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

  async getMyTasks(workspaceId: string, query: GetTasksDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const { status, priority, tag } = query;

    const tasks = await this.prismaService.task.findMany({
      where: {
        workspaceId,
        status,
        priority,
        tag,
        assignees: { some: { id: req.user.id } },
      },
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
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'My tasks retrieved successfully.',
      tasks,
    };
  }
}
