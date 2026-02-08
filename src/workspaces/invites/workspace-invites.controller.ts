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
import { WorkspaceInvitesService } from './workspace-invites.service';

@WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
@UseGuards(AuthGuard, WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/invites')
export class WorkspaceInvitesController {
  constructor(
    private readonly workspaceInvitesService: WorkspaceInvitesService,
  ) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
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
}
