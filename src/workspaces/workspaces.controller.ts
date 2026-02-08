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
import { WorkspacesService } from './workspaces.service';
import createWorkspaceSchema, {
  CreateWorkspaceDto,
} from './dto/create-workspace.schema';
import updateWorkspaceSchema, {
  UpdateWorkspaceDto,
} from './dto/update-workspace.schema';
import addMemberSchema, { AddMemberDto } from './dto/add-member.schema';
import updateMemberRoleSchema, {
  UpdateMemberRoleDto,
} from './dto/update-member-role.schema';
import { Request } from 'express';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { OrgRole, WorkspaceRole } from 'generated/prisma/enums';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import { OrgRoleGuard } from 'src/organizations/guards/org-role/org-role.guard';
import { OrgRoles } from 'src/organizations/decorators/org-roles.decorator';

@UseGuards(AuthGuard)
@Controller()
export class WorkspacesController {
  constructor(private readonly workspaceService: WorkspacesService) {}

  @Post('organizations/:orgId/workspaces')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createWorkspaceSchema))
  createWorkspace(
    @Param('orgId') orgId: string,
    @Body() data: CreateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.createWorkspace(orgId, data, req);
  }

  @Get('organizations/:orgId/workspaces')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER)
  getWorkspaces(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.workspaceService.getWorkspaces(orgId, req);
  }

  @Get('workspaces/slug/:workspaceSlug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getWorkspaceBySlug(
    @Param('workspaceSlug') slug: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.getWorkspaceBySlug(slug, req);
  }

  @Get('organizations/:orgId/workspaces/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getWorkspace(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.getWorkspaceById(orgId, workspaceId, req);
  }

  @Get('workspaces/:workspaceId/members')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getWorkspaceMembers(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.getWorkspaceMembers(workspaceId, req);
  }

  @Patch('workspaces/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(updateWorkspaceSchema))
  updateWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Body() data: UpdateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, data, req);
  }

  @Delete('workspaces/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  deleteWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.deleteWorkspace(workspaceId, req);
  }

  @Post('workspaces/:workspaceId/members')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(addMemberSchema))
  addMember(
    @Param('workspaceId') workspaceId: string,
    @Body() data: AddMemberDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.addWorkspaceMember(workspaceId, data, req);
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(updateMemberRoleSchema))
  updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() data: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.updateWorkspaceMemberRole(
      workspaceId,
      memberId,
      data,
      req,
    );
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  removeMember(
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.removeWorkspaceMember(
      workspaceId,
      memberId,
      req,
    );
  }
}
