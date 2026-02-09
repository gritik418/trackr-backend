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
import { InviteStatus, WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { WorkspaceRoles } from '../decorators/workspace-roles.decorator';
import { WorkspaceRoleGuard } from '../guards/workspace-role.guard';
import sendWorkspaceInviteSchema, {
  SendWorkspaceInviteDto,
} from './dto/send-workspace-invite.schema';
import {
  AcceptWorkspaceInviteDto,
  acceptWorkspaceInviteSchema,
} from './dto/accept-workspace-invite.schema';
import { WorkspaceInvitesService } from './workspace-invites.service';

@UseGuards(AuthGuard)
@Controller('workspaces/:workspaceId/invites')
export class WorkspaceInvitesController {
  constructor(
    private readonly workspaceInvitesService: WorkspaceInvitesService,
  ) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(sendWorkspaceInviteSchema))
  sendInvite(
    @Param('workspaceId') workspaceId: string,
    @Body() data: SendWorkspaceInviteDto,
    @Req() req: Request,
  ) {
    return this.workspaceInvitesService.sendWorkspaceInvite(
      workspaceId,
      data,
      req,
    );
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  getInvites(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query('status') status?: InviteStatus,
  ) {
    return this.workspaceInvitesService.getWorkspaceInvites(
      workspaceId,
      req,
      status,
    );
  }

  @Delete('/:inviteId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  revokeInvite(
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.workspaceInvitesService.revokeWorkspaceInvite(
      workspaceId,
      inviteId,
      req,
    );
  }

  @Patch('/:inviteId/resend')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  resendInvite(
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
    @Req() req: Request,
  ) {
    return this.workspaceInvitesService.resendWorkspaceInvite(
      workspaceId,
      inviteId,
      req,
    );
  }

  @Post('/accept')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(acceptWorkspaceInviteSchema))
  acceptInvite(
    @Param('workspaceId') workspaceId: string,
    @Body() data: AcceptWorkspaceInviteDto,
    @Req() req: Request,
  ) {
    return this.workspaceInvitesService.acceptWorkspaceInvite(
      workspaceId,
      data,
      req,
    );
  }

  @Get('/preview')
  @HttpCode(HttpStatus.OK)
  previewInvite(
    @Param('workspaceId') workspaceId: string,
    @Query('token') token: string,
    @Req() req: Request,
  ) {
    return this.workspaceInvitesService.previewWorkspaceInvite(
      workspaceId,
      token,
      req,
    );
  }
}
