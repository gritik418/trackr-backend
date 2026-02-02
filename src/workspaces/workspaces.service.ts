import {
  BadRequestException,
  Injectable,
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
}
