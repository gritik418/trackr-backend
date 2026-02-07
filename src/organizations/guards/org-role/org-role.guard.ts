import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { OrgRole } from 'generated/prisma/enums';
import { ORG_ROLES_KEY } from 'src/organizations/decorators/org-roles.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const orgId = req.params.orgId as string | null;
    const userId = req.user?.id;

    if (!orgId) throw new BadRequestException('Organization ID is required.');
    const organization = await this.prismaService.organization.findUnique({
      where: { id: orgId },
    });
    if (!organization || !userId) throw new ForbiddenException('Access denied');

    const membership = await this.prismaService.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: orgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
