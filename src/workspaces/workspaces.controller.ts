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
import { WorkspaceRole } from 'generated/prisma/enums';
import { WorkspaceRoles } from './decorators/workspace-roles.decorator';

@UseGuards(AuthGuard)
@Controller('organizations/:orgId/workspaces')
export class WorkspacesController {
  constructor(private readonly workspaceService: WorkspacesService) {}

  @Post('/')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createWorkspaceSchema))
  createWorkspace(
    @Param('orgId') orgId: string,
    @Body() data: CreateWorkspaceDto,
    @Req() req: Request,
  ) {
    return this.workspaceService.createWorkspace(orgId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getWorkspaces(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.workspaceService.getWorkspaces(orgId, req);
  }

  @Get('/:workspaceId')
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
}
