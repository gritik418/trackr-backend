import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import createWorkspaceSchema, {
  CreateWorkspaceDto,
} from './dto/create-workspace.schema';
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

  @Get('organizations/:orgId/workspaces/:workspaceId/members')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getWorkspaceMembers(
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.workspaceService.getWorkspaceMembers(orgId, workspaceId, req);
  }
}
