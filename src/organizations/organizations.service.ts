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
import { UpdateMemberRoleDto } from './dto/update-member-role.schema';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async createOrganization(data: CreateOrganizationDto, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { name, slug, description, logoUrl, websiteUrl, contactEmail } = data;

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
        contactEmail: contactEmail || '',
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

    await this.auditLogsService.createLog({
      action: 'ORGANIZATION_CREATE',
      entityType: 'ORGANIZATION',
      entityId: org.id,
      organizationId: org.id,
      userId: req.user.id,
      details: { name: org.name, slug: org.slug },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

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
      orderBy: { updatedAt: 'desc' },
    });

    const organizations = orgs.map((org) => {
      const owner = sanitizeUser(org.owner);
      const user = org.members.find((member) => member.userId === req.user?.id);
      const members = org.members.map((m) => ({
        ...m,
        user: sanitizeUser(m.user),
      }));
      return { ...org, owner, members, role: user?.role };
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

  async getOrganizationBySlug(orgSlug: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgSlug) throw new BadRequestException('Organization ID is required');

    const org = await this.prismaService.organization.findFirst({
      where: { slug: orgSlug, members: { some: { userId: req.user.id } } },
      include: {
        owner: true,
        members: { include: { user: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found.');

    const user = org.members.find((member) => member.userId === req.user?.id);
    const organization = {
      ...org,
      owner: sanitizeUser(org.owner),
      role: user?.role,
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
    if (data.contactEmail !== undefined)
      updates.contactEmail = data.contactEmail;

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

    await this.auditLogsService.createLog({
      action: 'ORGANIZATION_UPDATE',
      entityType: 'ORGANIZATION',
      entityId: orgId,
      organizationId: orgId,
      userId: req.user.id,
      details: updates,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Organization updated successfully.',
      organization: orgSanitized,
    };
  }

  async getMembers(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const members = await this.prismaService.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    const sanitizedMembers = members.map((member) => ({
      ...member,
      user: sanitizeUser(member.user),
    }));

    return {
      success: true,
      message: 'Members retrieved successfully.',
      members: sanitizedMembers,
    };
  }

  async deleteOrganization(orgId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: { ownerId: true, name: true },
    });
    if (!organization) throw new NotFoundException('Organization not found.');

    if (organization.ownerId.toString() !== req.user.id.toString())
      throw new ForbiddenException('Only organization owner can delete.');

    await this.prismaService.organization.delete({ where: { id: orgId } });

    await this.auditLogsService.createLog({
      action: 'ORGANIZATION_DELETE',
      entityType: 'ORGANIZATION',
      entityId: orgId,
      organizationId: orgId,
      userId: req.user.id,
      details: { name: organization.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      success: true,
      message: 'Organization deleted successfully.',
    };
  }

  async removeMember(orgId: string, memberId: string, req: Request) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const member = await this.prismaService.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found in this organization.');
    }

    if (req.user.id === member.userId) {
      throw new BadRequestException('You cannot remove yourself.');
    }

    const requester = await this.prismaService.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!requester) {
      throw new ForbiddenException(
        'You are not a member of this organization.',
      );
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Organization owner cannot be removed.');
    }

    if (requester.role === 'ADMIN' && member.role === 'ADMIN') {
      throw new ForbiddenException('Admins cannot remove other admins.');
    }

    if (
      requester.role !== 'OWNER' &&
      requester.role !== 'ADMIN' &&
      member.userId !== req.user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to remove this member.',
      );
    }

    await this.prismaService.organizationMember.delete({
      where: { id: memberId },
    });

    await this.auditLogsService.createLog({
      action: 'ORGANIZATION_MEMBER_REMOVE',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: memberId,
      organizationId: orgId,
      userId: req.user.id,
      details: { removedUserId: member.userId, role: member.role },
      ipAddress: req.ip as string,
      userAgent: req.headers['user-agent'] as string,
    });

    return {
      success: true,
      message: 'Member removed successfully.',
    };
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    data: UpdateMemberRoleDto,
    req: Request,
  ) {
    if (!req.user?.id) throw new UnauthorizedException('Unauthenticated');
    const { role } = data;

    const member = await this.prismaService.organizationMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found in this organization.');
    }

    const requester = await this.prismaService.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId: req.user.id,
          organizationId: orgId,
        },
      },
    });

    if (!requester) {
      throw new ForbiddenException(
        'You are not a member of this organization.',
      );
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException(
        'Organization owner role cannot be changed.',
      );
    }

    if (
      requester.role === 'ADMIN' &&
      (member.role === 'ADMIN' || role === 'OWNER')
    ) {
      throw new ForbiddenException(
        'Admins cannot change roles of other admins.',
      );
    }

    if (requester.role !== 'OWNER' && requester.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only admins/owners can change member roles.',
      );
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.organizationMember.update({
        where: { id: memberId },
        data: { role },
      });

      if (role === 'ADMIN') {
        const workspaces = await tx.workspace.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });

        if (workspaces.length > 0) {
          await tx.workspaceMember.createMany({
            data: workspaces.map((workspace) => ({
              userId: member.userId,
              workspaceId: workspace.id,
              role: 'ADMIN',
            })),
            skipDuplicates: true,
          });
        }
      } else if (member.role === 'ADMIN' && role === 'MEMBER') {
        await tx.workspaceMember.deleteMany({
          where: {
            userId: member.userId,
            workspace: {
              organizationId: orgId,
            },
          },
        });
      }
    });

    await this.auditLogsService.createLog({
      action: 'ORGANIZATION_MEMBER_ROLE_UPDATE',
      entityType: 'ORGANIZATION_MEMBER',
      entityId: memberId,
      organizationId: orgId,
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
}
