import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { OrgRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { OrgRoles } from '../decorators/org-roles.decorator';
import { OrgRoleGuard } from '../guards/org-role/org-role.guard';
import sendOrgInviteSchema, {
  SendOrgInviteDto,
} from './dto/send-organization-invite.schema';
import { OrgInvitesService } from './org-invites.service';

@OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
@UseGuards(AuthGuard, OrgRoleGuard)
@Controller('organizations/:orgId/invites')
export class OrgInvitesController {
  constructor(private readonly orgInvitesService: OrgInvitesService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(sendOrgInviteSchema))
  sendInvite(
    @Param('orgId') orgId: string,
    @Body() data: SendOrgInviteDto,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.sendOrgInvite(orgId, data, req);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  getInvites(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.orgInvitesService.getOrgInvites(orgId, req);
  }

  @Delete('/:inviteId')
  @HttpCode(HttpStatus.OK)
  revokeInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.revokeOrgInvite(orgId, inviteId, req);
  }

  @Patch('/:inviteId/resend')
  @HttpCode(HttpStatus.OK)
  resendInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.resendOrgInvite(orgId, inviteId, req);
  }
}
