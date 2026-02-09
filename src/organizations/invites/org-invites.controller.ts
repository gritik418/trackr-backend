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
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { InviteStatus, OrgRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { OrgRoles } from '../decorators/org-roles.decorator';
import { OrgRoleGuard } from '../guards/org-role/org-role.guard';
import sendOrgInviteSchema, {
  SendOrgInviteDto,
} from './dto/send-organization-invite.schema';
import {
  AcceptOrgInviteDto,
  acceptOrgInviteSchema,
} from './dto/accept-organization-invite.schema';
import { OrgInvitesService } from './org-invites.service';

@UseGuards(AuthGuard)
@Controller('organizations/:orgId/invites')
export class OrgInvitesController {
  constructor(private readonly orgInvitesService: OrgInvitesService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UsePipes(new ZodValidationPipe(sendOrgInviteSchema))
  sendInvite(
    @Param('orgId') orgId: string,
    @Body() data: SendOrgInviteDto,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.sendOrgInvite(orgId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  getInvites(
    @Param('orgId') orgId: string,
    @Req() req: Request,
    @Query('status') status?: InviteStatus,
  ) {
    return this.orgInvitesService.getOrgInvites(orgId, req, status);
  }

  @Delete('/:inviteId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  revokeInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.revokeOrgInvite(orgId, inviteId, req);
  }

  @Patch('/:inviteId/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  resendInvite(
    @Param('orgId') orgId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.resendOrgInvite(orgId, inviteId, req);
  }

  @Post('/accept')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(acceptOrgInviteSchema))
  acceptInvite(
    @Param('orgId') orgId: string,
    @Body() data: AcceptOrgInviteDto,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.acceptOrgInvite(orgId, data, req);
  }

  @Get('/preview')
  @HttpCode(HttpStatus.OK)
  previewInvite(
    @Param('orgId') orgId: string,
    @Query('token') token: string,
    @Req() req: Request,
  ) {
    return this.orgInvitesService.previewOrgInvite(orgId, token, req);
  }
}
