import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendOrgInviteDto } from './dto/send-organization-invite.schema';
import { v4 as uuidv4 } from 'uuid';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';
import { ConfigService } from '@nestjs/config';
import { sanitizeUser } from 'src/common/utils/sanitize-user';

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
        },
      });

    if (existingInvite && existingInvite.status === 'PENDING') {
      const now = new Date();
      if (existingInvite.expiresAt > now) {
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        invitedById: userId,
        organizationId: orgId,
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/org/${orgId}/invite/accept?token=${token}`;

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

  async getOrgInvites(orgId: string, req: Request) {
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
      },
      include: {
        invitedBy: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sanitizesInvites = invites.map((invite) => ({
      ...invite,
      invitedBy: sanitizeUser(invite.invitedBy),
    }));

    return {
      success: true,
      message: 'Invites fetched successfully',
      invites: sanitizesInvites,
      total: sanitizesInvites.length,
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
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/org/${orgId}/invite/accept?token=${token}`;

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
      message: 'Invitation resent successfully',
    };
  }
}
