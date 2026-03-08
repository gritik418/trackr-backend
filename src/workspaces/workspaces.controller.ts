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
import { OrgRole, WorkspaceRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { OrgRoles } from 'src/organizations/decorators/org-roles.decorator';
import { OrgRoleGuard } from 'src/organizations/guards/org-role/org-role.guard';
import {
  GetMyTasksDto,
  getMyTasksSchema,
} from 'src/workspaces/dto/get-my-tasks.schema';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';
import addMemberSchema, { AddMemberDto } from './dto/add-member.schema';
import createWorkspaceSchema, {
  CreateWorkspaceDto,
} from './dto/create-workspace.schema';
import updateMemberRoleSchema, {
  UpdateMemberRoleDto,
} from './dto/update-member-role.schema';
import updateWorkspaceSchema, {
  UpdateWorkspaceDto,
} from './dto/update-workspace.schema';
import { WorkspaceRoleGuard } from './guards/workspace-role.guard';
import { WorkspacesService } from './workspaces.service';

@UseGuards(AuthGuard)
@Controller()
export class WorkspacesController {
  constructor(private readonly workspaceService: WorkspacesService) {}

  @Post('organizations/:orgId/workspaces')
  @UseGuards(OrgRoleGuard)
  @UsePipes(new ZodValidationPipe(createWorkspaceSchema))
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
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

  @Get('workspaces/:workspaceId/my-tasks')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @UsePipes(new ZodValidationPipe(getMyTasksSchema))
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getMyTasks(
    @Param('workspaceId') workspaceId: string,
    @Query() query: GetMyTasksDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.getMyTasks(workspaceId, query, req);
  }
}
