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

@Injectable()
export class WorkspacesService {
  constructor(private readonly prismaService: PrismaService) {}

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

    return {
      success: true,
      message: 'Workspace created successfully.',
      workspace: workspaceSanitized,
    };
  }

  async getWorkspaces(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required.');

    const workspaces = await this.prismaService.workspace.findMany({
      where: {
        organizationId: orgId,
        members: { some: { userId: req.user.id } },
      },
      include: {
        owner: true,
        members: true,
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

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
        organizationId: orgId,
        members: { some: { userId: req.user.id } },
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
        members: { some: { userId: req.user.id } },
      },
      include: {
        owner: true,
        members: true,
        organization: true,
        projects: true,
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

  async getWorkspaceMembers(workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
        members: { some: { userId: req.user.id } },
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

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

    const userRole = workspace.members[0]?.role;
    if (!userRole || !['OWNER', 'ADMIN'].includes(userRole)) {
      throw new UnauthorizedException(
        'Only workspace owner/admin can update workspace.',
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
      where: { id: workspaceId, members: { some: { userId: req.user.id } } },
      include: {
        members: {
          where: { userId: req.user.id },
          select: { role: true },
        },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const userRole = workspace.members[0]?.role;
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      throw new UnauthorizedException(
        'Only the workspace owner/admin can delete the workspace.',
      );
    }

    await this.prismaService.workspace.delete({
      where: { id: workspaceId },
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
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Workspace member not found.');
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
    });

    if (!member || member.workspaceId !== workspaceId) {
      throw new NotFoundException('Workspace member not found.');
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

    return {
      success: true,
      message: 'Member removed from workspace successfully.',
    };
  }

  async getMyTasks(workspaceId: string, query: GetTasksDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const { status, priority } = query;

    const tasks = await this.prismaService.task.findMany({
      where: {
        workspaceId,
        status,
        priority,
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
