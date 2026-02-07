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
      await this.prismaService.organizationInvite.findUnique({
        where: {
          organizationId_email: {
            organizationId: orgId,
            email: email,
          },
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
}
