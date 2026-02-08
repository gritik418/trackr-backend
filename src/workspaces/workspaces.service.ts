import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.schema';
import { Request } from 'express';
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
        members: { include: { user: true } },
      },
    });
    const sanitizedWorkspaces = workspaces.map((w) => {
      const user = w.members.find((member) => member.userId === req.user?.id);
      return {
        ...w,
        role: user?.role,
        owner: sanitizeUser(w.owner),
        members: w.members.map((m) => ({ ...m, user: sanitizeUser(m.user) })),
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
        members: { include: { user: true } },
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const sanitizedWorkspace = {
      ...workspace,
      members: workspace.members.map((m) => ({
        ...m,
        user: sanitizeUser(m.user),
      })),
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
        members: { include: { user: true } },
        organization: true,
      },
    });

    if (!workspace) throw new NotFoundException('Workspace not found.');

    const sanitizedWorkspace = {
      ...workspace,
      members: workspace.members.map((m) => ({
        ...m,
        user: sanitizeUser(m.user),
      })),
      owner: sanitizeUser(workspace.owner),
    };

    return {
      success: true,
      message: 'Workspace retrieved successfully.',
      workspace: sanitizedWorkspace,
    };
  }

  async getWorkspaceMembers(orgId: string, workspaceId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required.');
    if (!workspaceId)
      throw new BadRequestException('Workspace ID is required.');

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId,
        organizationId: orgId,
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
}
