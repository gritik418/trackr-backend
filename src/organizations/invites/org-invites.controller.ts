import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
  @UsePipes(new ZodValidationPipe(sendOrgInviteSchema))
  sendInvite(
    @Param('orgId') orgId: string,
    @Body() data: SendOrgInviteDto,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.sendOrgInvite(orgId, data, req);
  }

  @Get()
  getInvites() {}

  @Delete('/:inviteId')
  revokeInvite() {}

  @Post('/:inviteId/resend')
  resendInvite() {}
}
