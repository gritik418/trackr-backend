import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendWorkspaceInviteDto } from './dto/send-workspace-invite.schema';
import { AcceptWorkspaceInviteDto } from './dto/accept-workspace-invite.schema';
import { v4 as uuidv4 } from 'uuid';
import { HashingService } from 'src/common/hashing/hashing.service';
import { EmailProducer } from 'src/queues/email/email.producer';
import { ConfigService } from '@nestjs/config';
import { InviteStatus } from 'generated/prisma/enums';
import { sanitizeUser } from 'src/common/utils/sanitize-user';
import { WORKSPACE_INVITE_EXPIRY_MS } from 'src/common/constants/expiration.constants';

@Injectable()
export class WorkspaceInvitesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly hashingService: HashingService,
    private readonly emailProducer: EmailProducer,
    private readonly configService: ConfigService,
  ) {}

  async sendWorkspaceInvite(
    workspaceId: string,
    data: SendWorkspaceInviteDto,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId) throw new BadRequestException('Workspace ID is required');

    const { email, role } = data;

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
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

    const existingMember = await this.prismaService.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: {
          email: email,
        },
      },
    });

    if (existingMember) {
      throw new BadRequestException(
        'User is already a member of this workspace',
      );
    }

    const existingInvite = await this.prismaService.workspaceInvite.findFirst({
      where: {
        workspaceId,
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

    await this.prismaService.workspaceInvite.create({
      data: {
        email,
        role,
        token: hashedToken,
        expiresAt: new Date(Date.now() + WORKSPACE_INVITE_EXPIRY_MS),
        invitedById: userId,
        workspaceId,
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/invite/workspace/${workspaceId}/accept?token=${token}`;

    const workspaceInitial = workspace.name.charAt(0).toUpperCase();

    await this.emailProducer.sendWorkspaceInviteEmail({
      email,
      workspaceName: workspace.name,
      workspaceInitial,
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      inviteLink,
    });

    return {
      success: true,
      message: 'Invitation sent successfully',
    };
  }

  async getWorkspaceInvites(
    workspaceId: string,
    req: Request,
    status?: InviteStatus,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId) throw new BadRequestException('Workspace ID is required');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const invites = await this.prismaService.workspaceInvite.findMany({
      where: {
        workspaceId,
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

  async revokeWorkspaceInvite(
    workspaceId: string,
    inviteId: string,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId) throw new BadRequestException('Workspace ID is required');
    if (!inviteId) throw new BadRequestException('Invite ID is required');

    const invite = await this.prismaService.workspaceInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.workspaceId !== workspaceId) {
      throw new BadRequestException('Invite does not belong to this workspace');
    }

    if (invite.status === 'ACCEPTED') {
      throw new BadRequestException('Cannot revoke an accepted invite');
    }

    if (invite.status === 'REVOKED') {
      throw new BadRequestException('Invite has already been revoked');
    }

    await this.prismaService.workspaceInvite.update({
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

  async resendWorkspaceInvite(
    workspaceId: string,
    inviteId: string,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!workspaceId) throw new BadRequestException('Workspace ID is required');
    if (!inviteId) throw new BadRequestException('Invite ID is required');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const invite = await this.prismaService.workspaceInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.workspaceId !== workspaceId) {
      throw new BadRequestException('Invite does not belong to this workspace');
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

    await this.prismaService.workspaceInvite.update({
      where: { id: inviteId },
      data: {
        token: hashedToken,
        expiresAt: new Date(Date.now() + WORKSPACE_INVITE_EXPIRY_MS),
        status: 'PENDING',
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL');
    const inviteLink = `${clientUrl}/invite/workspace/${workspaceId}/accept?token=${token}`;

    const workspaceInitial = workspace.name.charAt(0).toUpperCase();

    await this.emailProducer.sendWorkspaceInviteEmail({
      email: invite.email,
      workspaceName: workspace.name,
      workspaceInitial,
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      inviteLink,
    });

    return {
      success: true,
      message: 'Invitation resent successfully',
    };
  }

  async acceptWorkspaceInvite(
    workspaceId: string,
    data: AcceptWorkspaceInviteDto,
    req: Request,
  ) {
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

    const invites = await this.prismaService.workspaceInvite.findMany({
      where: {
        workspaceId,
        email: user.email,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    let validInvite: any = null;
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

    const existingMember = await this.prismaService.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
      },
    });

    if (existingMember) {
      throw new BadRequestException(
        'You are already a member of this workspace',
      );
    }

    return await this.prismaService.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId,
          role: validInvite.role,
        },
      });

      await tx.workspaceInvite.update({
        where: { id: validInvite.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Successfully joined the workspace',
      };
    });
  }

  async previewWorkspaceInvite(
    workspaceId: string,
    token: string,
    req: Request,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');

    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new UnauthorizedException('Unauthenticated');

    if (!workspaceId) throw new BadRequestException('Workspace ID is required');
    if (!token) throw new BadRequestException('Invite token is required');

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const invites = await this.prismaService.workspaceInvite.findMany({
      where: {
        workspaceId,
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
        workspace: {
          select: {
            name: true,
            iconUrl: true,
            description: true,
            owner: {
              select: {
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            organization: {
              select: {
                name: true,
                logoUrl: true,
                description: true,
                websiteUrl: true,
              },
            },
          },
        },
      },
    });

    let validInvite: any = null;
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
    };
  }
}
