import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendOrgInviteDto } from './dto/send-organization-invite.schema';
import { AcceptOrgInviteDto } from './dto/accept-organization-invite.schema';
import { v4 as uuidv4 } from 'uuid';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';
import { ConfigService } from '@nestjs/config';
import { InviteStatus } from 'generated/prisma/enums';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { ORG_INVITE_EXPIRY_MS } from 'src/common/constants/expiration.constants';
import { OrganizationInvite } from 'generated/prisma/browser';

@Injectable()
export class OrgInvitesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly hashingService: HashingService,
    private readonly emailProducer: EmailProducer,
    private readonly configService: ConfigService,
  ) {}

  async sendOrgInvite(orgId: string, data: SendOrgInviteDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const { email, role } = data;

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const inviter = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
      },
    });

    if (!inviter) {
      throw new UnauthorizedException('User not found');
    }

    const existingMember =
      await this.prismaService.organizationMember.findFirst({
        where: {
          organizationId: orgId,
          user: {
            email: email,
          },
        },
      });

    if (existingMember) {
      throw new BadRequestException('User is already a member');
    }

    const existingInvite =
      await this.prismaService.organizationInvite.findFirst({
        where: {
          organizationId: orgId,
          email,
          status: 'PENDING',
        },
      });

    if (existingInvite) {
      const now = new Date();
      if (existingInvite.expiresAt.getTime() > now.getTime()) {
        throw new BadRequestException(
          'An invitation has already been sent to this email',
        );
      }
    }

    const token = uuidv4();
    const hashedToken = await this.hashingService.hashValue(token, 8);

    await this.prismaService.organizationInvite.create({
      data: {
        email,
        role,
        token: hashedToken,
        expiresAt: new Date(Date.now() + ORG_INVITE_EXPIRY_MS),
        invitedById: userId,
        organizationId: orgId,
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/invite/org/${orgId}/accept?token=${token}`;

    const organizationInitial = organization.name.charAt(0).toUpperCase();

    await this.emailProducer.sendOrganizationInviteEmail({
      email,
      organizationName: organization.name,
      organizationInitial,
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      inviteLink,
    });

    return {
      success: true,
      message: 'Invitation sent successfully',
    };
  }

  async getOrgInvites(orgId: string, req: Request, status?: InviteStatus) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const invites = await this.prismaService.organizationInvite.findMany({
      where: {
        organizationId: orgId,
        status: status,
      },
      include: {
        invitedBy: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sanitizedInvites = invites.map((invite) => ({
      ...invite,
      invitedBy: sanitizeUser(invite.invitedBy),
    }));

    return {
      success: true,
      message: 'Invitations fetched successfully',
      invitations: sanitizedInvites,
      total: sanitizedInvites.length,
    };
  }

  async revokeOrgInvite(orgId: string, inviteId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');
    if (!inviteId) throw new BadRequestException('Invite ID is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const invite = await this.prismaService.organizationInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.organizationId !== orgId) {
      throw new BadRequestException(
        'Invite does not belong to this organization',
      );
    }

    if (invite.status === 'ACCEPTED') {
      throw new BadRequestException('Cannot revoke an accepted invite');
    }

    if (invite.status === 'REVOKED') {
      throw new BadRequestException('Invite has already been revoked');
    }

    await this.prismaService.organizationInvite.update({
      where: { id: inviteId },
      data: {
        status: 'REVOKED',
      },
    });

    return {
      success: true,
      message: 'Invite revoked successfully',
    };
  }

  async resendOrgInvite(orgId: string, inviteId: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');
    if (!inviteId) throw new BadRequestException('Invite ID is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const invite = await this.prismaService.organizationInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.organizationId !== orgId) {
      throw new BadRequestException(
        'Invite does not belong to this organization',
      );
    }

    if (invite.status === 'ACCEPTED') {
      throw new BadRequestException(
        'Cannot resend an accepted invite. User is already a member.',
      );
    }

    if (invite.status === 'REVOKED') {
      throw new BadRequestException(
        'Cannot resend a revoked invite. Please create a new invitation.',
      );
    }

    const inviter = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
      },
    });

    if (!inviter) {
      throw new UnauthorizedException('User not found');
    }

    const token = uuidv4();
    const hashedToken = await this.hashingService.hashValue(token, 8);

    await this.prismaService.organizationInvite.update({
      where: { id: inviteId },
      data: {
        token: hashedToken,
        expiresAt: new Date(Date.now() + ORG_INVITE_EXPIRY_MS),
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/invite/org/${orgId}/accept?token=${token}`;

    const organizationInitial = organization.name.charAt(0).toUpperCase();

    await this.emailProducer.sendOrganizationInviteEmail({
      email: invite.email,
      organizationName: organization.name,
      organizationInitial,
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      inviteLink,
    });

    return {
      success: true,
      message: 'Invitation resentment successfully',
    };
  }

  async acceptOrgInvite(orgId: string, data: AcceptOrgInviteDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { token } = data;

    const invites = await this.prismaService.organizationInvite.findMany({
      where: {
        organizationId: orgId,
        email: user.email,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    let validInvite: OrganizationInvite | null = null;
    for (const invite of invites) {
      const isMatch = await this.hashingService.compareHash(
        token,
        invite.token,
      );
      if (isMatch) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    const existingMember =
      await this.prismaService.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: orgId,
          },
        },
      });

    if (existingMember) {
      throw new BadRequestException(
        'You are already a member of this organization',
      );
    }

    return await this.prismaService.$transaction(async (tx) => {
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: orgId,
          role: validInvite.role,
        },
      });

      await tx.organizationInvite.update({
        where: { id: validInvite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      if (validInvite.role === 'ADMIN') {
        const workspaces = await tx.workspace.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });

        if (workspaces.length > 0) {
          await tx.workspaceMember.createMany({
            data: workspaces.map((workspace) => ({
              userId,
              workspaceId: workspace.id,
              role: 'ADMIN',
            })),
            skipDuplicates: true,
          });
        }
      }

      return {
        success: true,
        message: 'Successfully joined the organization',
      };
    });
  }

  async rejectOrgInvite(orgId: string, data: AcceptOrgInviteDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { token } = data;

    const invites = await this.prismaService.organizationInvite.findMany({
      where: {
        organizationId: orgId,
        email: user.email,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    let validInvite: OrganizationInvite | null = null;
    for (const invite of invites) {
      const isMatch = await this.hashingService.compareHash(
        token,
        invite.token,
      );
      if (isMatch) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    await this.prismaService.organizationInvite.update({
      where: { id: validInvite.id },
      data: {
        status: InviteStatus.REJECTED,
      },
    });

    return {
      success: true,
      message: 'Invitation rejected successfully',
    };
  }

  async previewOrgInvite(orgId: string, token: string, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new UnauthorizedException('Unauthenticated');

    if (!orgId) throw new BadRequestException('Organization ID is required');
    if (!token) throw new BadRequestException('Invite token is required');

    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        websiteUrl: true,
        description: true,
        owner: {
          select: {
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const invites = await this.prismaService.organizationInvite.findMany({
      where: {
        organizationId: orgId,
        email: user.email,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    let validInvite: OrganizationInvite | null = null;
    for (const invite of invites) {
      const isMatch = await this.hashingService.compareHash(
        token,
        invite.token,
      );
      if (isMatch) {
        validInvite = invite;
        break;
      }
    }

    if (!validInvite) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    return {
      success: true,
      message: 'Invite details fetched successfully',
      invite: validInvite,
      organization,
    };
  }
}
