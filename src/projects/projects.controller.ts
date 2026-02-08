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
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import {
  CreateProjectDto,
  createProjectSchema,
} from './dto/create-project.schema';
import { ProjectsService } from './projects.service';
import { ProjectRoleGuard } from './guards/project-role.guard';
import { ProjectRoles } from './decorators/project-roles.decorator';
import { ProjectRole, WorkspaceRole } from 'generated/prisma/enums';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';

@UseGuards(AuthGuard, WorkspaceRoleGuard)
@Controller('workspaces/:workspaceId/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post('/')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  createProject(
    @Param('workspaceId') workspaceId: string,
    @Body() data: CreateProjectDto,
    @Req() req: Request,
  ) {
    return this.projectsService.createProject(workspaceId, data, req);
  }

  @Get('/')
  @HttpCode(HttpStatus.OK)
  @WorkspaceRoles(
    WorkspaceRole.OWNER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.MEMBER,
  )
  getProjects(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    return this.projectsService.getProjects(workspaceId, req);
  }
}
