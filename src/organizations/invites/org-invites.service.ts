import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SendOrgInviteDto } from './dto/send-organization-invite.schema';
import { Request } from 'express';

@Injectable()
export class OrgInvitesService {
  constructor(private readonly prismaService: PrismaService) {}

  async sendOrgInvite(orgId: string, data: SendOrgInviteDto, req: Request) {
    const userId = req.user?.id;
    if (!userId) throw new UnauthorizedException('Unauthenticated');
    if (!orgId) throw new BadRequestException('Organization ID is required');

    return {};
  }
}
