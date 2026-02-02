import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.schema';
import { UpdateOrganizationDto } from './dto/update-organization.schema';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prismaService: PrismaService) {}

  async createOrganization(data: CreateOrganizationDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { name, slug, description, logoUrl, websiteUrl } = data;

    const existingSlug = await this.prismaService.organization.findFirst({
      where: {
        slug,
      },
    });

    if (existingSlug) throw new BadRequestException('Slug is already in use.');

    const existingName = await this.prismaService.organization.findFirst({
      where: {
        name,
        ownerId: req.user.id,
      },
    });
    if (existingName)
      throw new BadRequestException(
        'You have used the same name for another organization.',
      );

    const org = await this.prismaService.organization.create({
      data: {
        name,
        slug,
        description: description || '',
        logoUrl: logoUrl || '',
        websiteUrl: websiteUrl || '',
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

    const orgSanitized = {
      ...org,
      owner: sanitizeUser(org.owner),
      members: org.members.map((m) => ({ ...m, user: sanitizeUser(m.user) })),
    };

    return {
      success: true,
      message: 'Organization created successfully.',
      organization: orgSanitized,
    };
  }

  async getUserOrganizations(req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');

    const orgs = await this.prismaService.organization.findMany({
      where: { members: { some: { userId: req.user.id } } },
      include: { members: { include: { user: true } }, owner: true },
    });

    const organizations = orgs.map((org) => {
      const owner = sanitizeUser(org.owner);
      const members = org.members.map((m) => ({
        ...m,
        user: sanitizeUser(m.user),
      }));
      return { ...org, owner, members };
    });

    return {
      success: true,
      message: 'Organizations retrieved successfully.',
      organizations,
    };
  }

  async getOrganizationById(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const org = await this.prismaService.organization.findFirst({
      where: { id: orgId, members: { some: { userId: req.user.id } } },
      include: {
        owner: true,
        members: { include: { user: true } },
        workspaces: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found.');

    const organization = {
      ...org,
      owner: sanitizeUser(org.owner),
      members: org.members.map((m) => ({ ...m, user: sanitizeUser(m.user) })),
    };

    return {
      success: true,
      message: 'Organization retrieved successfully.',
      organization,
    };
  }

  async updateOrganization(
    orgId: string,
    data: UpdateOrganizationDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required.');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true, name: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');

    if (organization.ownerId.toString() !== req.user.id.toString())
      throw new ForbiddenException('Only organization owner can update.');

    if (data.name !== undefined && data.name !== organization.name) {
      const existingName = await this.prismaService.organization.findFirst({
        where: { name: data.name, ownerId: req.user.id, NOT: { id: orgId } },
      });

      if (existingName)
        throw new BadRequestException(
          'You have used the same name for another organization.',
        );
    }

    const updates: UpdateOrganizationDto = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;
    if (data.websiteUrl !== undefined) updates.websiteUrl = data.websiteUrl;

    const org = await this.prismaService.organization.update({
      where: { id: orgId },
      data: { ...updates },
      include: { members: { include: { user: true } }, owner: true },
    });

    const orgSanitized = {
      ...org,
      owner: sanitizeUser(org.owner),
      members: org.members.map((m) => ({ ...m, user: sanitizeUser(m.user) })),
    };
    return {
      success: true,
      message: 'Organization updated successfully.',
      organization: orgSanitized,
    };
  }

  async deleteOrganization(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');

    if (organization.ownerId.toString() !== req.user.id.toString())
      throw new ForbiddenException('Only organization owner can delete.');

    await this.prismaService.organization.delete({ where: { id: orgId } });

    return {
      success: true,
      message: 'Organization deleted successfully.',
    };
  }
}
